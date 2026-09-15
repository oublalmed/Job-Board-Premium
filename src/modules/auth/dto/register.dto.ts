import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsEnum,
  IsOptional,
  IsBoolean,
  Equals,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum.js';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/\d/, {
    message: 'Password must contain at least one digit',
  })
  @Matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, {
    message: 'Password must contain at least one special character',
  })
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
