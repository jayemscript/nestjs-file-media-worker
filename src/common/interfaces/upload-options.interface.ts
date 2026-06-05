//src/common/interfaces/upload-options.interface.ts
export interface UploadOptions {
  folderName: string;
  uploadedBy: string;
  uploadedFrom?: string;
  customMetadata?: {
    tags?: string[];
    category?: string;
    retentionDays?: number;
    [key: string]: any;
  };
  restrictions?: {
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
    maxFileSize?: number;
    maxTotalSize?: number;
  };
}