import { registerAs } from '@nestjs/config';

export interface TransferConfiguration {
  enabled: boolean;
  publicBaseUrl: string;
  signingKey: string;
  tokenTtlSeconds: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default registerAs(
  'transfer',
  (): TransferConfiguration => ({
    enabled:
      (process.env.TRANSFER_AUTHORIZATION_ENABLED ?? 'false').toLowerCase() ===
      'true',
    publicBaseUrl:
      process.env.FILE_SERVICE_PUBLIC_URL ?? 'http://localhost:7007',
    signingKey: process.env.TRANSFER_TOKEN_SIGNING_KEY ?? '',
    tokenTtlSeconds: positiveInteger(
      process.env.TRANSFER_TOKEN_TTL_SECONDS,
      300,
    ),
    rateLimitMax: positiveInteger(process.env.TRANSFER_RATE_LIMIT_MAX, 30),
    rateLimitWindowSeconds: positiveInteger(
      process.env.TRANSFER_RATE_LIMIT_WINDOW_SECONDS,
      60,
    ),
  }),
);
