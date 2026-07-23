const REQUIRED_STRING_KEYS = [
  'MONGO_URI',
  'MONGO_DB_NAME',
  'HARD_DELETE_ADMIN_KEY',
] as const;

const POSITIVE_INTEGER_KEYS = [
  'PORT',
  'MAX_FILE_SIZE_BYTES',
  'MAX_BULK_FILE_COUNT',
  'MAX_BULK_TOTAL_SIZE_BYTES',
  'TRANSFER_TOKEN_TTL_SECONDS',
  'TRANSFER_RATE_LIMIT_MAX',
  'TRANSFER_RATE_LIMIT_WINDOW_SECONDS',
] as const;

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  for (const key of REQUIRED_STRING_KEYS) {
    const value = environment[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${key} is required`);
    }
  }

  const provider = environment.STORAGE_PROVIDER ?? 'local';
  if (provider !== 'local') {
    errors.push('STORAGE_PROVIDER must be local during Phase 1');
  }

  const localRoot = environment.LOCAL_STORAGE_ROOT ?? './upload';
  if (typeof localRoot !== 'string' || localRoot.trim().length === 0) {
    errors.push('LOCAL_STORAGE_ROOT must be a non-empty path');
  }

  for (const key of POSITIVE_INTEGER_KEYS) {
    const value = environment[key];
    if (value === undefined) {
      continue;
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      errors.push(`${key} must be a positive integer`);
    }
  }

  const maxFileSize = Number(
    environment.MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024,
  );
  const maxBulkSize = Number(
    environment.MAX_BULK_TOTAL_SIZE_BYTES ?? 50 * 1024 * 1024,
  );
  if (maxBulkSize < maxFileSize) {
    errors.push(
      'MAX_BULK_TOTAL_SIZE_BYTES must be greater than or equal to MAX_FILE_SIZE_BYTES',
    );
  }

  const adminKey = environment.HARD_DELETE_ADMIN_KEY;
  if (typeof adminKey === 'string' && adminKey.length < 16) {
    errors.push('HARD_DELETE_ADMIN_KEY must be at least 16 characters');
  }

  const transferEnabledValue =
    environment.TRANSFER_AUTHORIZATION_ENABLED ?? 'false';
  if (
    typeof transferEnabledValue !== 'string' ||
    !['true', 'false'].includes(transferEnabledValue.toLowerCase())
  ) {
    errors.push('TRANSFER_AUTHORIZATION_ENABLED must be true or false');
  }

  const transferEnabled =
    typeof transferEnabledValue === 'string' &&
    transferEnabledValue.toLowerCase() === 'true';
  if (transferEnabled) {
    const signingKey = environment.TRANSFER_TOKEN_SIGNING_KEY;
    if (typeof signingKey !== 'string' || signingKey.length < 32) {
      errors.push('TRANSFER_TOKEN_SIGNING_KEY must be at least 32 characters');
    }

    const publicUrl = environment.FILE_SERVICE_PUBLIC_URL;
    if (typeof publicUrl !== 'string' || !isHttpUrl(publicUrl)) {
      errors.push('FILE_SERVICE_PUBLIC_URL must be a valid HTTP or HTTPS URL');
    } else if (
      environment.NODE_ENV === 'production' &&
      !isHttpsUrl(publicUrl)
    ) {
      errors.push('FILE_SERVICE_PUBLIC_URL must use HTTPS in production');
    }

    const apiKeys = environment.API_KEYS;
    if (
      typeof apiKeys !== 'string' ||
      apiKeys
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean).length === 0
    ) {
      errors.push(
        'API_KEYS must contain at least one key when transfer authorization is enabled',
      );
    }

    const tokenTtlSeconds = Number(
      environment.TRANSFER_TOKEN_TTL_SECONDS ?? 300,
    );
    if (tokenTtlSeconds > 3600) {
      errors.push('TRANSFER_TOKEN_TTL_SECONDS must not exceed 3600');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return environment;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
