import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetFeatureOverrideDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
