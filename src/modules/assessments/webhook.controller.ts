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
import { WebhookService } from './webhook.service.js';

@Controller('assessments/webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-scoring-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    return this.webhookService.processWebhook(rawBody, signature);
  }
}
