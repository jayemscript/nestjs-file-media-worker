import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';
import { STORAGE_PROVIDER } from '../../storage/storage.constants';
import type { StorageProvider } from '../../storage/interfaces/storage-provider.interface';
import {
  FileMetadataRecord,
  FileStatus,
  PublicFileMetadata,
} from '../domain/file-metadata';
import {
  BulkUploadResult,
  DownloadFileResult,
  IncomingFile,
  PermanentDeleteResult,
} from '../domain/file-operations';
import { FILE_METADATA_REPOSITORY } from '../repositories/file-metadata.repository.interface';
import type { FileMetadataRepository } from '../repositories/file-metadata.repository.interface';
import { AppContextService } from './app-context.service';
import { FileValidationService } from './file-validation.service';

const MONGODB_OBJECT_ID = /^[a-f\d]{24}$/i;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly maxBulkFileCount: number;
  private readonly maxBulkTotalSizeBytes: number;

  constructor(
    @Inject(FILE_METADATA_REPOSITORY)
    private readonly repository: FileMetadataRepository,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
    private readonly validationService: FileValidationService,
    private readonly appContextService: AppContextService,
    configService: ConfigService,
  ) {
    const configuration =
      configService.getOrThrow<StorageConfiguration>('storage');
    this.maxBulkFileCount = configuration.maxBulkFileCount;
    this.maxBulkTotalSizeBytes = configuration.maxBulkTotalSizeBytes;
  }

  async uploadFile(
    appIdValue: unknown,
    file?: IncomingFile,
  ): Promise<PublicFileMetadata> {
    const appId = this.appContextService.requireAppId(appIdValue);
    if (!file) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_REQUIRED,
        'A multipart file field named file is required',
      );
    }

    const validatedFile = await this.validationService.validate(file);
    const storageKey = this.validationService.generateStorageKey(
      appId,
      validatedFile,
    );
    const storedObject = await this.storageProvider.putObject({
      key: storageKey,
      body: validatedFile.buffer,
    });

    if (storedObject.size !== validatedFile.size) {
      await this.compensateStorage(storageKey);
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The stored object size did not match the upload',
      );
    }

    try {
      const metadata = await this.repository.create({
        appId,
        originalName: validatedFile.originalName,
        storageKey,
        storageProvider: this.storageProvider.name,
        fileType: validatedFile.fileType,
        mimeType: validatedFile.mimeType,
        extension: validatedFile.extension,
        size: validatedFile.size,
        checksum: validatedFile.checksum,
      });
      return this.toPublicMetadata(metadata);
    } catch (error) {
      await this.compensateStorage(storageKey);
      throw error;
    }
  }

  async uploadFiles(
    appIdValue: unknown,
    files?: IncomingFile[],
  ): Promise<BulkUploadResult> {
    const appId = this.appContextService.requireAppId(appIdValue);
    if (!files || files.length === 0) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_REQUIRED,
        'At least one multipart file field named files is required',
      );
    }
    if (files.length > this.maxBulkFileCount) {
      throw new FileMediaError(
        FileMediaErrorCode.BULK_LIMIT_EXCEEDED,
        `Bulk upload accepts at most ${this.maxBulkFileCount} files`,
      );
    }

    const totalSize = files.reduce((sum, file) => sum + file.buffer.length, 0);
    if (totalSize > this.maxBulkTotalSizeBytes) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_TOO_LARGE,
        `Bulk upload exceeds the ${this.maxBulkTotalSizeBytes}-byte aggregate limit`,
      );
    }

    const result: BulkUploadResult = { successful: [], failed: [] };
    for (const file of files) {
      try {
        result.successful.push(await this.uploadFile(appId, file));
      } catch (error) {
        const normalizedError = this.normalizeBulkError(error);
        result.failed.push({
          originalName: this.validationService.sanitizeOriginalName(
            file.originalName,
          ),
          ...normalizedError,
        });
      }
    }

    return result;
  }

  async getMetadata(
    appIdValue: unknown,
    fileId: string,
  ): Promise<PublicFileMetadata> {
    const appId = this.appContextService.requireAppId(appIdValue);
    this.assertFileId(fileId);
    const metadata = await this.repository.findActiveByIdAndAppId(
      fileId,
      appId,
    );
    if (!metadata) {
      throw this.fileNotFoundError();
    }
    return this.toPublicMetadata(metadata);
  }

  async downloadFile(
    appIdValue: unknown,
    fileId: string,
  ): Promise<DownloadFileResult> {
    const appId = this.appContextService.requireAppId(appIdValue);
    this.assertFileId(fileId);
    const metadata = await this.repository.findActiveByIdAndAppId(
      fileId,
      appId,
    );
    if (
      !metadata ||
      !(await this.storageProvider.objectExists(metadata.storageKey))
    ) {
      throw this.fileNotFoundError();
    }
    const storedObject = await this.storageProvider.openReadStream(
      metadata.storageKey,
    );
    return {
      stream: storedObject.stream,
      size: storedObject.size,
      mimeType: metadata.mimeType,
      originalName: metadata.originalName,
    };
  }

  async softDeleteFile(
    appIdValue: unknown,
    fileId: string,
  ): Promise<PublicFileMetadata> {
    const appId = this.appContextService.requireAppId(appIdValue);
    this.assertFileId(fileId);
    const deleted = await this.repository.markDeleted(
      fileId,
      appId,
      new Date(),
    );
    if (deleted) {
      return this.toPublicMetadata(deleted);
    }

    const existing = await this.repository.findByIdAndAppId(fileId, appId);
    if (!existing) {
      throw this.fileNotFoundError();
    }
    throw new FileMediaError(
      FileMediaErrorCode.FILE_ALREADY_DELETED,
      'The file is already deleted or being permanently deleted',
    );
  }

  async recoverFile(
    appIdValue: unknown,
    fileId: string,
  ): Promise<PublicFileMetadata> {
    const appId = this.appContextService.requireAppId(appIdValue);
    this.assertFileId(fileId);
    const existing = await this.repository.findByIdAndAppId(fileId, appId);
    if (!existing) {
      throw this.fileNotFoundError();
    }
    if (
      existing.status !== FileStatus.DELETED ||
      !(await this.storageProvider.objectExists(existing.storageKey))
    ) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_NOT_RECOVERABLE,
        'The file cannot be recovered',
      );
    }

    const recovered = await this.repository.recover(fileId, appId, new Date());
    if (!recovered) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_NOT_RECOVERABLE,
        'The file can no longer be recovered',
      );
    }
    return this.toPublicMetadata(recovered);
  }

  async permanentlyDeleteFile(
    appIdValue: unknown,
    fileId: string,
  ): Promise<PermanentDeleteResult> {
    const appId = this.appContextService.requireAppId(appIdValue);
    this.assertFileId(fileId);
    const claimed = await this.repository.claimForPurge(fileId, appId);
    if (!claimed) {
      const existing = await this.repository.findByIdAndAppId(fileId, appId);
      if (!existing) {
        throw this.fileNotFoundError();
      }
      throw new FileMediaError(
        FileMediaErrorCode.FILE_MUST_BE_DELETED,
        'The file must be soft-deleted before permanent deletion',
      );
    }

    try {
      await this.storageProvider.deleteObject(claimed.storageKey);
    } catch (error) {
      try {
        await this.repository.restoreDeletedAfterPurgeFailure(fileId, appId);
      } catch (restoreError) {
        this.logger.error(
          `Failed to restore purge state for file ${fileId}`,
          restoreError instanceof Error ? restoreError.stack : undefined,
        );
      }
      throw error;
    }

    await this.repository.deletePurging(fileId, appId);
    return { fileId, permanentlyDeleted: true };
  }

  private async compensateStorage(storageKey: string): Promise<void> {
    try {
      await this.storageProvider.deleteObject(storageKey);
    } catch (error) {
      this.logger.error(
        'Failed to compensate a stored object after metadata failure',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private assertFileId(fileId: string): void {
    if (!MONGODB_OBJECT_ID.test(fileId)) {
      throw new FileMediaError(
        FileMediaErrorCode.INVALID_FILE_ID,
        'fileId must be a valid MongoDB ObjectId',
      );
    }
  }

  private fileNotFoundError(): FileMediaError {
    return new FileMediaError(
      FileMediaErrorCode.FILE_NOT_FOUND,
      'File not found',
    );
  }

  private toPublicMetadata(metadata: FileMetadataRecord): PublicFileMetadata {
    if (metadata.status === FileStatus.PURGING) {
      throw this.fileNotFoundError();
    }

    return {
      fileId: metadata.id,
      appId: metadata.appId,
      originalName: metadata.originalName,
      fileType: metadata.fileType,
      mimeType: metadata.mimeType,
      extension: metadata.extension,
      size: metadata.size,
      status: metadata.status,
      uploadedAt: metadata.createdAt,
      ...(metadata.deletedAt ? { deletedAt: metadata.deletedAt } : {}),
      ...(metadata.recoveredAt ? { recoveredAt: metadata.recoveredAt } : {}),
    };
  }

  private normalizeBulkError(error: unknown): {
    code: FileMediaErrorCode | 'UPLOAD_FAILED';
    message: string;
  } {
    if (error instanceof FileMediaError) {
      return { code: error.code, message: error.message };
    }
    return { code: 'UPLOAD_FAILED', message: 'The file could not be uploaded' };
  }
}
