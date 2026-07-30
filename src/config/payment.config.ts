import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
  stripeSecretKey: process.env['STRIPE_SECRET_KEY'] ?? '',
  stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
}));
