import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Recruiter } from '../companies/entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionPlan,
} from '../companies/entities/subscription.entity.js';
import { isSubscriptionWithinAccess } from '../companies/subscription-access.js';
import { Feature, LimitKey, type Limits } from './feature.enum.js';
import {
  entitlementsForPlan,
  PLAN_DISPLAY_NAME,
} from './entitlements.matrix.js';
import {
  FeatureOverride,
  FeatureSource,
} from './entities/feature-override.entity.js';

export interface FeatureState {
  enabled: boolean;
  source: FeatureSource;
}

// The full entitlement picture for a company — what the frontend gates on and
// the admin pack view (§12) displays.
export interface CompanyEntitlements {
  companyId: string;
  plan: SubscriptionPlan | null;
  planDisplayName: string;
  active: boolean;
  features: Record<Feature, FeatureState>;
  limits: Limits;
}

const ALL_FEATURES = Object.values(Feature);
const ZERO_LIMITS: Limits = {
  [LimitKey.MAX_EVALUATIONS_MONTH]: 0,
  [LimitKey.MAX_USERS]: 1,
  [LimitKey.MAX_JOB_POSTS]: 0,
  [LimitKey.MAX_EXPORTS_MONTH]: 0,
};

// §13 — resolves PACK → FEATURES → PERMISSIONS. The single place that turns a
// company's plan (+ admin overrides) into concrete feature/limit answers, used
// by the FeatureGuard (backend), the /entitlements endpoint (frontend gating),
// and the admin pack view.
@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(FeatureOverride)
    private readonly overrideRepo: Repository<FeatureOverride>,
    private readonly configService: ConfigService,
  ) {}

  async resolveCompanyId(userId: string): Promise<string> {
    const recruiter = await this.recruiterRepo.findOne({ where: { userId } });
    if (!recruiter) {
      throw new ForbiddenException('No company associated with this account');
    }
    return recruiter.companyId;
  }

  async getEntitlementsForUser(userId: string): Promise<CompanyEntitlements> {
    return this.getEntitlementsForCompany(await this.resolveCompanyId(userId));
  }

  async getEntitlementsForCompany(
    companyId: string,
  ): Promise<CompanyEntitlements> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
    const plan = subscription?.plan ?? null;
    const grace = this.configService.get<number>(
      'business.subscriptionGracePeriodDays',
      7,
    );
    const active = subscription
      ? isSubscriptionWithinAccess(subscription, grace)
      : false;

    const base = plan ? entitlementsForPlan(plan) : null;
    const planFeatures = new Set(base?.features ?? []);
    const limits = base?.limits ?? ZERO_LIMITS;

    const overrides = await this.overrideRepo.find({ where: { companyId } });
    const overrideByFeature = new Map(overrides.map((o) => [o.feature, o]));

    const features = {} as Record<Feature, FeatureState>;
    for (const feature of ALL_FEATURES) {
      const override = overrideByFeature.get(feature);
      if (override) {
        features[feature] = {
          enabled: override.enabled,
          source: FeatureSource.ADMIN_OVERRIDE,
        };
      } else {
        // A plan feature is only live while the subscription grants access.
        features[feature] = {
          enabled: active && planFeatures.has(feature),
          source: FeatureSource.PACKAGE,
        };
      }
    }

    return {
      companyId,
      plan,
      planDisplayName: plan ? PLAN_DISPLAY_NAME[plan] : '—',
      active,
      features,
      limits,
    };
  }

  async hasFeatureForCompany(
    companyId: string,
    feature: Feature,
  ): Promise<boolean> {
    const e = await this.getEntitlementsForCompany(companyId);
    return e.features[feature]?.enabled ?? false;
  }

  async hasFeatureForUser(userId: string, feature: Feature): Promise<boolean> {
    const e = await this.getEntitlementsForUser(userId);
    return e.features[feature]?.enabled ?? false;
  }

  // A plan's quantitative limit (§11). null = unlimited.
  getLimit(plan: SubscriptionPlan, key: LimitKey): number | null {
    return entitlementsForPlan(plan).limits[key];
  }

  // Current seat usage for the MAX_USERS limit (§12 "Utilisation").
  async countUsers(companyId: string): Promise<number> {
    return this.recruiterRepo.count({ where: { companyId } });
  }

  // ---- §12 admin override management ----
  async listOverrides(companyId: string): Promise<FeatureOverride[]> {
    return this.overrideRepo.find({
      where: { companyId },
      order: { updatedAt: 'DESC' },
    });
  }

  async setOverride(
    companyId: string,
    feature: Feature,
    enabled: boolean,
    actorId: string,
    note?: string,
  ): Promise<FeatureOverride> {
    const existing = await this.overrideRepo.findOne({
      where: { companyId, feature },
    });
    if (existing) {
      existing.enabled = enabled;
      existing.actorId = actorId;
      existing.note = note ?? null;
      return this.overrideRepo.save(existing);
    }
    return this.overrideRepo.save(
      this.overrideRepo.create({
        companyId,
        feature,
        enabled,
        actorId,
        note: note ?? null,
      }),
    );
  }

  async clearOverride(companyId: string, feature: Feature): Promise<void> {
    const existing = await this.overrideRepo.findOne({
      where: { companyId, feature },
    });
    if (!existing) throw new NotFoundException('No such override');
    await this.overrideRepo.remove(existing);
  }
}
