import { registerAs } from '@nestjs/config';

export interface DatabaseConfiguration {
  uri: string;
  name: string;
}

export default registerAs(
  'database',
  (): DatabaseConfiguration => ({
    uri: process.env.MONGO_URI ?? '',
    name: process.env.MONGO_DB_NAME ?? 'file_media_service',
  }),
);
