import { ApiProperty } from '@nestjs/swagger';

// Documentation-only, same reasoning as Front 0's auth response DTOs —
// CatalogService.listSpecialties returns a plain interface, erased at
// runtime, so the Swagger compiler plugin can't reflect it (only
// decorated classes). Mirrors SpecialtySummary's actual shape.
export class SpecialtySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;
}
