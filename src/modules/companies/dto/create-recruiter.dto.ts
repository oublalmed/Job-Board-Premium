import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SubscriptionPlan } from '../entities/subscription.entity.js';

// Admin provisions a recruiter account. The recruiter is attached to an
// existing company (companyId) or a new one (companyName). A pack can be
// assigned at creation, per the recruiter's contract. No password is taken —
// the recruiter receives an email with a link to set their own.
export class CreateRecruiterDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  // Attach to an existing company...
  @IsOptional()
  @IsUUID()
  companyId?: string;

  // ...or create a new one by name (used when companyId is absent).
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName?: string;

  // Optional pack to assign at creation.
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  contactQuota?: number;
}
