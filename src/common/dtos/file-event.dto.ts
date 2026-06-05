//src/common/dtos/file-event.dto.ts

import { FileAction } from '../enums/file-action.enum';

export class FileEventDto {
  eventId!: string;
  fileId!: string;
  fileName!: string;
  action!: FileAction;
  timestamp!: Date;
  userId!: string;
  ipAddress!: string;
  fileSize!: number;
  mimeType!: string;
  status!: 'success' | 'failed';
  errorMessage?: string;
  metadata?: {
    userAgent?: string;
    country?: string;
    [key: string]: any;
  };
}