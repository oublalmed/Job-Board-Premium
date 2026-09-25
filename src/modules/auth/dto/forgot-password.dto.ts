import { IsEmail } from 'class-validator';

// EF-CAND-01 — request a password-reset link. The response is intentionally
// identical whether or not the email exists (no user enumeration).
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
