import { IsString, IsOptional, MinLength, IsUUID } from 'class-validator';

export class CreateJobOfferDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  specialtyId?: string;
}
