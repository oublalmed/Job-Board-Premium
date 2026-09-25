import { applyDecorators } from '@nestjs/common';
import { IsString, MinLength, Matches } from 'class-validator';

// Single source of truth for the OWASP-aligned password policy (EF-CAND-01),
// shared by registration and password reset so the rules can never drift
// between the two entry points.
export function StrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(10, { message: 'Password must be at least 10 characters' }),
    Matches(/[A-Z]/, {
      message: 'Password must contain at least one uppercase letter',
    }),
    Matches(/[a-z]/, {
      message: 'Password must contain at least one lowercase letter',
    }),
    Matches(/\d/, { message: 'Password must contain at least one digit' }),
    Matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, {
      message: 'Password must contain at least one special character',
    }),
  );
}
