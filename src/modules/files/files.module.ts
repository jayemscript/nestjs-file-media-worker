import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { StorageConfiguration } from '../../config/storage.config';
import { StorageModule } from '../storage/storage.module';
import { FilesController } from './controllers/files.controller';
import { PermanentDeleteGuard } from './guards/permanent-delete.guard';
import { FILE_METADATA_REPOSITORY } from './repositories/file-metadata.repository.interface';
import { MongooseFileMetadataRepository } from './repositories/mongoose-file-metadata.repository';
import {
  FileMetadataDocument,
  FileMetadataSchema,
} from './schemas/file-metadata.schema';
import { AppContextService } from './services/app-context.service';
import { FileValidationService } from './services/file-validation.service';
import { FilesService } from './services/files.service';

@Module({
  imports: [
    StorageModule,
    MongooseModule.forFeature([
      { name: FileMetadataDocument.name, schema: FileMetadataSchema },
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
  controllers: [FilesController],
  providers: [
    FilesService,
    FileValidationService,
    AppContextService,
    PermanentDeleteGuard,
    MongooseFileMetadataRepository,
    {
      provide: FILE_METADATA_REPOSITORY,
      useExisting: MongooseFileMetadataRepository,
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
