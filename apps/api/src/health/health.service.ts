import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Full health snapshot: process metrics + datastore reachability.
   * Suitable for `/health` and as a readiness probe.
   */
  async check(): Promise<HealthResponse> {
    const checks: Record<string, HealthCheck[]> = {
      ...this.systemChecks(),
      ...(await this.datastoreChecks()),
    };

    return this.buildResponse(this.aggregate(checks), checks);
  }

  /**
   * Liveness check — answers "is the process up?".
   * Intentionally does NOT touch the database so a flaky DB
   * does not cause Kubernetes to restart the pod.
   */
  liveness(): HealthResponse {
    const checks = this.systemChecks();
    return this.buildResponse(this.aggregate(checks), checks);
  }

  /**
   * Readiness check — answers "should we send traffic here?".
   * Includes downstream datastore checks.
   */
  async readiness(): Promise<HealthResponse> {
    return this.check();
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

    const notes: string[] = [];
    const branch = this.config.get<string>('RENDER_GIT_BRANCH');
    const instance = this.config.get<string>('RENDER_INSTANCE_ID');
    if (branch) notes.push(`branch=${branch}`);
    if (instance) notes.push(`instance=${instance}`);

    const description = tier
      ? `synctip API health (${tier})`
      : 'synctip API health';

    return {
      status,
      version: this.config.get<string>('SERVICE_VERSION') ?? '1',
      releaseId,
      serviceId,
      ...(tier ? { tier } : {}),
      description,
      ...(notes.length > 0 ? { notes } : {}),
      checks,
    };
  }
}
