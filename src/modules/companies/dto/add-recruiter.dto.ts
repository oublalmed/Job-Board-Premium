import { IsEmail, IsOptional, IsString } from 'class-validator';

export class AddRecruiterDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  position?: string;
}
