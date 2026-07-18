import {
  CreateFileMetadata,
  FileMetadataRecord,
} from '../domain/file-metadata';

export const FILE_METADATA_REPOSITORY = Symbol('FILE_METADATA_REPOSITORY');

export interface FileMetadataRepository {
  create: (input: CreateFileMetadata) => Promise<FileMetadataRecord>;
  findByIdAndAppId: (
    fileId: string,
    appId: string,
  ) => Promise<FileMetadataRecord | null>;
  findActiveByIdAndAppId: (
    fileId: string,
    appId: string,
  ) => Promise<FileMetadataRecord | null>;
  markDeleted: (
    fileId: string,
    appId: string,
    deletedAt: Date,
    deletedBy?: string,
  ) => Promise<FileMetadataRecord | null>;
  recover: (
    fileId: string,
    appId: string,
    recoveredAt: Date,
  ) => Promise<FileMetadataRecord | null>;
  claimForPurge: (
    fileId: string,
    appId: string,
  ) => Promise<FileMetadataRecord | null>;
  restoreDeletedAfterPurgeFailure: (
    fileId: string,
    appId: string,
  ) => Promise<void>;
  deletePurging: (fileId: string, appId: string) => Promise<boolean>;
}
