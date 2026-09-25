import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

// EF-CAND-07 — a candidate registers a project against their own profile.
// Server-side validation is the real security boundary (the frontend also
// validates for UX). `url` follows the same http/https require_protocol
// contract as CreateCertificationDto / CreateProfileLinkDto.
export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
