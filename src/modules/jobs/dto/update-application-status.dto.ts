import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../entities/job-application.entity.js';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
