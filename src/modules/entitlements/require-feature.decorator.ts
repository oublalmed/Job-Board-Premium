import { SetMetadata } from '@nestjs/common';
import { Feature } from './feature.enum.js';

export const REQUIRE_FEATURE_KEY = 'require_feature';

// §13 — mark a route/controller as needing a feature. Enforced by FeatureGuard
// (backend), so a capability is never merely hidden in the UI (§22 rule #4).
export const RequireFeature = (feature: Feature) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);
