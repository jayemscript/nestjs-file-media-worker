//src/common/utils/file-validator.util.ts
import { BadRequestException } from '@nestjs/common';
import {
  MIME_TYPE_MAP,
  ALLOWED_EXTENSIONS,
} from '../constants/mime-types.constant';
import { FileRestrictions } from '../interfaces/file-restrictions.interface';

export class FileValidator {
  static validateMimeType(
    mimeType: string,
    allowedMimeTypes?: string[],
  ): boolean {
    if (!allowedMimeTypes || allowedMimeTypes.length === 0) {
      return true;
    }

    return allowedMimeTypes.some((allowed) => {
      if (allowed.endsWith('/*')) {
        const baseType = allowed.split('/')[0];
        return mimeType.startsWith(`${baseType}/`);
      }
      return mimeType === allowed;
    });
  }

  static validateExtension(
    fileName: string,
    allowedExtensions?: string[],
  ): boolean {
    if (!allowedExtensions || allowedExtensions.length === 0) {
      return true;
    }

    const fileExtension = `.${fileName.split('.').pop()?.toLowerCase()}`;
    return allowedExtensions.some((ext) => ext.toLowerCase() === fileExtension);
  }

  static validateFileSize(fileSize: number, maxSize?: number): boolean {
    if (!maxSize) {
      return true;
    }

    return fileSize <= maxSize;
  }

  static validateFile(
    fileName: string,
    fileSize: number,
    mimeType: string,
    restrictions: FileRestrictions,
  ): void {
    if (!this.validateFileSize(fileSize, restrictions.maxFileSize)) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${restrictions.maxFileSize} bytes`,
      );
    }

    if (!this.validateMimeType(mimeType, restrictions.allowedMimeTypes)) {
      throw new BadRequestException(`File type ${mimeType} is not allowed`);
    }

    if (!this.validateExtension(fileName, restrictions.allowedExtensions)) {
      throw new BadRequestException(`File extension is not allowed`);
    }
  }
}