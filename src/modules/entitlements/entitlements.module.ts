import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recruiter } from '../companies/entities/recruiter.entity.js';
import { Subscription } from '../companies/entities/subscription.entity.js';
import { FeatureOverride } from './entities/feature-override.entity.js';
import { EntitlementService } from './entitlement.service.js';
import { FeatureGuard } from './feature.guard.js';
import { EntitlementsController } from './entitlements.controller.js';
import { EntitlementsAdminController } from './entitlements-admin.controller.js';
import { AuditModule } from '../audit/audit.module.js';

// §9-13 — the centralized PACK → FEATURES → PERMISSIONS system. Global so any
// module can inject EntitlementService and apply @RequireFeature + FeatureGuard
// without re-importing.
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Recruiter, Subscription, FeatureOverride]),
    AuditModule,
  ],
  controllers: [EntitlementsController, EntitlementsAdminController],
  providers: [EntitlementService, FeatureGuard],
  exports: [EntitlementService, FeatureGuard],
})
export class EntitlementsModule {}
