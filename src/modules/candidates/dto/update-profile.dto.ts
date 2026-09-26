import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsIn,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import {
  ProfileVisibility,
  ContractType,
} from '../entities/candidate-profile.entity.js';

// EF-CAND-05 — the platform operates in a single currency; the salary range is
// always expressed in MAD, validated explicitly rather than left implicit.
export const SALARY_CURRENCY = 'MAD';

// EF-CAND-02 — explicit per-field bounds. These are the single source of truth
// for the limits the frontend mirrors (features/profile/schema.ts), so
// client-side validation can never reject a payload the API would accept, nor
// vice-versa.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  school?: string;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  visibility?: ProfileVisibility;

  // EF-CAND-05 — availability & geographic mobility (free-form labels).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  availability?: string;

  // Desired contract type (CDI/CDD/PFE/Freelance).
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mobility?: string;

  // EF-CAND-05 — salary expectation range (MAD, annual gross). Bounds keep it
  // sane; the min ≤ max relation is enforced in the service.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  salaryMax?: number;

  // Explicit currency validation: MAD is the only accepted value.
  @IsOptional()
  @IsIn([SALARY_CURRENCY])
  salaryCurrency?: string;

  // Masking: when false, the range is withheld from recruiter-facing views.
  @IsOptional()
  @IsBoolean()
  salaryVisible?: boolean;
}
