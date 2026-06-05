//src/constants/file-restriction.constant.ts

import { FileRestrictions } from '../interfaces/file-restrictions.interface';

export const DEFAULT_FILE_RESTRICTIONS: FileRestrictions = {
  allowedMimeTypes: ['*'],
  maxFileSize: 50 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
  maxUploadFiles: 10,
  requireAuth: true,
};

export const FILE_RESTRICTIONS_BY_ENDPOINT: Record<string, FileRestrictions> = {
  documents: {
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    maxFileSize: 25 * 1024 * 1024,
    maxUploadFiles: 5,
    requireAuth: true,
  },
  images: {
    allowedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
    ],
    maxFileSize: 10 * 1024 * 1024,
    maxUploadFiles: 20,
    requireAuth: true,
  },
  videos: {
    allowedMimeTypes: ['video/mp4', 'video/mpeg', 'video/quicktime'],
    maxFileSize: 500 * 1024 * 1024,
    maxUploadFiles: 3,
    requireAuth: true,
  },
};
