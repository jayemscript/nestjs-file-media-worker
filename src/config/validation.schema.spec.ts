import { validateEnvironment } from './validation.schema';

describe('validateEnvironment', () => {
  const validEnvironment: Record<string, unknown> = {
    MONGO_URI: 'mongodb://localhost:27017',
    MONGO_DB_NAME: 'file_media_service',
    STORAGE_PROVIDER: 'local',
    LOCAL_STORAGE_ROOT: './upload',
    HARD_DELETE_ADMIN_KEY: 'a-long-development-key',
  };

  it('accepts the minimum Phase 1 configuration', () => {
    expect(validateEnvironment({ ...validEnvironment })).toEqual(
      validEnvironment,
    );
  });

  it('rejects a missing MongoDB URI', () => {
    const environment = { ...validEnvironment };
    delete environment.MONGO_URI;

    expect(() => validateEnvironment(environment)).toThrow(
      'MONGO_URI is required',
    );
  });

  it('rejects inactive providers during Phase 1', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, STORAGE_PROVIDER: 's3' }),
    ).toThrow('STORAGE_PROVIDER must be local during Phase 1');
  });

  it('rejects an aggregate limit smaller than a single-file limit', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MAX_FILE_SIZE_BYTES: '100',
        MAX_BULK_TOTAL_SIZE_BYTES: '99',
      }),
    ).toThrow(
      'MAX_BULK_TOTAL_SIZE_BYTES must be greater than or equal to MAX_FILE_SIZE_BYTES',
    );
  });
});
