import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';

@Injectable()
export class PermanentDeleteGuard implements CanActivate {
  private readonly expectedKey: Buffer;

  constructor(configService: ConfigService) {
    const configuration =
      configService.getOrThrow<StorageConfiguration>('storage');
    this.expectedKey = Buffer.from(configuration.hardDeleteAdminKey);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const suppliedKey = request.get('x-admin-key');
    if (!suppliedKey) {
      throw new FileMediaError(
        FileMediaErrorCode.ADMIN_KEY_REQUIRED,
        'x-admin-key is required for permanent deletion',
      );
    }

    const suppliedKeyBuffer = Buffer.from(suppliedKey);
    if (
      suppliedKeyBuffer.length !== this.expectedKey.length ||
      !timingSafeEqual(suppliedKeyBuffer, this.expectedKey)
    ) {
      throw new FileMediaError(
        FileMediaErrorCode.ADMIN_KEY_INVALID,
        'The permanent deletion credential is invalid',
      );
    }

    return true;
  }
}
