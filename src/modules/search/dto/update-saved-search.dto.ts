import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedSearchDto } from './create-saved-search.dto.js';

// EF-SRCH-04 — every field of a saved search is independently updatable
// (rename, tweak criteria, toggle alerts). PartialType makes each optional
// while keeping the same per-field validation (nested criteria included).
export class UpdateSavedSearchDto extends PartialType(CreateSavedSearchDto) {}
