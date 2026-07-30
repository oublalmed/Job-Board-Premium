import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  BadRequestException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentWebhookService } from './payment-webhook.service.js';

@Controller('webhooks/payment')
export class PaymentWebhookController {
  constructor(private readonly webhookService: PaymentWebhookService) {}

  // Raw bytes, not the parsed JSON body: Stripe's signature is an HMAC over
  // the exact request bytes it sent, and any re-serialization (even
  // whitespace-preserving JSON.stringify(JSON.parse(body))) can change the
  // byte sequence enough to break verification. `rawBody: true` in
  // main.ts's NestFactory.create (added in Lot 2 for the scoring webhook)
  // captures req.rawBody for every request while leaving normal JSON
  // parsing untouched everywhere else — no per-route body-parser
  // configuration needed here, same pattern as assessments/webhook.controller.ts.
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    return this.webhookService.handleWebhook(rawBody, signature);
  }
}
