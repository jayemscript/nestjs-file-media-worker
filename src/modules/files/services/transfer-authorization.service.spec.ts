import { ConfigService } from '@nestjs/config';
import { FileMediaErrorCode } from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';
import { TransferConfiguration } from '../../../config/transfer.config';
import { IncomingFile } from '../domain/file-operations';
import { TransferOperation } from '../domain/transfer-authorization';
import type { TransferAuthorizationRepository } from '../repositories/transfer-authorization.repository.interface';
import { AppContextService } from './app-context.service';
import { FilesService } from './files.service';
import { TransferAuthorizationService } from './transfer-authorization.service';

const NOW = new Date('2026-07-23T00:00:00.000Z');
const FILE_ID = '507f1f77bcf86cd799439011';
const SIGNING_KEY = 'test-transfer-signing-key-at-least-32-characters';

const file: IncomingFile = {
  originalName: 'avatar.png',
  declaredMimeType: 'image/png',
  size: 8,
  buffer: Buffer.from('png-data'),
};

describe('TransferAuthorizationService', () => {
  let service: TransferAuthorizationService;
  let repository: jest.Mocked<TransferAuthorizationRepository>;
  let filesService: jest.Mocked<
    Pick<FilesService, 'ensureFileDownloadable'>
  >;
  let transferConfiguration: TransferConfiguration;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    repository = {
      create: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(true),
    };
    filesService = {
      ensureFileDownloadable: jest.fn().mockResolvedValue(undefined),
    };
    transferConfiguration = {
      enabled: true,
      publicBaseUrl: 'https://files.example.test/',
      signingKey: SIGNING_KEY,
      tokenTtlSeconds: 300,
      rateLimitMax: 30,
      rateLimitWindowSeconds: 60,
    };
    const storageConfiguration: StorageConfiguration = {
      provider: 'local',
      localRoot: './upload',
      maxFileSizeBytes: 1024,
      maxBulkFileCount: 2,
      maxBulkTotalSizeBytes: 2048,
      allowedMimeTypes: ['image/png', 'application/pdf'],
      hardDeleteAdminKey: 'a-long-development-key',
    };
    const configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'transfer' ? transferConfiguration : storageConfiguration,
      ),
    } as unknown as ConfigService;

    service = new TransferAuthorizationService(
      repository,
      new AppContextService(),
      filesService as unknown as FilesService,
      configService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues a scoped upload authorization without exposing the signing key', async () => {
    const authorization = await service.authorizeUpload('admin-portal', {
      maxSizeBytes: 512,
      allowedMimeTypes: ['image/png'],
    });

    expect(authorization).toEqual(
      expect.objectContaining({
        url: 'https://files.example.test/files/authorized-upload',
        method: 'POST',
        expiresAt: new Date('2026-07-23T00:05:00.000Z'),
        requiresFinalization: false,
      }),
    );
    expect(authorization.headers.Authorization).toMatch(/^Bearer v1\./);
    expect(JSON.stringify(authorization)).not.toContain(SIGNING_KEY);
    expect(repository.create).toHaveBeenCalledTimes(1);
    const persistedAuthorization = repository.create.mock.calls[0]?.[0];
    expect(persistedAuthorization?.tokenIdHash).toMatch(/^[a-f\d]{64}$/);
    expect(persistedAuthorization).toMatchObject({
      appId: 'admin-portal',
      operation: TransferOperation.UPLOAD,
    });
  });

  it('consumes an upload authorization exactly once', async () => {
    const authorization = await service.authorizeUpload('admin-portal', {});
    const token = authorization.headers.Authorization.replace('Bearer ', '');

    await expect(service.consumeUpload(token, file)).resolves.toBe(
      'admin-portal',
    );
    expect(repository.consume).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f\d]{64}$/),
      'admin-portal',
      TransferOperation.UPLOAD,
      NOW,
    );

    repository.consume.mockResolvedValueOnce(false);
    await expect(service.consumeUpload(token, file)).rejects.toMatchObject({
      code: FileMediaErrorCode.TRANSFER_AUTHORIZATION_USED,
    });
  });

  it('rejects tampered and expired tokens', async () => {
    const authorization = await service.authorizeUpload('admin-portal', {});
    const token = authorization.headers.Authorization.replace('Bearer ', '');

    await expect(
      service.consumeUpload(`${token}x`, file),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID,
    });

    jest.advanceTimersByTime(301_000);
    await expect(service.consumeUpload(token, file)).rejects.toMatchObject({
      code: FileMediaErrorCode.TRANSFER_AUTHORIZATION_EXPIRED,
    });
  });

  it('enforces upload constraints before consuming the token', async () => {
    const authorization = await service.authorizeUpload('admin-portal', {
      maxSizeBytes: 4,
      allowedMimeTypes: ['image/png'],
    });
    const token = authorization.headers.Authorization.replace('Bearer ', '');

    await expect(service.consumeUpload(token, file)).rejects.toMatchObject({
      code: FileMediaErrorCode.FILE_TOO_LARGE,
    });
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it('binds a download authorization to one app and file ID', async () => {
    const authorization = await service.authorizeDownload(
      'admin-portal',
      FILE_ID,
    );
    const token = authorization.headers.Authorization.replace('Bearer ', '');

    expect(filesService.ensureFileDownloadable).toHaveBeenCalledWith(
      'admin-portal',
      FILE_ID,
    );
    await expect(
      service.consumeDownload(token, '507f1f77bcf86cd799439012'),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID,
    });
    expect(repository.consume).not.toHaveBeenCalled();

    await expect(service.consumeDownload(token, FILE_ID)).resolves.toBe(
      'admin-portal',
    );
  });

  it('rejects authorization requests outside configured upload limits', async () => {
    await expect(
      service.authorizeUpload('admin-portal', { maxSizeBytes: 1025 }),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID_REQUEST,
    });
    await expect(
      service.authorizeUpload('admin-portal', {
        allowedMimeTypes: ['application/zip'],
      }),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID_REQUEST,
    });
  });

  it('rejects all operations when the feature is disabled', async () => {
    transferConfiguration.enabled = false;

    await expect(
      service.authorizeUpload('admin-portal', {}),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.TRANSFER_AUTHORIZATION_DISABLED,
    });
  });
});
