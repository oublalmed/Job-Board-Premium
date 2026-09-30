import { SubscriptionPlan } from '../companies/entities/subscription.entity.js';
import { Feature, LimitKey, type Limits } from './feature.enum.js';

// §9 — the plan → { features, limits } matrix. This is the single source of
// truth the whole app gates on; changing a plan's offer is a data edit here,
// never an `if (plan === …)` scattered across services (§22 rules #5, #6).
//
// Display note (per product decision): the enum values stay starter/growth/
// scale/enterprise (no risky DB migration), but are LABELLED Starter / Pro /
// Premium / Enterprise in the UI — see PLAN_DISPLAY_NAME.
export interface PlanEntitlements {
  displayName: string;
  features: Feature[];
  limits: Limits;
}

export const PLAN_DISPLAY_NAME: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.STARTER]: 'Starter',
  [SubscriptionPlan.GROWTH]: 'Pro',
  [SubscriptionPlan.SCALE]: 'Premium',
  [SubscriptionPlan.ENTERPRISE]: 'Enterprise',
};

// Features every plan gets (the CVthèque baseline).
const BASE_FEATURES: Feature[] = [
  Feature.CV_DATABASE,
  Feature.CANDIDATE_SEARCH,
  Feature.PROFILE_FILTER,
  Feature.SCHOOL_FILTER,
  Feature.SCORE_SORT,
  Feature.EVALUATIONS,
  Feature.BASIC_ANALYTICS,
  Feature.MULTI_USER,
];

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, PlanEntitlements> = {
  [SubscriptionPlan.STARTER]: {
    displayName: 'Starter',
    features: [...BASE_FEATURES],
    limits: {
      [LimitKey.MAX_EVALUATIONS_MONTH]: 3,
      [LimitKey.MAX_USERS]: 1,
      [LimitKey.MAX_JOB_POSTS]: 0,
      [LimitKey.MAX_EXPORTS_MONTH]: 10,
    },
  },
  [SubscriptionPlan.GROWTH]: {
    displayName: 'Pro',
    features: [
      ...BASE_FEATURES,
      Feature.ADVANCED_EVALUATIONS,
      Feature.JOBS,
      Feature.APPLICATIONS,
      Feature.SHORTLIST,
      Feature.EXPORT_CANDIDATES,
      Feature.PRIORITY_SUPPORT,
    ],
    limits: {
      [LimitKey.MAX_EVALUATIONS_MONTH]: 20,
      [LimitKey.MAX_USERS]: 3,
      [LimitKey.MAX_JOB_POSTS]: 5,
      [LimitKey.MAX_EXPORTS_MONTH]: null,
    },
  },
  [SubscriptionPlan.SCALE]: {
    displayName: 'Premium',
    features: [
      ...BASE_FEATURES,
      Feature.ADVANCED_EVALUATIONS,
      Feature.JOBS,
      Feature.APPLICATIONS,
      Feature.SHORTLIST,
      Feature.EXPORT_CANDIDATES,
      Feature.PRIORITY_SUPPORT,
      // Feature.ANTI_CHEAT — disabled for recruiters (product decision). The
      // feature and its enum stay in place; re-add here to re-enable per pack.
      Feature.ADVANCED_ANALYTICS,
    ],
    limits: {
      [LimitKey.MAX_EVALUATIONS_MONTH]: null,
      [LimitKey.MAX_USERS]: 10,
      [LimitKey.MAX_JOB_POSTS]: 20,
      [LimitKey.MAX_EXPORTS_MONTH]: null,
    },
  },
  [SubscriptionPlan.ENTERPRISE]: {
    displayName: 'Enterprise',
    features: [
      ...BASE_FEATURES,
      Feature.ADVANCED_EVALUATIONS,
      Feature.JOBS,
      Feature.APPLICATIONS,
      Feature.SHORTLIST,
      Feature.EXPORT_CANDIDATES,
      Feature.PRIORITY_SUPPORT,
      // Feature.ANTI_CHEAT — disabled for recruiters (product decision). The
      // feature and its enum stay in place; re-add here to re-enable per pack.
      Feature.ADVANCED_ANALYTICS,
      Feature.API_ACCESS,
    ],
    limits: {
      [LimitKey.MAX_EVALUATIONS_MONTH]: null,
      [LimitKey.MAX_USERS]: null,
      [LimitKey.MAX_JOB_POSTS]: null,
      [LimitKey.MAX_EXPORTS_MONTH]: null,
    },
  },
};

export function entitlementsForPlan(plan: SubscriptionPlan): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS[SubscriptionPlan.STARTER];
}
