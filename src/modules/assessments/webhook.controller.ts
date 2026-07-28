import { Controller, Post, Headers, Req, HttpCode } from '@nestjs/common';
import { WebhookService } from './webhook.service.js';

@Controller('assessments/webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() rawBody: Buffer,
    @Headers('x-scoring-signature') signature: string,
  ) {
    return this.webhookService.processWebhook(rawBody, signature);
  }
}
