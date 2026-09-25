import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  Equals,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum.js';
import { StrongPassword } from '../../../common/validators/strong-password.decorator.js';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @StrongPassword()
  password!: string;

  @IsOptional()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  // EF-GROW-02 — optional referral code captured from the invite link.
  @IsOptional()
  @IsString()
  referralCode?: string;

  // ENF-12 (CNDP/RGPD) — explicit consent must be given at sign-up. Must be
  // literally true; a missing or false value fails validation, so account
  // creation cannot proceed without it.
  @IsBoolean()
  @Equals(true, { message: 'Consent to the privacy policy is required' })
  consentAccepted!: boolean;
}
