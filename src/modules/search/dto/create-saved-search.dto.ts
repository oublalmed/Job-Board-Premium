import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SavedSearchCriteriaDto } from './saved-search-criteria.dto.js';

// EF-SRCH-04 — a recruiter saves the current CVthèque filters under a name.
// The owner is never taken from the body (it is always the authenticated
// user's id — see SavedSearchController), so there is no owner field here.
export class CreateSavedSearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SavedSearchCriteriaDto)
  criteria!: SavedSearchCriteriaDto;

  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean;
}
