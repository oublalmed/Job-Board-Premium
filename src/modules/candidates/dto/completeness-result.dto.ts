import { ApiProperty } from '@nestjs/swagger';

// Documentation-only — mirrors CompletenessResult (candidate-profile.
// service.ts), the source of truth the frontend must display verbatim,
// never recompute. `label` is backend debug text (French, hardcoded) —
// the frontend maps `key` to its own i18n strings instead of rendering
// this directly.
export class MissingElementDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  weight!: number;
}

export class CompletenessResultDto {
  @ApiProperty()
  completeness!: number;

  @ApiProperty()
  isPublishable!: boolean;

  @ApiProperty({ type: MissingElementDto, isArray: true })
  missing!: MissingElementDto[];
}
