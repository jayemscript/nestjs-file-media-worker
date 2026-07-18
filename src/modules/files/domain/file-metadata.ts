import { StorageProviderName } from '../../storage/interfaces/storage-provider.interface';

export enum FileType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
  OTHER = 'other',
}

export enum FileStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
  PURGING = 'purging',
}

export interface CreateFileMetadata {
  appId: string;
  originalName: string;
  storageKey: string;
  storageProvider: StorageProviderName;
  fileType: FileType;
  mimeType: string;
  extension: string;
  size: number;
  checksum: string;
  uploadedBy?: string;
}

export interface FileMetadataRecord extends CreateFileMetadata {
  id: string;
  status: FileStatus;
  deletedAt?: Date;
  deletedBy?: string;
  recoveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicFileMetadata {
  fileId: string;
  appId: string;
  originalName: string;
  fileType: FileType;
  mimeType: string;
  extension: string;
  size: number;
  status: FileStatus.ACTIVE | FileStatus.DELETED;
  uploadedAt: Date;
  deletedAt?: Date;
  recoveredAt?: Date;
}
