import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { MailProvider, SendMailRequest } from '../../ports/mail.port.js';
import { APP_NAME } from '../../common/brand.js';

// Real SMTP delivery via Nodemailer. Selected when MAIL_DRIVER=smtp (see
// ports.module.ts); the default remains the stub. Configured entirely from the
// environment so no code change is needed to point it at a local catcher
// (Mailpit on :1025) in dev or a managed SMTP relay elsewhere. TLS is off for
// the plain local-catcher case and enabled automatically for port 465.
const SMTP_HOST = process.env['SMTP_HOST'] ?? 'localhost';
const SMTP_PORT = parseInt(process.env['SMTP_PORT'] ?? '1025', 10);
const SMTP_USER = process.env['SMTP_USER'] ?? '';
const SMTP_PASSWORD = process.env['SMTP_PASSWORD'] ?? '';
const MAIL_FROM = process.env['MAIL_FROM'] ?? `${APP_NAME} <no-reply@cobalt.local>`;
const WEB_BASE_URL = process.env['APP_WEB_URL'] ?? 'http://localhost:3001';

// Maps a template id to the front-end path that consumes its token, so the
// email carries a ready-to-click link rather than a bare token.
const TEMPLATE_LINK_PATHS: Record<string, string> = {
  'email-verification': '/verify-email',
  'password-reset': '/reset-password',
};

const TEMPLATE_INTRO: Record<string, string> = {
  'email-verification':
    'Merci de votre inscription. Confirmez votre adresse email pour activer votre compte :',
  'password-reset':
    'Vous avez demandé la réinitialisation de votre mot de passe. Ce lien est valable une heure :',
};

const TEMPLATE_CTA: Record<string, string> = {
  'email-verification': 'Vérifier mon adresse',
  'password-reset': 'Réinitialiser mon mot de passe',
};

@Injectable()
export class SmtpMailAdapter implements MailProvider {
  private readonly logger = new Logger(SmtpMailAdapter.name);
  private readonly transporter: Transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  });

  async send(request: SendMailRequest): Promise<{ messageId: string }> {
    const { html, text } = this.render(request);
    try {
      const info = await this.transporter.sendMail({
        from: MAIL_FROM,
        to: request.to,
        subject: request.subject,
        text,
        html,
      });
      const messageId = info.messageId ?? uuidv4();
      this.logger.log(
        `[SMTP] Email sent to=${request.to}, subject="${request.subject}", template=${request.templateId}, messageId=${messageId}`,
      );
      return { messageId };
    } catch (error) {
      // Surface the failure; callers (auth) already treat delivery as
      // best-effort where appropriate.
      this.logger.error(
        `[SMTP] Failed to send to=${request.to}, template=${request.templateId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private render(request: SendMailRequest): { html: string; text: string } {
    const token = request.variables?.['token'];
    const path = TEMPLATE_LINK_PATHS[request.templateId];

    if (token && path) {
      const link = `${WEB_BASE_URL}${path}?token=${encodeURIComponent(token)}`;
      const intro =
        TEMPLATE_INTRO[request.templateId] ?? 'Cliquez sur le lien ci-dessous :';
      const cta = TEMPLATE_CTA[request.templateId] ?? 'Continuer';
      const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f5f6fa;padding:32px;color:#161c2c">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #dde1ea;border-radius:12px;padding:28px">
    <h1 style="font-size:20px;margin:0 0 8px">${APP_NAME}</h1>
    <p style="color:#5b6478;font-size:14px;line-height:1.55">${intro}</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#29477e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${cta}</a></p>
    <p style="color:#8b93a7;font-size:12px;line-height:1.5">Ou copiez ce lien dans votre navigateur :<br><a href="${link}" style="color:#29477e">${link}</a></p>
  </div>
</body></html>`;
      const text = `${intro}\n\n${link}\n`;
      return { html, text };
    }

    // Generic fallback for any other template — dump the variables so nothing
    // is silently lost.
    const lines = Object.entries(request.variables ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    return {
      html: `<pre>${lines}</pre>`,
      text: lines,
    };
  }
}
