import { IsString, IsOptional, MaxLength } from 'class-validator';

// EF-ADM-02 — admin edit of a reference-data setting value.
export class UpdateSettingDto {
  @IsString()
  @MaxLength(2000)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
