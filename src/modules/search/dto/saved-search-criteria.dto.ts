import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

// The stored filter criteria of a saved search. A deliberate subset of
// SearchCandidatesDto — only the persistable filters, never the pagination
// fields (`cursor`/`limit`), which are runtime-only. Validated as a nested
// object under CreateSavedSearchDto/UpdateSavedSearchDto so criteria that
// don't match the search filter shape are rejected at the edge (the global
// ValidationPipe runs whitelist + forbidNonWhitelisted, so unknown keys are
// stripped/rejected too).
export class SavedSearchCriteriaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}
