import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';
import { PermanentDeleteGuard } from './permanent-delete.guard';

const ADMIN_KEY = 'a-long-development-admin-key';

function createGuard(): PermanentDeleteGuard {
  const configuration: StorageConfiguration = {
    provider: 'local',
    localRoot: './upload',
    maxFileSizeBytes: 1024,
    maxBulkFileCount: 2,
    maxBulkTotalSizeBytes: 2048,
    allowedMimeTypes: ['image/png'],
    hardDeleteAdminKey: ADMIN_KEY,
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(configuration),
  } as unknown as ConfigService;
  return new PermanentDeleteGuard(configService);
}

function contextWithKey(key?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ get: () => key }),
    }),
  } as unknown as ExecutionContext;
}

function captureFileMediaError(action: () => unknown): FileMediaError {
  try {
    action();
  } catch (error) {
    if (error instanceof FileMediaError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a FileMediaError');
}

describe('PermanentDeleteGuard', () => {
  it('accepts the configured admin key', () => {
    expect(createGuard().canActivate(contextWithKey(ADMIN_KEY))).toBe(true);
  });

  it('rejects a missing key', () => {
    const error = captureFileMediaError(() =>
      createGuard().canActivate(contextWithKey()),
    );
    expect(error.code).toBe(FileMediaErrorCode.ADMIN_KEY_REQUIRED);
  });

  it('rejects an invalid key', () => {
    const error = captureFileMediaError(() =>
      createGuard().canActivate(contextWithKey('invalid')),
    );
    expect(error.code).toBe(FileMediaErrorCode.ADMIN_KEY_INVALID);
  });
});
