import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKeyRequired =
      this.configService
        .get<string>('API_KEY_REQUIRED', 'false')
        .toLowerCase() === 'true';

    // Skip API-key validation when disabled.
    if (!apiKeyRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const apiKey =
      this.getHeaderValue(request.headers['x-api-key']) ??
      this.getQueryValue(request.query.api_key);

    const validKeys = this.configService
      .get<string>('API_KEYS', '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);

    if (!apiKey || !validKeys.includes(apiKey)) {
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
}
