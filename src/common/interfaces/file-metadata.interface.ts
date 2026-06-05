//src/common/interfaces/file-metadata.interface.ts

import { FileStatus } from '../enums/file-status.enum';

export interface FileMetadata {
  id: string;
  fileName: string;
  originalName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  uploadedAt: Date;
  uploadedBy: string;
  uploadedFrom?: string;
  status: FileStatus;
  customMetadata?: {
    tags?: string[];
    category?: string;
    retentionDays?: number;
    virusScanStatus?: 'pending' | 'clean' | 'infected';
    [key: string]: any;
  };
}
