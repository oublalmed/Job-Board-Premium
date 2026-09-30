import { PartialType } from '@nestjs/mapped-types';
import { CreateJobDto } from './create-job.dto.js';

// Every field optional — a partial edit of an existing offer.
export class UpdateJobDto extends PartialType(CreateJobDto) {}
