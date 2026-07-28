import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../dto/register.dto.js';

describe('RegisterDto', () => {
  const validData = {
    email: 'user@example.com',
    password: 'StrongP@ss1',
  };

  it('should pass with valid email and OWASP-compliant password', async () => {
    const dto = plainToInstance(RegisterDto, validData);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject password shorter than 10 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validData,
      password: 'Ab1!short',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('at least 10 characters'),
      ]),
    );
  });

  it('should reject password without uppercase letter', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validData,
      password: 'nouppercase1!@',
    });
    const errors = await validate(dto);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('uppercase'),
      ]),
    );
  });

  it('should reject password without lowercase letter', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validData,
      password: 'NOLOWERCASE1!@',
    });
    const errors = await validate(dto);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('lowercase'),
      ]),
    );
  });

  it('should reject password without digit', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validData,
      password: 'NoDigitHere!@ab',
    });
    const errors = await validate(dto);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('digit'),
      ]),
    );
  });

  it('should reject password without special character', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validData,
      password: 'NoSpecialChar1abc',
    });
    const errors = await validate(dto);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('special character'),
      ]),
    );
  });

  it('should reject invalid email', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validData,
      email: 'not-an-email',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
