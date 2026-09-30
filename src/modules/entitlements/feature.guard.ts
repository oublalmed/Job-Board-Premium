import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { Feature } from './feature.enum.js';
import { REQUIRE_FEATURE_KEY } from './require-feature.decorator.js';
import { EntitlementService } from './entitlement.service.js';
import { FeatureNotAvailableException } from './feature-not-available.exception.js';

// §13 — enforces @RequireFeature after authentication. Runs after JwtAuthGuard
// (needs request.user). No-op on routes without the decorator.
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new FeatureNotAvailableException(feature);
    }

    const allowed = await this.entitlements.hasFeatureForUser(userId, feature);
    if (!allowed) {
      throw new FeatureNotAvailableException(feature);
    }
    return true;
  }
}
