import { Injectable } from '@nestjs/common';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';

const APP_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;

@Injectable()
export class AppContextService {
  requireAppId(value: unknown): string {
    if (
      typeof value !== 'string' ||
      value.trim() !== value ||
      !APP_ID_PATTERN.test(value)
    ) {
      throw new FileMediaError(
        FileMediaErrorCode.INVALID_APP_ID,
        'x-app-id must be a lowercase application slug of 1 to 63 characters',
      );
    }

    return value;
  }
}
