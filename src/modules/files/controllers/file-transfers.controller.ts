import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { SkipResponseTransform } from '../../../common/decorators/skip-response-transform.decorator';
import { ApiKeyGuard } from '../../../common/guards/api-key-guard';
import { IncomingFile } from '../domain/file-operations';
import { CreateUploadAuthorizationDto } from '../dtos/create-upload-authorization.dto';
import { TransferRateLimitGuard } from '../guards/transfer-rate-limit.guard';
import { extractBearerToken } from '../presentation/bearer-token';
import { createAttachmentDisposition } from '../presentation/content-disposition';
import { FilesService } from '../services/files.service';
import { TransferAuthorizationService } from '../services/transfer-authorization.service';

@Controller('files')
export class FileTransfersController {
  constructor(
    private readonly transferAuthorizationService: TransferAuthorizationService,
    private readonly filesService: FilesService,
  ) {}

  @Post('authorizations/upload')
  @Header('Cache-Control', 'no-store')
  @RequireApiKey()
  @UseGuards(ApiKeyGuard)
  authorizeUpload(
    @Headers('x-app-id') appId: string | undefined,
    @Body() request: CreateUploadAuthorizationDto,
  ) {
    return this.transferAuthorizationService.authorizeUpload(appId, request);
  }

  @Post(':fileId/authorizations/download')
  @Header('Cache-Control', 'no-store')
  @RequireApiKey()
  @UseGuards(ApiKeyGuard)
  authorizeDownload(
    @Headers('x-app-id') appId: string | undefined,
    @Param('fileId') fileId: string,
  ) {
    return this.transferAuthorizationService.authorizeDownload(appId, fileId);
  }

  @Post('authorized-upload')
  @UseGuards(TransferRateLimitGuard)
  @UseInterceptors(FileInterceptor('file'))
  async authorizedUpload(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const incomingFile = file ? this.toIncomingFile(file) : undefined;
    const appId = await this.transferAuthorizationService.consumeUpload(
      extractBearerToken(authorization),
      incomingFile,
    );
    return this.filesService.uploadFile(appId, incomingFile);
  }

  @Get(':fileId/authorized-download')
  @UseGuards(TransferRateLimitGuard)
  @SkipResponseTransform()
  async authorizedDownload(
    @Headers('authorization') authorization: string | undefined,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const appId = await this.transferAuthorizationService.consumeDownload(
      extractBearerToken(authorization),
      fileId,
    );
    const download = await this.filesService.downloadFile(appId, fileId);
    response.set({
      'Content-Type': download.mimeType,
      'Content-Length': String(download.size),
      'Content-Disposition': createAttachmentDisposition(download.originalName),
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(download.stream);
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
