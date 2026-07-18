import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig, {
  DatabaseConfiguration,
} from './config/database.config';
import storageConfig from './config/storage.config';
import { validateEnvironment } from './config/validation.schema';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, storageConfig],
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const database =
          configService.getOrThrow<DatabaseConfiguration>('database');
        return {
          uri: database.uri,
          dbName: database.name,
          retryAttempts: 3,
          retryDelay: 1000,
        };
      },
    }),
    FilesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
