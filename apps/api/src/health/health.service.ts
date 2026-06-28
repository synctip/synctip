import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
    HealthCheck,
    HealthResponse,
    HealthStatus,
} from './health.types';

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
                        output: err instanceof Error ? err.message : String(err),
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
        return {
            status,
            version: this.config.get<string>('SERVICE_VERSION') ?? '1',
            releaseId:
                this.config.get<string>('RELEASE_ID') ??
                this.config.get<string>('npm_package_version') ??
                '0.0.0',
            serviceId: this.config.get<string>('SERVICE_ID') ?? 'synctip-api',
            description: 'synctip API health',
            checks,
        };
    }
}
