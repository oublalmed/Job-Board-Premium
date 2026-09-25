import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return undefined;
}

export class SearchCandidatesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  skills?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreMin?: number;

  @IsOptional()
  @IsString()
  location?: string;

  // EF-SRCH-02 — availability filter (substring match on the candidate's label).
  @IsOptional()
  @IsString()
  availability?: string;

  // EF-SRCH-02 — salary budget: match candidates who disclosed a range whose
  // minimum is at or below this figure (MAD). Masked ranges are not matched.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
