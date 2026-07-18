import { createAttachmentDisposition } from './content-disposition';

describe('createAttachmentDisposition', () => {
  it('encodes Unicode and removes header-control characters', () => {
    const disposition = createAttachmentDisposition('résumé\r\n".pdf');

    expect(disposition).toContain('filename="r_sum____.pdf"');
    expect(disposition).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9___.pdf");
    expect(disposition).not.toContain('\r');
    expect(disposition).not.toContain('\n');
  });
});
