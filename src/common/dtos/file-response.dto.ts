//src/common/dtos/file-response.dto.ts

import { FileStatus } from '../enums/file-status.enum';

export class FileResponseDto {
  id!: string;
  fileName!: string;
  originalName!: string;
  fileKey!: string;
  fileSize!: number;
  mimeType!: string;
  uploadedAt!: Date;
  uploadedBy!: string;
  uploadedFrom?: string;
  status!: FileStatus;
  downloadUrl!: string;
  s3Url?: string;
  customMetadata?: {
    tags?: string[];
    category?: string;
    retentionDays?: number;
    [key: string]: any;
  };
}

export class FileResponseArrayDto {
  success!: boolean;
  data!: FileResponseDto[];
  errors?: Array<{ fileName: string; error: string }>;
}