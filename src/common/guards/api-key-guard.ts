import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { REQUIRE_API_KEY } from '../decorators/require-api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const explicitlyRequired =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_API_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    const globallyRequired =
      this.configService
        .get<string>('API_KEY_REQUIRED', 'false')
        .toLowerCase() === 'true';

    if (!explicitlyRequired && !globallyRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const headerApiKey = this.getHeaderValue(request.headers['x-api-key']);
    const apiKey =
      headerApiKey ??
      (explicitlyRequired
        ? undefined
        : this.getQueryValue(request.query.api_key));

    const validKeys = this.configService
      .get<string>('API_KEYS', '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);

    if (!apiKey || !validKeys.some((key) => this.keysMatch(key, apiKey))) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }

  private getHeaderValue(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private getQueryValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private keysMatch(expected: string, supplied: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    return (
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer)
    );
  }
}
