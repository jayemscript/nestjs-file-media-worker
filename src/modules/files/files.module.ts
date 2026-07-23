import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ApiKeyGuard } from '../../common/guards/api-key-guard';
import { StorageConfiguration } from '../../config/storage.config';
import { StorageModule } from '../storage/storage.module';
import { FilesController } from './controllers/files.controller';
import { FileTransfersController } from './controllers/file-transfers.controller';
import { PermanentDeleteGuard } from './guards/permanent-delete.guard';
import { TransferRateLimitGuard } from './guards/transfer-rate-limit.guard';
import { ZipArchiveService } from './presentation/zip-archive.service';
import { FILE_METADATA_REPOSITORY } from './repositories/file-metadata.repository.interface';
import { MongooseFileMetadataRepository } from './repositories/mongoose-file-metadata.repository';
import { MongooseTransferAuthorizationRepository } from './repositories/mongoose-transfer-authorization.repository';
import { TRANSFER_AUTHORIZATION_REPOSITORY } from './repositories/transfer-authorization.repository.interface';
import {
  FileMetadataDocument,
  FileMetadataSchema,
} from './schemas/file-metadata.schema';
import {
  TransferAuthorizationDocument,
  TransferAuthorizationSchema,
} from './schemas/transfer-authorization.schema';
import { AppContextService } from './services/app-context.service';
import { FileValidationService } from './services/file-validation.service';
import { FilesService } from './services/files.service';
import { TransferAuthorizationService } from './services/transfer-authorization.service';

@Module({
  imports: [
    StorageModule,
    MongooseModule.forFeature([
      { name: FileMetadataDocument.name, schema: FileMetadataSchema },
      {
        name: TransferAuthorizationDocument.name,
        schema: TransferAuthorizationSchema,
      },
    ]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const configuration =
          configService.getOrThrow<StorageConfiguration>('storage');
        return {
          limits: {
            fileSize: configuration.maxFileSizeBytes,
            files: configuration.maxBulkFileCount,
          },
        };
      },
    }),
  ],
  controllers: [FileTransfersController, FilesController],
  providers: [
    FilesService,
    ApiKeyGuard,
    FileValidationService,
    AppContextService,
    PermanentDeleteGuard,
    TransferRateLimitGuard,
    ZipArchiveService,
    MongooseFileMetadataRepository,
    MongooseTransferAuthorizationRepository,
    TransferAuthorizationService,
    {
      provide: FILE_METADATA_REPOSITORY,
      useExisting: MongooseFileMetadataRepository,
    },
    {
      provide: TRANSFER_AUTHORIZATION_REPOSITORY,
      useExisting: MongooseTransferAuthorizationRepository,
    },
  ],
  exports: [FilesService, TransferAuthorizationService],
})
export class FilesModule {}
