import { validate } from 'class-validator';

import { ImportClearDto } from './import-clear.dto';

describe('ImportClearDto', () => {
  it('allows confirmToken to be omitted so the service can enforce the confirmation check', async () => {
    await expect(validate(new ImportClearDto())).resolves.toHaveLength(0);
  });

  it('accepts challengeId and confirmToken when provided', async () => {
    const dto = Object.assign(new ImportClearDto(), {
      challengeId: 'challenge-1',
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

  it('rejects non-string challengeId values', async () => {
    const dto = Object.assign(new ImportClearDto(), {
      challengeId: 12345678 as unknown as string,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
