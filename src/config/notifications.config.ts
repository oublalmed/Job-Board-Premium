import { registerAs } from '@nestjs/config';

// EF-MSG-02 — the email delivery channel is off by default so CI/dev never
// attempts to dispatch mail. `mailDriver` selects the Mailer adapter; only
// 'log' (LoggingMailerAdapter) is wired today, 'smtp' is a documented
// extension point (see logging-mailer.adapter.ts).
export const notificationsConfig = registerAs('notifications', () => ({
  emailEnabled: process.env['NOTIFICATIONS_EMAIL_ENABLED'] === 'true',
  mailDriver: process.env['MAIL_DRIVER'] ?? 'log',
}));
