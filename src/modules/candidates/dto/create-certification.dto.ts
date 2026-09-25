import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

// EF-CAND-07 — a candidate registers a certification against their own
// profile. Server-side validation is the real security boundary (the frontend
// also validates for UX). `credentialUrl` follows the same http/https
// require_protocol contract as CreateProfileLinkDto.
export class CreateCertificationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  issuer!: string;

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  credentialUrl?: string;
}
