import { IsString, IsNotEmpty } from 'class-validator';
import { StrongPassword } from '../../../common/validators/strong-password.decorator.js';

// EF-CAND-01 — complete a password reset with the emailed token and a new
// password (same OWASP policy as registration, via the shared validator).
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @StrongPassword()
  password!: string;
}
