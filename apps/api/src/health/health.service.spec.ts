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
});
