import { Controller, Get, Header, HttpStatus, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionService } from '../auth/session.service';
import { HealthService } from './health.service';
import { HEALTH_CONTENT_TYPE } from './health.types';
import type { HealthResponse } from './health.types';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly session: SessionService,
  ) {}

  /**
   * Aggregate health check — datastore + system.
   * Returns 200 on `pass`/`warn`, 503 on `fail`.
   * Response body follows the IETF "Health Check Response Format" draft.
   *
   * The endpoint is intentionally PUBLIC so Render's health probes (and
   * any external uptime monitor) can hit it without credentials. We
   * redact privileged deployment metadata for non-privileged callers
   * inside the service layer.
   */
  @Get()
  @Header('Content-Type', HEALTH_CONTENT_TYPE)
  @Header('Cache-Control', 'max-age=3, must-revalidate')
  async check(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponse> {
    const role = await this.session.getRole(req);
    const result = await this.healthService.check({ role });
    this.applyStatus(res, result);
    return result;
  }

  /** Liveness probe — does NOT depend on external services. */
  @Get('live')
  @Header('Content-Type', HEALTH_CONTENT_TYPE)
  async live(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponse> {
    const role = await this.session.getRole(req);
    const result = this.healthService.liveness({ role });
    this.applyStatus(res, result);
    return result;
  }

  /** Readiness probe — includes downstream checks (DB, etc.). */
  @Get('ready')
  @Header('Content-Type', HEALTH_CONTENT_TYPE)
  async ready(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponse> {
    const role = await this.session.getRole(req);
    const result = await this.healthService.readiness({ role });
    this.applyStatus(res, result);
    return result;
  }

  private applyStatus(res: Response, result: HealthResponse): void {
    if (result.status === 'fail') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
