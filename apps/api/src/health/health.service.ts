import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFileSync } from 'node:child_process';
import { isPrivileged, type Role } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeploymentInfo,
  EnvironmentTier,
  HealthCheck,
  HealthResponse,
  HealthStatus,
} from './health.types';

const ENV_TIERS: readonly EnvironmentTier[] = [
  'production',
  'beta',
  'stage',
  'develop',
] as const;

function isEnvironmentTier(value: unknown): value is EnvironmentTier {
  return (
    typeof value === 'string' &&
    (ENV_TIERS as readonly string[]).includes(value)
  );
}

/**
 * Produce a human-readable error message that includes any details Prisma
 * and the underlying pg driver hide on `cause` / `code`. Without this,
 * `err.message` for a connection failure is just the Prisma header line
 * with no actual reason.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const parts: string[] = [];
  let current: unknown = err;
  while (current instanceof Error) {
    const code = (current as { code?: unknown }).code;
    const codeSuffix = typeof code === 'string' ? ` [${code}]` : '';
    const msg = current.message.trim();
    if (msg) parts.push(`${msg}${codeSuffix}`);
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join(' <- ') || err.message;
}

@Injectable()
export class HealthService {
  /**
   * Cached repository slug parsed from the local `origin` remote at
   * boot. Used to populate `deployment.repository` when no provider
   * env var (`RENDER_GIT_REPO_SLUG`, `GIT_REPOSITORY`) is present.
   * The remote URL is effectively immutable during a process lifetime,
   * so we read it once rather than spawning `git` on every request.
   */
  private readonly localRepository: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.localRepository = readGitRemoteSlug();
  }

  /**
   * Full health snapshot: process metrics + datastore reachability.
   * Suitable for `/health` and as a readiness probe.
   *
   * `opts.role` controls how much detail the response carries:
   *   - owner / admin  → full deployment metadata (commit, instanceId, …)
   *   - user / public  → status + checks only; privileged fields stripped
   *
   * The endpoint must stay reachable for monitoring probes either way,
   * so unauthenticated callers always get a valid (if minimal) response
   * rather than 401/403.
   */
  async check(opts: { role?: Role } = {}): Promise<HealthResponse> {
    const checks: Record<string, HealthCheck[]> = {
      ...this.systemChecks(),
      ...(await this.datastoreChecks()),
    };

    return this.buildResponse(this.aggregate(checks), checks, opts.role);
  }

  /**
   * Liveness check — answers "is the process up?".
   * Intentionally does NOT touch the database so a flaky DB
   * does not cause Kubernetes to restart the pod.
   */
  liveness(opts: { role?: Role } = {}): HealthResponse {
    const checks = this.systemChecks();
    return this.buildResponse(this.aggregate(checks), checks, opts.role);
  }

  /**
   * Readiness check — answers "should we send traffic here?".
   * Includes downstream datastore checks.
   */
  async readiness(opts: { role?: Role } = {}): Promise<HealthResponse> {
    return this.check(opts);
  }

  private async datastoreChecks(): Promise<Record<string, HealthCheck[]>> {
    const now = () => new Date().toISOString();
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        'db:responseTime': [
          {
            componentId: 'primary-db',
            componentType: 'datastore',
            observedValue: Date.now() - start,
            observedUnit: 'ms',
            status: 'pass',
            time: now(),
          },
        ],
      };
    } catch (err) {
      return {
        'db:responseTime': [
          {
            componentId: 'primary-db',
            componentType: 'datastore',
            status: 'fail',
            time: now(),
            output: describeError(err),
          },
        ],
      };
    }
  }

  private systemChecks(): Record<string, HealthCheck[]> {
    const now = new Date().toISOString();
    const mem = process.memoryUsage();
    const heapUsedMb = mem.heapUsed / 1024 / 1024;
    const heapRatio = mem.heapUsed / mem.heapTotal;

    // Only warn when the process is using a meaningful amount of memory
    // AND the heap is mostly full. Avoids false positives at startup,
    // where heapTotal is tiny and the ratio is naturally high.
    const memoryStatus: HealthStatus =
      heapUsedMb > 512 && heapRatio > 0.9 ? 'warn' : 'pass';

    return {
      'memory:utilization': [
        {
          componentType: 'system',
          observedValue: Math.round(heapUsedMb),
          observedUnit: 'MB',
          status: memoryStatus,
          time: now,
        },
      ],
      uptime: [
        {
          componentType: 'system',
          observedValue: Math.round(process.uptime()),
          observedUnit: 's',
          status: 'pass',
          time: now,
        },
      ],
    };
  }

  private aggregate(checks: Record<string, HealthCheck[]>): HealthStatus {
    const statuses = Object.values(checks)
      .flat()
      .map((c) => c.status ?? 'pass');
    if (statuses.includes('fail')) return 'fail';
    if (statuses.includes('warn')) return 'warn';
    return 'pass';
  }

  private buildResponse(
    status: HealthStatus,
    checks: Record<string, HealthCheck[]>,
    role: Role | undefined,
  ): HealthResponse {
    // Prefer explicit overrides, then fall back to whatever the host
    // (Render) injects, then sensible defaults.
    const commit =
      this.config.get<string>('RELEASE_ID') ??
      this.config.get<string>('RENDER_GIT_COMMIT');

    const releaseId = commit ? commit.slice(0, 7) : '0.0.0';

    const serviceId =
      this.config.get<string>('SERVICE_ID') ??
      this.config.get<string>('RENDER_SERVICE_NAME') ??
      'synctip-api';

    // Deployment tier (production/beta/stage/develop). See docs/DEPLOYMENT.md.
    // Each Render service explicitly sets APP_ENV; unset/invalid is omitted
    // so legacy consumers don't see a misleading default.
    const rawTier = this.config.get<string>('APP_ENV');
    const tier: EnvironmentTier | undefined = isEnvironmentTier(rawTier)
      ? rawTier
      : undefined;

    const description = tier
      ? `synctip API health (${tier})`
      : 'synctip API health';

    // Privileged fields — exposed only to owner/admin sessions. These
    // reveal the running commit and provider-scoped IDs that could be
    // used to fingerprint or target the deployment. Monitoring probes
    // don't need them; the response stays a valid IETF health doc.
    const privileged = isPrivileged(role);
    const deployment = privileged ? this.deploymentInfo() : undefined;

    return {
      status,
      version: this.config.get<string>('SERVICE_VERSION') ?? '1',
      ...(privileged ? { releaseId } : {}),
      serviceId,
      ...(tier ? { tier } : {}),
      ...(deployment ? { deployment } : {}),
      description,
      checks,
    };
  }

  /**
   * Aggregate the deployment metadata Render injects into the runtime
   * environment so clients can build rich navigation links (GitHub
   * branch/commit, Render dashboard, etc.). Returns `undefined` when no
   * provider-supplied data is present (e.g. local development).
   */
  private deploymentInfo(): DeploymentInfo | undefined {
    const renderServiceId = this.config.get<string>('RENDER_SERVICE_ID');
    const renderInstanceId = this.config.get<string>('RENDER_INSTANCE_ID');
    const renderServiceType = this.config.get<string>('RENDER_SERVICE_TYPE');
    const renderRegion = this.config.get<string>('RENDER_REGION');

    // Only invoke `git` when running outside a hosted environment.
    // Production deploys read everything from provider env vars and
    // shouldn't pay the cost of spawning `git` on each health probe.
    const liveGit = renderServiceId ? undefined : readLiveLocalGit();

    const commit =
      this.config.get<string>('RELEASE_ID') ??
      this.config.get<string>('RENDER_GIT_COMMIT') ??
      liveGit?.commit;
    const branch =
      this.config.get<string>('RENDER_GIT_BRANCH') ?? liveGit?.branch;
    // RENDER_GIT_REPO_SLUG is the canonical Render value; GIT_REPOSITORY
    // is a manual override for non-Render hosts. Falls back to the
    // origin remote parsed from the local working tree at boot.
    const repository =
      this.config.get<string>('GIT_REPOSITORY') ??
      this.config.get<string>('RENDER_GIT_REPO_SLUG') ??
      this.localRepository;

    const info: DeploymentInfo = {
      ...(repository ? { repository } : {}),
      ...(branch ? { branch } : {}),
      ...(commit ? { commit } : {}),
      ...(renderServiceId
        ? { provider: 'render' as const, serviceId: renderServiceId }
        : {}),
      ...(renderInstanceId ? { instanceId: renderInstanceId } : {}),
      ...(renderServiceType ? { serviceType: renderServiceType } : {}),
      ...(renderRegion ? { region: renderRegion } : {}),
      // Local-dev-only indicators: dirty working tree, divergence from
      // the upstream tracking branch. Omitted entirely in production.
      ...(liveGit?.dirty ? { dirty: true } : {}),
      ...(liveGit?.upstream ? { upstream: liveGit.upstream } : {}),
      ...(liveGit?.ahead !== undefined ? { ahead: liveGit.ahead } : {}),
      ...(liveGit?.behind !== undefined ? { behind: liveGit.behind } : {}),
    };

    return Object.keys(info).length > 0 ? info : undefined;
  }
}

/**
 * Spawn `git` with stdin/stderr suppressed and return trimmed stdout,
 * or `undefined` on any failure (git missing, not a repo, etc.).
 */
function runGit(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Read the repository slug from the `origin` remote URL. Called once
 * at boot — the remote URL doesn't change during a process lifetime.
 */
function readGitRemoteSlug(): string | undefined {
  const remote = runGit(['remote', 'get-url', 'origin']);
  return remote ? parseGitHubSlug(remote) : undefined;
}

/**
 * Read the dynamic local git state (branch, commit, working-tree
 * cleanliness, divergence from upstream). Re-read on each health
 * probe so the page reflects what the developer is doing right now.
 *
 * All sub-commands swallow errors individually; the function never
 * throws and may return partial data (e.g. a branch with no upstream).
 */
function readLiveLocalGit(): {
  branch?: string;
  commit?: string;
  dirty?: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
} {
  const branchRaw = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commit = runGit(['rev-parse', 'HEAD']);
  // 'HEAD' indicates a detached state — not useful as a branch link.
  const branch = branchRaw && branchRaw !== 'HEAD' ? branchRaw : undefined;

  // `status --porcelain` prints one line per modified path, empty
  // output means a clean tree. Untracked files count as dirty.
  const status = runGit(['status', '--porcelain']);
  const dirty = status !== undefined ? status.length > 0 : undefined;

  // Upstream tracking branch, e.g. "origin/develop". Fails (no upstream)
  // when the branch has never been pushed or has no `branch.<name>.remote`
  // configured — in that case we omit divergence info.
  const upstream = runGit([
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);

  let ahead: number | undefined;
  let behind: number | undefined;
  if (upstream) {
    // `--left-right --count A...B` prints "<left>\t<right>" — commits
    // reachable from A (HEAD) but not B (upstream), and vice versa.
    const counts = runGit([
      'rev-list',
      '--left-right',
      '--count',
      'HEAD...@{u}',
    ]);
    const match = counts?.match(/^(\d+)\s+(\d+)$/);
    if (match) {
      ahead = Number(match[1]);
      behind = Number(match[2]);
    }
  }

  return {
    ...(branch ? { branch } : {}),
    ...(commit ? { commit } : {}),
    ...(dirty !== undefined ? { dirty } : {}),
    ...(upstream ? { upstream } : {}),
    ...(ahead !== undefined ? { ahead } : {}),
    ...(behind !== undefined ? { behind } : {}),
  };
}

/**
 * Extract a GitHub-style "owner/repo" slug from a remote URL.
 * Handles both SSH (`git@github.com:owner/repo.git`) and
 * HTTPS (`https://github.com/owner/repo.git`) forms; returns undefined
 * for non-GitHub remotes.
 */
function parseGitHubSlug(remote: string): string | undefined {
  const match = remote.match(
    /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i,
  );
  return match?.[1];
}
