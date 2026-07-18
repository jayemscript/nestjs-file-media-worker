import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SkipResponseTransform } from '../../../common/decorators/skip-response-transform.decorator';
import { IncomingFile } from '../domain/file-operations';
import { PermanentDeleteGuard } from '../guards/permanent-delete.guard';
import { createAttachmentDisposition } from '../presentation/content-disposition';
import { FilesService } from '../services/files.service';
import { ApiKeyGuard } from '../../../common/guards/api-key-guard';

@UseGuards(ApiKeyGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Headers('x-app-id') appId: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.filesService.uploadFile(
      appId,
      file ? this.toIncomingFile(file) : undefined,
    );
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files'))
  uploadFiles(
    @Headers('x-app-id') appId: string | undefined,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.filesService.uploadFiles(
      appId,
      files?.map((file) => this.toIncomingFile(file)),
    );
  }

  @Get(':fileId')
  getMetadata(
    @Headers('x-app-id') appId: string | undefined,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.getMetadata(appId, fileId);
  }

  @Get(':fileId/download')
  @SkipResponseTransform()
  async downloadFile(
    @Headers('x-app-id') appId: string | undefined,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const download = await this.filesService.downloadFile(appId, fileId);
    response.set({
      'Content-Type': download.mimeType,
      'Content-Length': String(download.size),
      'Content-Disposition': createAttachmentDisposition(download.originalName),
    });
    return new StreamableFile(download.stream);
  }

  @Delete(':fileId')
  softDeleteFile(
    @Headers('x-app-id') appId: string | undefined,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.softDeleteFile(appId, fileId);
  }

  @Post(':fileId/recover')
  @HttpCode(HttpStatus.OK)
  recoverFile(
    @Headers('x-app-id') appId: string | undefined,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.recoverFile(appId, fileId);
  }

  @Delete(':fileId/permanent')
  @UseGuards(PermanentDeleteGuard)
  permanentlyDeleteFile(
    @Headers('x-app-id') appId: string | undefined,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.permanentlyDeleteFile(appId, fileId);
  }

  private toIncomingFile(file: Express.Multer.File): IncomingFile {
    return {
      originalName: file.originalname,
      declaredMimeType: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    };
  }
}
