import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

function buildConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => overrides[key],
  } as unknown as ConfigService;
}

describe('HealthService', () => {
  let service: HealthService;
  let prismaMock: { $queryRaw: ReturnType<typeof mock> };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: mock(() => Promise.resolve([{ ok: 1 }])),
    };

    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: buildConfig() },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns pass when datastore responds', async () => {
    const result = await service.check();

    expect(result.status).toBe('pass');
    expect(result.checks?.['db:responseTime']?.[0]?.status).toBe('pass');
    expect(result.serviceId).toBe('synctip-api');
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns fail when datastore throws', async () => {
    prismaMock.$queryRaw = mock(() =>
      Promise.reject(new Error('connection refused')),
    );

    const result = await service.check();

    expect(result.status).toBe('fail');
    const dbCheck = result.checks?.['db:responseTime']?.[0];
    expect(dbCheck?.status).toBe('fail');
    expect(dbCheck?.output).toContain('connection refused');
  });

  it('liveness does not touch the database', () => {
    const result = service.liveness();

    expect(result.status).toBe('pass');
    expect(result.checks?.['db:responseTime']).toBeUndefined();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(0);
  });

  it('omits tier when APP_ENV is unset', async () => {
    const result = await service.check();

    expect(result.tier).toBeUndefined();
    expect(result.description).toBe('synctip API health');
  });

  it('reflects APP_ENV in the response tier and description', async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: buildConfig({ APP_ENV: 'stage' }) },
      ],
    }).compile();
    const staged = module.get(HealthService);

    const result = await staged.check();

    expect(result.tier).toBe('stage');
    expect(result.description).toBe('synctip API health (stage)');
  });

  it('ignores an invalid APP_ENV value', async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: buildConfig({ APP_ENV: 'wat' }),
        },
      ],
    }).compile();
    const bad = module.get(HealthService);

    const result = await bad.check();

    expect(result.tier).toBeUndefined();
  });

  it('falls back to local git metadata when no provider env vars are set', async () => {
    const result = await service.check();

    // Inside the repo, the local git fallback populates these fields.
    // Tests run from inside the synctip working tree.
    expect(result.deployment?.repository).toBe('synctip/synctip');
    expect(result.deployment?.commit).toMatch(/^[0-9a-f]{40}$/);
    // No Render-specific fields when running locally.
    expect(result.deployment?.provider).toBeUndefined();
    expect(result.deployment?.serviceId).toBeUndefined();
    expect(result.deployment?.instanceId).toBeUndefined();
  });

  it('exposes live working-tree state (dirty / upstream divergence)', async () => {
    const result = await service.check();
    const deployment = result.deployment;

    // The flag is either explicitly true/false depending on the working
    // tree at test-time; assert only that the field is a boolean when
    // present (it should be — git is available in the test env).
    if (deployment?.dirty !== undefined) {
      expect(typeof deployment.dirty).toBe('boolean');
    }

    // Branches typically have an upstream when running locally inside
    // the synctip checkout. When present, divergence counts must be
    // non-negative integers; when absent, both should be omitted.
    if (deployment?.upstream) {
      expect(deployment.upstream).toMatch(/\//);
      expect(deployment.ahead).toBeGreaterThanOrEqual(0);
      expect(deployment.behind).toBeGreaterThanOrEqual(0);
    } else {
      expect(deployment?.ahead).toBeUndefined();
      expect(deployment?.behind).toBeUndefined();
    }
  });

  it('skips local-git inspection when running on a hosted provider', async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: buildConfig({ RENDER_SERVICE_ID: 'srv-abc123' }),
        },
      ],
    }).compile();
    const deployed = module.get(HealthService);

    const result = await deployed.check();

    // Live-only indicators must never appear in a provider-hosted env.
    expect(result.deployment?.dirty).toBeUndefined();
    expect(result.deployment?.upstream).toBeUndefined();
    expect(result.deployment?.ahead).toBeUndefined();
    expect(result.deployment?.behind).toBeUndefined();
  });

  it('exposes structured deployment metadata from Render env vars', async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: buildConfig({
            RENDER_SERVICE_ID: 'srv-abc123',
            RENDER_INSTANCE_ID: 'srv-abc123-hibernate-x-y',
            RENDER_SERVICE_TYPE: 'web_service',
            RENDER_GIT_COMMIT: 'de2a5a2cafebabe',
            RENDER_GIT_BRANCH: 'stage',
            RENDER_GIT_REPO_SLUG: 'synctip/synctip',
            RENDER_REGION: 'oregon',
          }),
        },
      ],
    }).compile();
    const deployed = module.get(HealthService);

    const result = await deployed.check();

    expect(result.deployment).toEqual({
      repository: 'synctip/synctip',
      branch: 'stage',
      commit: 'de2a5a2cafebabe',
      provider: 'render',
      serviceId: 'srv-abc123',
      instanceId: 'srv-abc123-hibernate-x-y',
      serviceType: 'web_service',
      region: 'oregon',
    });
    expect(result.releaseId).toBe('de2a5a2');
    // notes is no longer populated for branch/instance — they live in deployment now
    expect(result.notes).toBeUndefined();
  });

  it('prefers GIT_REPOSITORY override over RENDER_GIT_REPO_SLUG', async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: buildConfig({
            GIT_REPOSITORY: 'override/repo',
            RENDER_GIT_REPO_SLUG: 'render/slug',
          }),
        },
      ],
    }).compile();
    const overridden = module.get(HealthService);

    const result = await overridden.check();

    expect(result.deployment?.repository).toBe('override/repo');
  });
});
