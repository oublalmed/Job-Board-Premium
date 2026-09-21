import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSavedSearchDto } from '../dto/create-saved-search.dto.js';

// EF-SRCH-04 — the stored criteria must match the search filter shape. These
// prove the nested-criteria validation the global ValidationPipe runs at the
// controller edge (whitelist + forbidNonWhitelisted + nested @Type).
async function errorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateSavedSearchDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  // Flatten property names across the (possibly nested) error tree.
  const names: string[] = [];
  const walk = (list: typeof errors): void => {
    for (const e of list) {
      names.push(e.property);
      if (e.children?.length) walk(e.children);
    }
  };
  walk(errors);
  return names;
}

describe('CreateSavedSearchDto / SavedSearchCriteriaDto validation', () => {
  it('accepts a valid name + criteria matching the search filter shape', async () => {
    const errors = await errorsFor({
      name: 'Backend devs Casa',
      criteria: {
        q: 'node',
        skills: ['React', 'Node.js'],
        scoreMin: 60,
        location: 'Casablanca',
      },
      alertEnabled: true,
    });
    expect(errors).toEqual([]);
  });

  it('accepts empty criteria (all filter fields optional)', async () => {
    const errors = await errorsFor({ name: 'All candidates', criteria: {} });
    expect(errors).toEqual([]);
  });

  it('rejects a missing/blank name', async () => {
    const errors = await errorsFor({ name: '', criteria: {} });
    expect(errors).toContain('name');
  });

  it('rejects a missing criteria object', async () => {
    const errors = await errorsFor({ name: 'x' });
    expect(errors).toContain('criteria');
  });

  it('rejects scoreMin outside 0..100', async () => {
    const errors = await errorsFor({
      name: 'x',
      criteria: { scoreMin: 150 },
    });
    expect(errors).toContain('criteria');
    expect(errors).toContain('scoreMin');
  });

  it('rejects skills that are not a string array', async () => {
    const errors = await errorsFor({
      name: 'x',
      criteria: { skills: [1, 2, 3] },
    });
    expect(errors).toContain('skills');
  });

  it('rejects unknown keys inside criteria (whitelist)', async () => {
    const errors = await errorsFor({
      name: 'x',
      criteria: { cursor: 'abc', limit: 999 },
    });
    // cursor/limit are pagination, deliberately NOT part of stored criteria.
    expect(errors).toContain('criteria');
  });
});
