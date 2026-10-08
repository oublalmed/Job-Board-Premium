import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { APP_NAME } from '../../common/brand.js';

// Shared Nodemailer transport + sender identity for every SMTP-backed adapter
// (the template MailProvider and the notification Mailer), so both read the
// same env and behave identically. TLS is off for the plain local-catcher
// case (Mailpit :1025) and enabled automatically for the implicit-TLS port 465;
// 587/STARTTLS is negotiated by Nodemailer when the server advertises it.
export function createSmtpTransport(): Transporter {
  const host = process.env['SMTP_HOST'] ?? 'localhost';
  const port = parseInt(process.env['SMTP_PORT'] ?? '1025', 10);
  const user = process.env['SMTP_USER'] ?? '';
  const password = process.env['SMTP_PASSWORD'] ?? '';
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
    auth: user ? { user, pass: password } : undefined,
  });
}

// The From header. A configured MAIL_FROM wins; otherwise a branded default.
export function mailFrom(): string {
  return process.env['MAIL_FROM'] ?? `${APP_NAME} <no-reply@maysync.app>`;
}
