import { IsOptional, IsUUID } from 'class-validator';

export class ListTestsQueryDto {
  @IsOptional()
  @IsUUID()
  specialtyId?: string;
}
