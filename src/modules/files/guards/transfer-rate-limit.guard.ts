import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import { TransferConfiguration } from '../../../config/transfer.config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class TransferRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMilliseconds: number;

  constructor(configService: ConfigService) {
    const configuration =
      configService.getOrThrow<TransferConfiguration>('transfer');
    this.maxRequests = configuration.rateLimitMax;
    this.windowMilliseconds = configuration.rateLimitWindowSeconds * 1000;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = this.entries.get(key);

    if (!current || current.resetAt <= now) {
      this.entries.set(key, {
        count: 1,
        resetAt: now + this.windowMilliseconds,
      });
      this.cleanupExpiredEntries(now);
      return true;
    }

    if (current.count >= this.maxRequests) {
      throw new FileMediaError(
        FileMediaErrorCode.TRANSFER_RATE_LIMIT_EXCEEDED,
        'Too many authorized file-transfer requests',
      );
    }

    current.count += 1;
    return true;
  }

  private cleanupExpiredEntries(now: number): void {
    if (this.entries.size < 1_000) {
      return;
    }
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
