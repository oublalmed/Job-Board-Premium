import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// Admin provisions a recruiter account. The recruiter is attached to an
// existing company (companyId) or a new one (companyName). No password is taken
// — the recruiter receives an email with a link to set their own. Subscription
// packs are assigned to the *company* separately (admin subscriptions screen),
// never to the recruiter here.
export class CreateRecruiterDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  // Attach to an existing company...
  @IsOptional()
  @IsUUID()
  companyId?: string;

  // ...or create a new one by name (used when companyId is absent).
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName?: string;
}
