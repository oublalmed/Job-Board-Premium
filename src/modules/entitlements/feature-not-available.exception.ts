import { ForbiddenException } from '@nestjs/common';

// §13/§14 — a feature blocked by the caller's plan returns a 403 the frontend
// can recognise (error === 'FEATURE_NOT_AVAILABLE') to show the "not in your
// plan — upgrade" state, rather than a generic forbidden.
export class FeatureNotAvailableException extends ForbiddenException {
  constructor(feature: string) {
    super({
      statusCode: 403,
      error: 'FEATURE_NOT_AVAILABLE',
      feature,
      message: "Cette fonctionnalité n'est pas incluse dans votre abonnement.",
    });
  }
}
