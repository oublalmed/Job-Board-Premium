import { IsString, IsNotEmpty } from 'class-validator';
import { StrongPassword } from '../../../common/validators/strong-password.decorator.js';

// EF-CAND-01 — an authenticated user changes their own password. The current
// password is re-verified; the new one obeys the shared OWASP policy.
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @StrongPassword()
  newPassword!: string;
}
