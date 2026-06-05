//src/common/interfaces/file-restrictions.interface.ts
export interface FileRestrictions {
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  deniedMimeTypes?: string[];
  deniedExtensions?: string[];
  maxFileSize?: number;
  maxTotalSize?: number;
  maxUploadFiles?: number;
  requireAuth?: boolean;
}

export interface FileRestrictionConfig {
  global: FileRestrictions;
  perEndpoint?: Record<string, FileRestrictions>;
}