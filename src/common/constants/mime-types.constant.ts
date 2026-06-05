import { FileType } from '../enums/file-type.enum';

export const MIME_TYPE_MAP: Record<FileType, string[]> = {
  [FileType.DOCUMENT]: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/vnd.oasis.opendocument.text',
  ],
  [FileType.IMAGE]: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
  ],
  [FileType.VIDEO]: [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/3gpp',
  ],
  [FileType.AUDIO]: [
    'audio/mpeg',
    'audio/wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'audio/x-m4a',
  ],
  [FileType.ARCHIVE]: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
  ],
  [FileType.OTHER]: [],
};

export const ALLOWED_EXTENSIONS: Record<FileType, string[]> = {
  [FileType.DOCUMENT]: [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.txt',
    '.csv',
    '.odt',
  ],
  [FileType.IMAGE]: [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.bmp',
    '.tiff',
  ],
  [FileType.VIDEO]: ['.mp4', '.mpeg', '.mov', '.avi', '.mkv', '.webm', '.3gp'],
  [FileType.AUDIO]: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.webm', '.m4a'],
  [FileType.ARCHIVE]: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  [FileType.OTHER]: [],
};

export const FILE_TYPE_BY_MIME: Record<string, FileType> = Object.entries(
  MIME_TYPE_MAP,
).reduce(
  (acc, [fileType, mimeTypes]) => {
    mimeTypes.forEach((mime) => {
      acc[mime] = fileType as FileType;
    });
    return acc;
  },
  {} as Record<string, FileType>,
);
