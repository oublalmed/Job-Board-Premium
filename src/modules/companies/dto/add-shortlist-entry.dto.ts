import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AddShortlistEntryDto {
  @IsUUID()
  candidateProfileId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
