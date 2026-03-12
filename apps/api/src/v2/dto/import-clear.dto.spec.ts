import { validate } from 'class-validator';

import { ImportClearDto } from './import-clear.dto';

describe('ImportClearDto', () => {
  it('accepts confirmToken when provided', async () => {
    const dto = Object.assign(new ImportClearDto(), {
      confirmToken: 'C9032CDE',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects non-string confirmToken values', async () => {
    const dto = Object.assign(new ImportClearDto(), {
      confirmToken: 12345678 as unknown as string,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
