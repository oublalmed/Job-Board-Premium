import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { SubscriptionCheckoutService } from './subscription-checkout.service.js';
import { TrialCodeRedemptionService } from './trial-code-redemption.service.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto.js';
import { RedeemTrialCodeDto } from './dto/redeem-trial-code.dto.js';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionCheckoutController {
  constructor(
    private readonly checkoutService: SubscriptionCheckoutService,
    private readonly trialCodeRedemptionService: TrialCodeRedemptionService,
  ) {}

  @Post()
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async createSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.checkoutService.createCheckoutSession(user.sub, dto);
  }

  @Post('cancel')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async cancelSubscription(@CurrentUser() user: JwtPayload) {
    return this.checkoutService.cancelSubscription(user.sub);
  }

  @Post('plan')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async changePlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    return this.checkoutService.changePlan(user.sub, dto);
  }

  @Post('trial-code/redeem')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async redeemTrialCode(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RedeemTrialCodeDto,
  ) {
    return this.trialCodeRedemptionService.redeem(user.sub, dto.code);
  }
}
