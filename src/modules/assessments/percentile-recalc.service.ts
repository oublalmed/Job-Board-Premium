import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Not } from 'typeorm';
import { Score, PlagiarismVerdict } from './entities/score.entity.js';

export interface PercentileRecalcResult {
  cohortCount: number;
  scoreCount: number;
  updatedCount: number;
}

/**
 * EF-EVAL-04 — daily recalculation of each active score's percentile.
 *
 * Percentiles are initially persisted from the assessment provider's webhook
 * payload and then never move, so a candidate's standing drifts out of date
 * as the population grows. This service re-derives every active score's
 * percentile against the *current* live cohort.
 *
 * Definition (documented so recruiter-facing ranking is explainable):
 *   cohort            = active scores sharing the same testId
 *   active            = not expired AND plagiarism verdict != CONFIRMED
 *   percentile(x)     = (peers in cohort with value < x) / cohortSize * 100
 *
 * i.e. "the share of the comparable population this candidate outranks".
 * Ties receive an identical percentile, the lowest scores 0, and the value
 * is monotonic in the raw score — which keeps the P30/P75 indexation and
 * featuring thresholds (see IndexationService) meaningful.
 *
 * The computation is deterministic, so running it twice over an unchanged
 * population is a no-op (idempotent). Only rows whose rounded percentile
 * actually changed are written, both to minimise churn and to make
 * `updatedCount` a truthful signal.
 */
@Injectable()
export class PercentileRecalcService {
  private readonly logger = new Logger(PercentileRecalcService.name);

  constructor(
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
  ) {}

  async recalculate(): Promise<PercentileRecalcResult> {
    const now = new Date();

    const activeScores = await this.scoreRepo.find({
      where: {
        expiresAt: MoreThan(now),
        plagiarismVerdict: Not(PlagiarismVerdict.CONFIRMED),
      },
      relations: { assessment: true },
    });

    const cohorts = this.groupByTest(activeScores);

    let updatedCount = 0;
    for (const cohort of cohorts.values()) {
      updatedCount += await this.recalculateCohort(cohort);
    }

    this.logger.log(
      `Percentile recalc: ${cohorts.size} cohort(s), ${activeScores.length} active score(s), ${updatedCount} updated`,
    );

    return {
      cohortCount: cohorts.size,
      scoreCount: activeScores.length,
      updatedCount,
    };
  }

  private groupByTest(scores: Score[]): Map<string, Score[]> {
    const cohorts = new Map<string, Score[]>();
    for (const score of scores) {
      // Defensive: a score with no loaded assessment cannot be placed in a
      // comparison cohort, so it is skipped rather than crashing the sweep.
      const testId = score.assessment?.testId;
      if (!testId) continue;
      const bucket = cohorts.get(testId);
      if (bucket) bucket.push(score);
      else cohorts.set(testId, [score]);
    }
    return cohorts;
  }

  private async recalculateCohort(cohort: Score[]): Promise<number> {
    const cohortSize = cohort.length;
    const values = cohort.map((s) => Number(s.value));

    let updated = 0;
    for (const score of cohort) {
      const value = Number(score.value);
      const below = values.filter((v) => v < value).length;
      const percentile = this.round2((below / cohortSize) * 100);

      const current =
        score.percentile !== null
          ? this.round2(Number(score.percentile))
          : null;
      if (current === percentile) continue;

      await this.scoreRepo.update(score.id, { percentile });
      updated += 1;
    }
    return updated;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
}
