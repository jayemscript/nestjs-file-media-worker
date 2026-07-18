import { ConfigService } from '@nestjs/config';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';
import type { StorageProvider } from '../../storage/interfaces/storage-provider.interface';
import {
  FileMetadataRecord,
  FileStatus,
  FileType,
} from '../domain/file-metadata';
import { IncomingFile, ValidatedFile } from '../domain/file-operations';
import type { FileMetadataRepository } from '../repositories/file-metadata.repository.interface';
import { AppContextService } from './app-context.service';
import { FileValidationService } from './file-validation.service';
import { FilesService } from './files.service';

const NOW = new Date('2026-07-18T00:00:00.000Z');
const FILE_ID = '507f1f77bcf86cd799439011';
const STORAGE_KEY = 'merchant-portal/image/2026/07/file.png';

const incomingFile: IncomingFile = {
  originalName: 'avatar.png',
  declaredMimeType: 'image/png',
  size: 8,
  buffer: Buffer.from('png-data'),
};

const validatedFile: ValidatedFile = {
  ...incomingFile,
  originalName: 'avatar.png',
  mimeType: 'image/png',
  extension: 'png',
  fileType: FileType.IMAGE,
  checksum: 'checksum',
};

function metadata(status = FileStatus.ACTIVE): FileMetadataRecord {
  return {
    id: FILE_ID,
    appId: 'merchant-portal',
    originalName: 'avatar.png',
    storageKey: STORAGE_KEY,
    storageProvider: 'local',
    fileType: FileType.IMAGE,
    mimeType: 'image/png',
    extension: 'png',
    size: 8,
    checksum: 'checksum',
    status,
    ...(status === FileStatus.DELETED ? { deletedAt: NOW } : {}),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('FilesService', () => {
  let service: FilesService;
  let repository: jest.Mocked<FileMetadataRepository>;
  let storage: jest.Mocked<StorageProvider>;
  let validation: jest.Mocked<FileValidationService>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByIdAndAppId: jest.fn(),
      findActiveByIdAndAppId: jest.fn(),
      markDeleted: jest.fn(),
      recover: jest.fn(),
      claimForPurge: jest.fn(),
      restoreDeletedAfterPurgeFailure: jest.fn(),
      deletePurging: jest.fn(),
    };
    storage = {
      name: 'local',
      putObject: jest.fn(),
      openReadStream: jest.fn(),
      objectExists: jest.fn(),
      deleteObject: jest.fn(),
      checkHealth: jest.fn(),
    };
    validation = {
      validate: jest.fn(),
      generateStorageKey: jest.fn(),
      sanitizeOriginalName: jest.fn((name: string) => name),
    } as unknown as jest.Mocked<FileValidationService>;
    const configuration: StorageConfiguration = {
      provider: 'local',
      localRoot: './upload',
      maxFileSizeBytes: 1024,
      maxBulkFileCount: 2,
      maxBulkTotalSizeBytes: 2048,
      allowedMimeTypes: ['image/png'],
      hardDeleteAdminKey: 'a-long-development-key',
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(configuration),
    } as unknown as ConfigService;

    service = new FilesService(
      repository,
      storage,
      validation,
      new AppContextService(),
      configService,
    );
    validation.validate.mockResolvedValue(validatedFile);
    validation.generateStorageKey.mockReturnValue(STORAGE_KEY);
    storage.putObject.mockResolvedValue({ key: STORAGE_KEY, size: 8 });
    storage.deleteObject.mockResolvedValue();
    repository.create.mockResolvedValue(metadata());
  });

  it('stores content before metadata and returns no provider details', async () => {
    await expect(
      service.uploadFile('merchant-portal', incomingFile),
    ).resolves.toEqual(
      expect.objectContaining({
        fileId: FILE_ID,
        appId: 'merchant-portal',
        originalName: 'avatar.png',
      }),
    );
    expect(storage.putObject).toHaveBeenCalledWith({
      key: STORAGE_KEY,
      body: incomingFile.buffer,
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'merchant-portal',
        storageKey: STORAGE_KEY,
      }),
    );
    expect(
      await service.uploadFile('merchant-portal', incomingFile),
    ).not.toHaveProperty('storageKey');
  });

  it('compensates storage when metadata persistence fails', async () => {
    repository.create.mockRejectedValue(
      new FileMediaError(
        FileMediaErrorCode.PERSISTENCE_OPERATION_FAILED,
        'persistence failed',
      ),
    );

    await expect(
      service.uploadFile('merchant-portal', incomingFile),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.PERSISTENCE_OPERATION_FAILED,
    });
    expect(storage.deleteObject).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('returns per-file results for a partially successful bulk upload', async () => {
    validation.validate
      .mockResolvedValueOnce(validatedFile)
      .mockRejectedValueOnce(
        new FileMediaError(
          FileMediaErrorCode.UNSUPPORTED_FILE_TYPE,
          'unsupported',
        ),
      );

    const result = await service.uploadFiles('merchant-portal', [
      incomingFile,
      { ...incomingFile, originalName: 'bad.exe' },
    ]);

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toEqual([
      {
        originalName: 'bad.exe',
        code: FileMediaErrorCode.UNSUPPORTED_FILE_TYPE,
        message: 'unsupported',
      },
    ]);
  });

  it('scopes metadata retrieval by appId and hides misses', async () => {
    repository.findActiveByIdAndAppId.mockResolvedValue(null);

    await expect(
      service.getMetadata('other-app', FILE_ID),
    ).rejects.toMatchObject({ code: FileMediaErrorCode.FILE_NOT_FOUND });
    expect(repository.findActiveByIdAndAppId).toHaveBeenCalledWith(
      FILE_ID,
      'other-app',
    );
  });

  it('prevents recovery when the storage object is missing', async () => {
    repository.findByIdAndAppId.mockResolvedValue(metadata(FileStatus.DELETED));
    storage.objectExists.mockResolvedValue(false);

    await expect(
      service.recoverFile('merchant-portal', FILE_ID),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.FILE_NOT_RECOVERABLE,
    });
    expect(repository.recover).not.toHaveBeenCalled();
  });

  it('requires soft deletion before permanent deletion', async () => {
    repository.claimForPurge.mockResolvedValue(null);
    repository.findByIdAndAppId.mockResolvedValue(metadata());

    await expect(
      service.permanentlyDeleteFile('merchant-portal', FILE_ID),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.FILE_MUST_BE_DELETED,
    });
  });

  it('restores deleted status when physical deletion fails', async () => {
    repository.claimForPurge.mockResolvedValue(metadata(FileStatus.PURGING));
    storage.deleteObject.mockRejectedValue(
      new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'storage failed',
      ),
    );

    await expect(
      service.permanentlyDeleteFile('merchant-portal', FILE_ID),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.STORAGE_OPERATION_FAILED,
    });
    expect(repository.restoreDeletedAfterPurgeFailure).toHaveBeenCalledWith(
      FILE_ID,
      'merchant-portal',
    );
  });
});
