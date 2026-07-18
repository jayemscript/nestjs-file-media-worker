import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
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
const SECOND_FILE_ID = '507f1f77bcf86cd799439012';
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

function metadata(
  status = FileStatus.ACTIVE,
  id = FILE_ID,
): FileMetadataRecord {
  return {
    id,
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

  it('returns per-file results for bulk metadata retrieval', async () => {
    repository.findActiveByIdAndAppId
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(null);

    await expect(
      service.getBulkMetadata('merchant-portal', [FILE_ID, SECOND_FILE_ID]),
    ).resolves.toEqual({
      successful: [expect.objectContaining({ fileId: FILE_ID })],
      failed: [
        {
          fileId: SECOND_FILE_ID,
          code: FileMediaErrorCode.FILE_NOT_FOUND,
          message: 'File not found',
        },
      ],
    });
  });

  it('rejects duplicate IDs for bulk operations', async () => {
    await expect(
      service.getBulkMetadata('merchant-portal', [FILE_ID, FILE_ID]),
    ).rejects.toMatchObject({ code: FileMediaErrorCode.INVALID_FILE_ID });
    expect(repository.findActiveByIdAndAppId).not.toHaveBeenCalled();
  });

  it('preflights every bulk download before opening streams', async () => {
    repository.findActiveByIdAndAppId
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(null);
    storage.objectExists.mockResolvedValue(true);

    await expect(
      service.downloadFiles('merchant-portal', [FILE_ID, SECOND_FILE_ID]),
    ).rejects.toMatchObject({ code: FileMediaErrorCode.FILE_NOT_FOUND });
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('opens each verified file for a bulk download', async () => {
    repository.findActiveByIdAndAppId
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(metadata(FileStatus.ACTIVE, SECOND_FILE_ID));
    storage.objectExists.mockResolvedValue(true);
    storage.openReadStream.mockImplementation(() =>
      Promise.resolve({
        stream: Readable.from('content'),
        size: 8,
      }),
    );

    const downloads = await service.downloadFiles('merchant-portal', [
      FILE_ID,
      SECOND_FILE_ID,
    ]);

    expect(downloads.map(({ fileId }) => fileId)).toEqual([
      FILE_ID,
      SECOND_FILE_ID,
    ]);
    expect(storage.openReadStream).toHaveBeenCalledTimes(2);
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

  it('returns partial results for bulk soft deletion', async () => {
    repository.markDeleted
      .mockResolvedValueOnce(metadata(FileStatus.DELETED))
      .mockResolvedValueOnce(null);
    repository.findByIdAndAppId.mockResolvedValueOnce(null);

    await expect(
      service.softDeleteFiles('merchant-portal', [FILE_ID, SECOND_FILE_ID]),
    ).resolves.toEqual({
      successful: [
        expect.objectContaining({
          fileId: FILE_ID,
          status: FileStatus.DELETED,
        }),
      ],
      failed: [
        expect.objectContaining({
          fileId: SECOND_FILE_ID,
          code: FileMediaErrorCode.FILE_NOT_FOUND,
        }),
      ],
    });
  });

  it('recovers multiple deleted files sequentially', async () => {
    repository.findByIdAndAppId
      .mockResolvedValueOnce(metadata(FileStatus.DELETED))
      .mockResolvedValueOnce(metadata(FileStatus.DELETED, SECOND_FILE_ID));
    storage.objectExists.mockResolvedValue(true);
    repository.recover
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(metadata(FileStatus.ACTIVE, SECOND_FILE_ID));

    const result = await service.recoverFiles('merchant-portal', [
      FILE_ID,
      SECOND_FILE_ID,
    ]);

    expect(result.successful).toHaveLength(2);
    expect(result.failed).toEqual([]);
    expect(repository.recover).toHaveBeenCalledTimes(2);
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
