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

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return environment;
}
