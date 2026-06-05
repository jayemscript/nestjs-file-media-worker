//src/common/guards/file-size/guard.ts
import { IMulterFile } from '../interfaces/multer-file.interface';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class FileSizeGuard implements CanActivate {
  constructor(private maxSizeBytes: number) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const files = (request as any).files || [];

    if (!Array.isArray(files)) {
      return true;
    }

    files.forEach((file: IMulterFile) => {
      if (file.size > this.maxSizeBytes) {
        throw new BadRequestException(
          `File ${file.originalname} exceeds maximum size of ${this.maxSizeBytes} bytes`,
        );
      }
    });

    return true;
  }
}