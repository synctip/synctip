import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';
import { HEALTH_CONTENT_TYPE } from './health.types';
import type { HealthResponse } from './health.types';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Aggregate health check — datastore + system.
   * Returns 200 on `pass`/`warn`, 503 on `fail`.
   * Response body follows the IETF "Health Check Response Format" draft.
   */
  @Get()
  @Header('Content-Type', HEALTH_CONTENT_TYPE)
  @Header('Cache-Control', 'max-age=3, must-revalidate')
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponse> {
    const result = await this.healthService.check();
    this.applyStatus(res, result);
    return result;
  }

  /** Liveness probe — does NOT depend on external services. */
  @Get('live')
  @Header('Content-Type', HEALTH_CONTENT_TYPE)
  live(@Res({ passthrough: true }) res: Response): HealthResponse {
    const result = this.healthService.liveness();
    this.applyStatus(res, result);
    return result;
  }

  /** Readiness probe — includes downstream checks (DB, etc.). */
  @Get('ready')
  @Header('Content-Type', HEALTH_CONTENT_TYPE)
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponse> {
    const result = await this.healthService.readiness();
    this.applyStatus(res, result);
    return result;
  }

  private applyStatus(res: Response, result: HealthResponse): void {
    if (result.status === 'fail') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
