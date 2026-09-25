import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DataRequestStatus } from '../entities/data-request.entity.js';

// EF-ADM-03 — an admin advances a request. Only non-terminal targets are
// accepted here; `pending` cannot be set as a resolution.
export class UpdateDataRequestDto {
  @IsEnum(DataRequestStatus)
  @IsIn([
    DataRequestStatus.IN_PROGRESS,
    DataRequestStatus.COMPLETED,
    DataRequestStatus.REJECTED,
  ])
  status!: DataRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}
