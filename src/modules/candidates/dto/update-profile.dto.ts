import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ProfileVisibility } from '../entities/candidate-profile.entity.js';

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
}
