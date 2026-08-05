import { ApiProperty } from '@nestjs/swagger';
import { AnalyticsEventType } from '../entities/analytics-event.entity.js';

export class FunnelStepDto {
  @ApiProperty({ enum: AnalyticsEventType })
  type!: AnalyticsEventType;

  @ApiProperty()
  count!: number;
}

// EF-ADM-05 internal dashboard payload. `steps` is always the full ordered
// funnel (missing types reported as 0) so the frontend can render a stable
// chart without guessing which steps exist.
export class FunnelDto {
  @ApiProperty({ nullable: true })
  rangeDays!: number | null;

  @ApiProperty({ type: FunnelStepDto, isArray: true })
  steps!: FunnelStepDto[];
}
