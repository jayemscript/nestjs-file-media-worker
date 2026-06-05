//src/common/dtos/upload-file.dto.ts
import { IsString, IsOptional, IsObject } from 'class-validator';

export class UploadFileDto {
  @IsString()
  folderName!: string;

  @IsString()
  uploadedBy!: string;

  @IsString()
  @IsOptional()
  uploadedFrom?: string;

  @IsObject()
  @IsOptional()
  customMetadata?: {
    tags?: string[];
    category?: string;
    retentionDays?: number;
    [key: string]: any;
  };
}