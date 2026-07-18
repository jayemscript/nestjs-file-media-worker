import { validate } from 'class-validator';
import { BulkFileIdsDto } from './bulk-file-ids.dto';

const FILE_ID = '507f1f77bcf86cd799439011';
const SECOND_FILE_ID = '507f1f77bcf86cd799439012';

describe('BulkFileIdsDto', () => {
  it('accepts a non-empty array of unique MongoDB ObjectIds', async () => {
    const request = new BulkFileIdsDto();
    request.fileIds = [FILE_ID, SECOND_FILE_ID];

    await expect(validate(request)).resolves.toEqual([]);
  });

  it.each([
    { fileIds: [] },
    { fileIds: [FILE_ID, FILE_ID] },
    { fileIds: [FILE_ID, 'not-an-object-id'] },
  ])('rejects invalid file ID arrays', async ({ fileIds }) => {
    const request = new BulkFileIdsDto();
    request.fileIds = fileIds;

    await expect(validate(request)).resolves.not.toEqual([]);
  });
});
