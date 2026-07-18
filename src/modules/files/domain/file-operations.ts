import { Readable } from 'node:stream';
import { FileMediaErrorCode } from '../../../common/errors/file-media.error';
import { FileType, PublicFileMetadata } from './file-metadata';

export interface IncomingFile {
  originalName: string;
  declaredMimeType: string;
  size: number;
  buffer: Buffer;
}

export interface ValidatedFile extends IncomingFile {
  originalName: string;
  mimeType: string;
  extension: string;
  fileType: FileType;
  checksum: string;
}

export interface FailedFileUpload {
  originalName: string;
  code: FileMediaErrorCode | 'UPLOAD_FAILED';
  message: string;
}

export interface BulkUploadResult {
  successful: PublicFileMetadata[];
  failed: FailedFileUpload[];
}

export interface DownloadFileResult {
  stream: Readable;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface PermanentDeleteResult {
  fileId: string;
  permanentlyDeleted: true;
}
