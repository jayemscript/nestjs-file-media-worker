import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import {
  CreateFileMetadata,
  FileMetadataRecord,
  FileStatus,
} from '../domain/file-metadata';
import {
  FileMetadataDocument,
  FileMetadataHydratedDocument,
} from '../schemas/file-metadata.schema';
import { FileMetadataRepository } from './file-metadata.repository.interface';

@Injectable()
export class MongooseFileMetadataRepository implements FileMetadataRepository {
  constructor(
    @InjectModel(FileMetadataDocument.name)
    private readonly model: Model<FileMetadataDocument>,
  ) {}

  async create(input: CreateFileMetadata): Promise<FileMetadataRecord> {
    return this.execute(async () => {
      const document = await new this.model(input).save();
      return this.toRecord(document);
    });
  }

  async findByIdAndAppId(
    fileId: string,
    appId: string,
  ): Promise<FileMetadataRecord | null> {
    return this.execute(async () => {
      const document = await this.model.findOne({ _id: fileId, appId }).exec();
      return document ? this.toRecord(document) : null;
    });
  }

  async findActiveByIdAndAppId(
    fileId: string,
    appId: string,
  ): Promise<FileMetadataRecord | null> {
    return this.execute(async () => {
      const document = await this.model
        .findOne({ _id: fileId, appId, status: FileStatus.ACTIVE })
        .exec();
      return document ? this.toRecord(document) : null;
    });
  }

  async markDeleted(
    fileId: string,
    appId: string,
    deletedAt: Date,
    deletedBy?: string,
  ): Promise<FileMetadataRecord | null> {
    return this.execute(async () => {
      const document = await this.model
        .findOneAndUpdate(
          { _id: fileId, appId, status: FileStatus.ACTIVE },
          {
            $set: {
              status: FileStatus.DELETED,
              deletedAt,
              ...(deletedBy ? { deletedBy } : {}),
            },
          },
          { new: true },
        )
        .exec();
      return document ? this.toRecord(document) : null;
    });
  }

  async recover(
    fileId: string,
    appId: string,
    recoveredAt: Date,
  ): Promise<FileMetadataRecord | null> {
    return this.execute(async () => {
      const document = await this.model
        .findOneAndUpdate(
          { _id: fileId, appId, status: FileStatus.DELETED },
          {
            $set: { status: FileStatus.ACTIVE, recoveredAt },
            $unset: { deletedAt: 1, deletedBy: 1 },
          },
          { new: true },
        )
        .exec();
      return document ? this.toRecord(document) : null;
    });
  }

  async claimForPurge(
    fileId: string,
    appId: string,
  ): Promise<FileMetadataRecord | null> {
    return this.execute(async () => {
      const claimed = await this.model
        .findOneAndUpdate(
          { _id: fileId, appId, status: FileStatus.DELETED },
          { $set: { status: FileStatus.PURGING } },
          { new: true },
        )
        .exec();

      if (claimed) {
        return this.toRecord(claimed);
      }

      const existingClaim = await this.model
        .findOne({ _id: fileId, appId, status: FileStatus.PURGING })
        .exec();
      return existingClaim ? this.toRecord(existingClaim) : null;
    });
  }

  async restoreDeletedAfterPurgeFailure(
    fileId: string,
    appId: string,
  ): Promise<void> {
    await this.execute(async () => {
      await this.model
        .updateOne(
          { _id: fileId, appId, status: FileStatus.PURGING },
          { $set: { status: FileStatus.DELETED } },
        )
        .exec();
    });
  }

  async deletePurging(fileId: string, appId: string): Promise<boolean> {
    return this.execute(async () => {
      const result = await this.model
        .deleteOne({ _id: fileId, appId, status: FileStatus.PURGING })
        .exec();
      return result.deletedCount === 1;
    });
  }

  private toRecord(document: FileMetadataHydratedDocument): FileMetadataRecord {
    return {
      id: document._id.toString(),
      appId: document.appId,
      originalName: document.originalName,
      storageKey: document.storageKey,
      storageProvider: document.storageProvider,
      fileType: document.fileType,
      mimeType: document.mimeType,
      extension: document.extension,
      size: document.size,
      checksum: document.checksum,
      status: document.status,
      ...(document.uploadedBy ? { uploadedBy: document.uploadedBy } : {}),
      ...(document.deletedAt ? { deletedAt: document.deletedAt } : {}),
      ...(document.deletedBy ? { deletedBy: document.deletedBy } : {}),
      ...(document.recoveredAt ? { recoveredAt: document.recoveredAt } : {}),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof FileMediaError &&
        error.code === FileMediaErrorCode.PERSISTENCE_OPERATION_FAILED
      ) {
        throw error;
      }

      throw new FileMediaError(
        FileMediaErrorCode.PERSISTENCE_OPERATION_FAILED,
        'File metadata could not be persisted',
        { cause: error },
      );
    }
  }
}
