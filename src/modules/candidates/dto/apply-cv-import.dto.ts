import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateExperienceDto } from './create-experience.dto.js';
import { CreateProjectDto } from './create-project.dto.js';
import { CreateCertificationDto } from './create-certification.dto.js';
import { CreateProfileLinkDto } from './create-profile-link.dto.js';

// §1 — the candidate-reviewed subset of the CV suggestions to save. Each item
// reuses its regular create DTO, so the same server-side validation applies
// (required fields, URL protocols, date formats).
export class ApplyCvImportDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExperienceDto)
  experiences?: CreateExperienceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectDto)
  projects?: CreateProjectDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCertificationDto)
  certifications?: CreateCertificationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProfileLinkDto)
  links?: CreateProfileLinkDto[];
}
