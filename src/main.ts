import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 7007;
  await app.listen(port);

  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  console.log(
    `[nestjs-file-media-services] running on port ${port} | mode: ${nodeEnv}`,
  );
  console.log(`Health: http://localhost:${port}/health`);
}

void bootstrap();
