import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './adapters/local.adapter';
import { STORAGE_PROVIDER } from './storage.constants';

@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
