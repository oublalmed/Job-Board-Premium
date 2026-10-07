import { IsEmail } from 'class-validator';

// Request a fresh email-verification link. Like ForgotPasswordDto, the response
// is intentionally identical whether or not the email maps to a pending
// account (no user enumeration).
export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}
