import { ApiProperty } from '@nestjs/swagger';
import { ScanStatus } from '../entities/document.entity.js';

// Documentation-only — mirrors CandidateDocumentController's actual
// inline return shapes, never redefined at runtime.
export class UploadCvResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty({ enum: ScanStatus })
  scanStatus!: ScanStatus;
}

export class CvDetailDto extends UploadCvResponseDto {
  @ApiProperty()
  createdAt!: Date;
}

export class GetCvResponseDto {
  @ApiProperty({ type: CvDetailDto, nullable: true })
  cv!: CvDetailDto | null;
}
