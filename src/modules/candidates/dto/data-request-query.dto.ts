import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import {
  DataRequestStatus,
  DataRequestType,
} from '../entities/data-request.entity.js';

// EF-ADM-03 — admin queue filter. Empty query returns the whole queue,
// soonest-due first.
export class DataRequestQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DataRequestStatus)
  status?: DataRequestStatus;

  @IsOptional()
  @IsEnum(DataRequestType)
  type?: DataRequestType;
}
