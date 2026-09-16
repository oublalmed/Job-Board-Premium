import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DataRequestType } from '../entities/data-request.entity.js';

// EF-ADM-03 — a data subject files a CNDP/RGPD request.
export class CreateDataRequestDto {
  @IsEnum(DataRequestType)
  type!: DataRequestType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
