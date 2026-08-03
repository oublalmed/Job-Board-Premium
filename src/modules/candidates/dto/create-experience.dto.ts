import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ExperienceType } from '../entities/experience.entity.js';

export class CreateExperienceDto {
  @IsEnum(ExperienceType)
  type!: ExperienceType;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  organization!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
