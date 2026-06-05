//src/common/guards/file-type.guard.ts
import { IMulterFile } from '../interfaces/multer-file.interface';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { FileValidator } from '../utils/file-validator.util';

@Injectable()
export class FileTypeGuard implements CanActivate {
  constructor(private allowedMimeTypes: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const files = (request as any).files || [];

    if (!Array.isArray(files)) {
      return true;
    }

    files.forEach((file: IMulterFile) => {
      const isValid = FileValidator.validateMimeType(
        file.mimetype,
        this.allowedMimeTypes,
      );

      if (!isValid) {
        throw new BadRequestException(
          `File type ${file.mimetype} is not allowed`,
        );
      }
    });

    return true;
  }
}
