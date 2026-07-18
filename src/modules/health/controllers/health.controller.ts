import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from '../health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  liveness() {
    return this.healthService.liveness();
  }

  @Get()
  readiness(@Res({ passthrough: true }) response: Response) {
    return this.respondWithReadiness(response);
  }

  @Get('ready')
  ready(@Res({ passthrough: true }) response: Response) {
    return this.respondWithReadiness(response);
  }

  private async respondWithReadiness(response: Response) {
    const readiness = await this.healthService.readiness();
    if (readiness.status === 'not_ready') {
      response.status(503);
    }
    return readiness;
  }
}
