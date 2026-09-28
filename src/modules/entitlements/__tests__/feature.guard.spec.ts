import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGuard } from '../feature.guard.js';
import { EntitlementService } from '../entitlement.service.js';
import { Feature } from '../feature.enum.js';
import { FeatureNotAvailableException } from '../feature-not-available.exception.js';

function ctx(user: { sub: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function make(required: Feature | undefined, granted: boolean) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  const hasFeatureForUser = jest.fn().mockResolvedValue(granted);
  const entitlements = {
    hasFeatureForUser,
  } as unknown as EntitlementService;
  return {
    guard: new FeatureGuard(reflector, entitlements),
    hasFeatureForUser,
  };
}

describe('FeatureGuard (§13)', () => {
  it('allows when the required feature is granted', async () => {
    const { guard, hasFeatureForUser } = make(Feature.ANTI_CHEAT, true);
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).resolves.toBe(true);
    expect(hasFeatureForUser).toHaveBeenCalledWith('u1', Feature.ANTI_CHEAT);
  });

  it('denies (FEATURE_NOT_AVAILABLE) when not granted', async () => {
    const { guard } = make(Feature.ANTI_CHEAT, false);
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).rejects.toBeInstanceOf(
      FeatureNotAvailableException,
    );
  });

  it('is a no-op on a route without @RequireFeature', async () => {
    const { guard, hasFeatureForUser } = make(undefined, false);
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).resolves.toBe(true);
    expect(hasFeatureForUser).not.toHaveBeenCalled();
  });

  it('denies when there is no authenticated user', async () => {
    const { guard } = make(Feature.JOBS, true);
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(
      FeatureNotAvailableException,
    );
  });
});
