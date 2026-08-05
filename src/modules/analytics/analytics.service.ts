import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AnalyticsEvent,
  AnalyticsEventType,
} from './entities/analytics-event.entity.js';
import type { FunnelDto } from './dto/funnel.dto.js';

// The canonical amorçage funnel order (CDC §2.2).
const FUNNEL_ORDER: AnalyticsEventType[] = [
  AnalyticsEventType.SIGNUP,
  AnalyticsEventType.EMAIL_VERIFIED,
  AnalyticsEventType.TEST_STARTED,
  AnalyticsEventType.SCORE_OBTAINED,
  AnalyticsEventType.RECRUITER_CONTACT,
  AnalyticsEventType.SUBSCRIPTION_CREATED,
];

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly repo: Repository<AnalyticsEvent>,
  ) {}

  // Fire-and-forget — callers use `void analytics.track(...)`. Analytics is
  // observability, never on the critical path: a failure here must never
  // affect the business action that emitted it, so it only logs.
  async track(
    type: AnalyticsEventType,
    userId?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          type,
          userId: userId ?? null,
          metadata: metadata ?? null,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to record analytics event ${type}: ${(error as Error).message}`,
      );
    }
  }

  async funnel(days?: number): Promise<FunnelDto> {
    const qb = this.repo
      .createQueryBuilder('e')
      .select('e.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.type');

    const rangeDays =
      days !== undefined && Number.isFinite(days) && days > 0 ? days : null;
    if (rangeDays !== null) {
      const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
      qb.where('e.created_at >= :from', { from });
    }

    const rows = await qb.getRawMany<{
      type: AnalyticsEventType;
      count: string;
    }>();
    const counts = new Map<AnalyticsEventType, number>(
      rows.map((r) => [r.type, Number(r.count)]),
    );

    return {
      rangeDays,
      steps: FUNNEL_ORDER.map((type) => ({
        type,
        count: counts.get(type) ?? 0,
      })),
    };
  }
}
