import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class InviteRecruiterDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;
}
