//src/common/guards/api-key.guards.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const isRequired = this.configService.get('API_KEY_REQUIRED') === 'true';

    if (!isRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const validKeys = this.configService.get('API_KEYS', '').split(',');

    if (!validKeys.includes(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
