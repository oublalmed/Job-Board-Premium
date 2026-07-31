import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TrialCodeRedemption } from './entities/trial-code-redemption.entity.js';

// Called from PaymentWebhookService.activateSubscription (a company's
// trial converting to a paid subscription) — a thin, deliberately narrow
// hook: one call, one column, into an already-shipped Lot 6D file. Reads
// the manager passed in so this lands in the SAME transaction as the
// activation itself, not a separate write that could land without it.
@Injectable()
export class TrialConversionService {
  async markConvertedIfApplicable(
    companyId: string,
    manager: EntityManager,
  ): Promise<void> {
    const redemptionRepo = manager.getRepository(TrialCodeRedemption);

    // Conditioned on convertedAt IS NULL directly in the UPDATE, not a
    // prior read — a company can only have one redemption row ever
    // (UNIQUE(company_id)), so this either sets it once or is a no-op for
    // a company with no redemption at all / already marked converted.
    await redemptionRepo
      .createQueryBuilder()
      .update(TrialCodeRedemption)
      .set({ convertedAt: () => 'now()' })
      .where('company_id = :companyId', { companyId })
      .andWhere('converted_at IS NULL')
      .execute();
  }
}
