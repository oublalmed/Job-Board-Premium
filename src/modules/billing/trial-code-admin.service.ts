import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrialCode, TrialCodeStatus } from './entities/trial-code.entity.js';
import { CreateTrialCodeDto } from './dto/create-trial-code.dto.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';

@Injectable()
export class TrialCodeAdminService {
  constructor(
    @InjectRepository(TrialCode)
    private readonly trialCodeRepo: Repository<TrialCode>,
  ) {}

  async create(dto: CreateTrialCodeDto): Promise<TrialCode> {
    try {
      return await this.trialCodeRepo.save(
        this.trialCodeRepo.create({
          code: dto.code,
          plan: dto.plan,
          trialDurationDays: dto.trialDurationDays,
          maxUses: dto.maxUses,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
      );
    } catch (error) {
      // A single insert into a single table — the code's own UNIQUE
      // constraint is the only one reachable here, so an unqualified
      // isUniqueViolation() is safe (contrast PaymentWebhookService, where
      // two distinct constraints are reachable in the same transaction and
      // must be told apart by name).
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A trial code "${dto.code}" already exists`,
        );
      }
      throw error;
    }
  }

  // Idempotent: revoking an already-revoked code is a no-op, not an error —
  // same convention as SubscriptionCheckoutService.cancelSubscription.
  async revoke(id: string): Promise<TrialCode> {
    const trialCode = await this.trialCodeRepo.findOne({ where: { id } });
    if (!trialCode) {
      throw new NotFoundException(`Trial code ${id} not found`);
    }

    if (trialCode.status === TrialCodeStatus.REVOKED) {
      return trialCode;
    }

    trialCode.status = TrialCodeStatus.REVOKED;
    return this.trialCodeRepo.save(trialCode);
  }
}
