import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';
import { FileType } from '../domain/file-metadata';
import { IncomingFile, ValidatedFile } from '../domain/file-operations';

interface SupportedFileType {
  extension: string;
  fileType: FileType;
}

const SUPPORTED_FILE_TYPES: Readonly<Record<string, SupportedFileType>> = {
  'image/jpeg': { extension: 'jpg', fileType: FileType.IMAGE },
  'image/png': { extension: 'png', fileType: FileType.IMAGE },
  'image/gif': { extension: 'gif', fileType: FileType.IMAGE },
  'image/webp': { extension: 'webp', fileType: FileType.IMAGE },
  'application/pdf': { extension: 'pdf', fileType: FileType.DOCUMENT },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: 'docx',
    fileType: FileType.DOCUMENT,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extension: 'xlsx',
    fileType: FileType.DOCUMENT,
  },
  'audio/mpeg': { extension: 'mp3', fileType: FileType.AUDIO },
  'audio/wav': { extension: 'wav', fileType: FileType.AUDIO },
  'video/mp4': { extension: 'mp4', fileType: FileType.VIDEO },
  'video/webm': { extension: 'webm', fileType: FileType.VIDEO },
};

const MIME_ALIASES: Readonly<Record<string, string>> = {
  'image/jpg': 'image/jpeg',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
};

@Injectable()
export class FileValidationService {
  private readonly maxFileSizeBytes: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(configService: ConfigService) {
    const configuration =
      configService.getOrThrow<StorageConfiguration>('storage');
    this.maxFileSizeBytes = configuration.maxFileSizeBytes;
    this.allowedMimeTypes = new Set(configuration.allowedMimeTypes);
  }

  async validate(file: IncomingFile): Promise<ValidatedFile> {
    const size = file.buffer.length;
    if (size === 0) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_REQUIRED,
        'The uploaded file is empty',
      );
    }
    if (size > this.maxFileSizeBytes) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_TOO_LARGE,
        `The file exceeds the ${this.maxFileSizeBytes}-byte limit`,
      );
    }

    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);
    const detectedMimeType = detected
      ? this.normalizeMimeType(detected.mime)
      : undefined;
    const declaredMimeType = this.normalizeMimeType(file.declaredMimeType);
    const supported = detectedMimeType
      ? SUPPORTED_FILE_TYPES[detectedMimeType]
      : undefined;

    if (
      !detectedMimeType ||
      !supported ||
      detectedMimeType !== declaredMimeType ||
      !this.allowedMimeTypes.has(detectedMimeType)
    ) {
      throw new FileMediaError(
        FileMediaErrorCode.UNSUPPORTED_FILE_TYPE,
        'The file content does not match an allowed MIME type',
      );
    }

    return {
      ...file,
      originalName: this.sanitizeOriginalName(
        file.originalName,
        supported.extension,
      ),
      size,
      mimeType: detectedMimeType,
      extension: supported.extension,
      fileType: supported.fileType,
      checksum: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  generateStorageKey(
    appId: string,
    file: Pick<ValidatedFile, 'fileType' | 'extension'>,
    now = new Date(),
  ): string {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${appId}/${file.fileType}/${year}/${month}/${randomUUID()}.${file.extension}`;
  }

  sanitizeOriginalName(originalName: string, extension = 'bin'): string {
    const pathIndependentName = originalName
      .replaceAll('\\', '/')
      .split('/')
      .pop();
    const sanitized = [...(pathIndependentName ?? '')]
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim()
      .slice(0, 255);
    return sanitized.length > 0 ? sanitized : `file.${extension}`;
  }

  private normalizeMimeType(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    return MIME_ALIASES[normalized] ?? normalized;
  }
}
