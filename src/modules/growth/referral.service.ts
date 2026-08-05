import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Referral } from './entities/referral.entity.js';
import {
  ReferralConversion,
  ReferralConversionStatus,
} from './entities/referral-conversion.entity.js';
import type { ReferralDto } from './dto/referral.dto.js';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(ReferralConversion)
    private readonly conversionRepo: Repository<ReferralConversion>,
  ) {}

  private generateCode(): string {
    return uuidv4().replace(/-/g, '').slice(0, 10);
  }

  private async buildDto(referral: Referral): Promise<ReferralDto> {
    const [signups, conversions] = await Promise.all([
      this.conversionRepo.count({ where: { referralId: referral.id } }),
      this.conversionRepo.count({
        where: {
          referralId: referral.id,
          status: ReferralConversionStatus.CONVERTED,
        },
      }),
    ]);
    return { code: referral.code, signups, conversions };
  }

  async getOrCreateForUser(userId: string): Promise<ReferralDto> {
    let referral = await this.referralRepo.findOne({
      where: { referrerUserId: userId },
    });

    // Create on first request. Retry once on the (astronomically rare) code
    // collision; a concurrent create racing on the unique referrer id is
    // resolved by re-reading.
    for (let attempt = 0; !referral && attempt < 3; attempt++) {
      try {
        referral = await this.referralRepo.save(
          this.referralRepo.create({
            referrerUserId: userId,
            code: this.generateCode(),
          }),
        );
      } catch {
        referral = await this.referralRepo.findOne({
          where: { referrerUserId: userId },
        });
      }
    }

    if (!referral) {
      throw new Error('Failed to create referral link');
    }
    return this.buildDto(referral);
  }

  async validateCode(code: string): Promise<boolean> {
    if (!code) return false;
    const referral = await this.referralRepo.findOne({ where: { code } });
    return referral !== null;
  }

  // Best-effort — the auth flow calls this and must never fail because of it.
  async recordSignup(
    code: string | undefined,
    refereeUserId: string,
  ): Promise<void> {
    if (!code) return;
    const referral = await this.referralRepo.findOne({ where: { code } });
    if (!referral) return;
    // No self-referral, and one attribution per referee.
    if (referral.referrerUserId === refereeUserId) return;
    const existing = await this.conversionRepo.findOne({
      where: { refereeUserId },
    });
    if (existing) return;

    try {
      await this.conversionRepo.save(
        this.conversionRepo.create({
          referralId: referral.id,
          refereeUserId,
          status: ReferralConversionStatus.SIGNED_UP,
        }),
      );
    } catch (error) {
      // Unique-violation race (referee recorded concurrently) — ignore.
      this.logger.debug(
        `recordSignup skipped for referee ${refereeUserId}: ${(error as Error).message}`,
      );
    }
  }

  // Best-effort — marks a prior signup as converted on email verification.
  async markConverted(refereeUserId: string): Promise<void> {
    await this.conversionRepo.update(
      { refereeUserId, status: ReferralConversionStatus.SIGNED_UP },
      { status: ReferralConversionStatus.CONVERTED, convertedAt: new Date() },
    );
  }
}
