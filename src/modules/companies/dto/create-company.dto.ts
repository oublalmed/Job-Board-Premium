import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^\d{15}$/, {
    message: 'ice must be exactly 15 digits (Moroccan ICE format)',
  })
  ice!: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}
