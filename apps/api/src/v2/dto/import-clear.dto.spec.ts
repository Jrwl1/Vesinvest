import { validate } from 'class-validator';

import { ImportClearDto } from './import-clear.dto';

describe('ImportClearDto', () => {
  it('accepts confirmToken when provided', async () => {
    const dto = Object.assign(new ImportClearDto(), {
      confirmToken: 'C9032CDE',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
