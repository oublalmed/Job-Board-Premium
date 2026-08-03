import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { LinkType } from '../entities/profile-link.entity.js';

export class CreateProfileLinkDto {
  @IsEnum(LinkType)
  type!: LinkType;

  // Server-side validation is the real security boundary (EF-CAND-04) —
  // the frontend also validates for immediate UX feedback, but never as a
  // substitute for this.
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
