import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// §7 — CVthèque sort options. Default is score_desc (highest score first).
export const SEARCH_SORTS = [
  'score_desc',
  'score_asc',
  'recent',
  'active',
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

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

  // §8 — filter by one or more schools (matched against the candidate's
  // canonicalized school name, e.g. "ENSIAS …"). Combinable with every other
  // filter (§8.3).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  schools?: string[];

  // §7 — sort order. Defaults to score_desc.
  @IsOptional()
  @IsIn(SEARCH_SORTS)
  sort?: SearchSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
