import { registerAs } from '@nestjs/config';

export const scoringConfig = registerAs('scoring', () => ({
  webhookSecret: process.env['SCORING_WEBHOOK_SECRET'] ?? '',
}));
