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
const WEB_BASE_URL = (process.env['APP_WEB_URL'] ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

// Brand palette — kept in sync with the app's primary. Inlined into every
// element because email clients strip <style>/external CSS and ignore modern
// layout (fl/ grid), so a refined result must be table-based + inline only.
const BRAND = {
  primary: '#29477e',
  primaryDark: '#1f3a6b',
  ink: '#161c2c',
  muted: '#5b6478',
  faint: '#8b93a7',
  bg: '#eef1f6',
  card: '#ffffff',
  border: '#dfe3ec',
  hairline: '#eaedf3',
};

// A resolved, presentation-ready description of one email, independent of the
// HTML/text rendering. Every template reduces to this shape.
interface EmailContent {
  heading: string;
  // Body paragraphs, rendered in order.
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  // A muted reassurance/expiry line under the button.
  note?: string;
  // Only token links (verify/reset) show the copy-paste fallback — an app
  // navigation link doesn't need one.
  showLinkFallback: boolean;
}

// Per-template copy. Token templates build their URL from the token variable;
// notification templates link to the relevant app page instead.
const TOKEN_TEMPLATES: Record<
  string,
  { path: string; heading: string; intro: string; cta: string; note: string }
> = {
  'email-verification': {
    path: '/verify-email',
    heading: 'Confirmez votre adresse email',
    intro:
      'Bienvenue sur ' +
      APP_NAME +
      ' ! Il ne reste qu’une étape : confirmez votre adresse email pour activer votre compte et accéder à la plateforme.',
    cta: 'Vérifier mon adresse',
    note: 'Ce lien expire dans 24 heures. Si vous n’êtes pas à l’origine de cette inscription, vous pouvez ignorer cet email.',
  },
  'password-reset': {
    path: '/reset-password',
    heading: 'Réinitialisation de votre mot de passe',
    intro:
      'Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.',
    cta: 'Choisir un nouveau mot de passe',
    note: 'Ce lien est valable une heure. Si vous n’êtes pas à l’origine de cette demande, aucune action n’est requise : votre mot de passe reste inchangé.',
  },
};

const NOTIFICATION_TEMPLATES: Record<
  string,
  { path: string; heading: string; intro: string; cta: string }
> = {
  'cooldown-expired': {
    path: '/assessments',
    heading: 'Vous pouvez repasser votre évaluation',
    intro:
      'Bonne nouvelle : le délai d’attente est écoulé. Vous pouvez retenter votre évaluation dès maintenant pour améliorer votre score et votre visibilité auprès des recruteurs.',
    cta: 'Repasser mon évaluation',
  },
  'profile-viewed': {
    path: '/dashboard',
    heading: 'Un recruteur a consulté votre profil',
    intro:
      'Votre profil a retenu l’attention d’un recruteur. Gardez-le complet et à jour pour maximiser vos chances d’être contacté.',
    cta: 'Voir mon tableau de bord',
  },
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
    const content = this.resolveContent(request);
    const dir = request.locale === 'ar' ? 'rtl' : 'ltr';
    const html = this.renderHtml(content, request.subject, dir);
    const text = this.renderText(content);
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

  // Reduce a request to presentation-ready content, choosing copy by template.
  private resolveContent(request: SendMailRequest): EmailContent {
    const token = request.variables?.['token'];

    // Recruiter invite (admin-provisioned account): carries the login email and
    // company alongside a set-password link, so it gets its own multi-paragraph
    // copy rather than the single-line token template.
    if (request.templateId === 'recruiter-invite' && token) {
      const login = request.variables?.['email'] ?? request.to;
      const companyName = request.variables?.['companyName'];
      return {
        heading: `Votre compte recruteur ${APP_NAME}`,
        paragraphs: [
          companyName
            ? `Un compte recruteur a été créé pour vous au sein de « ${companyName} ». Activez-le en définissant votre mot de passe, puis connectez-vous.`
            : "Un compte recruteur a été créé pour vous. Activez-le en définissant votre mot de passe, puis connectez-vous.",
          `Votre identifiant de connexion : ${login}`,
        ],
        ctaLabel: 'Définir mon mot de passe',
        ctaUrl: `${WEB_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`,
        note: "Ce lien d'activation expire dans 7 jours. Connectez-vous ensuite avec l'adresse indiquée ci-dessus.",
        showLinkFallback: true,
      };
    }

    const tokenTpl = TOKEN_TEMPLATES[request.templateId];
    if (token && tokenTpl) {
      const url = `${WEB_BASE_URL}${tokenTpl.path}?token=${encodeURIComponent(token)}`;
      return {
        heading: tokenTpl.heading,
        paragraphs: [tokenTpl.intro],
        ctaLabel: tokenTpl.cta,
        ctaUrl: url,
        note: tokenTpl.note,
        showLinkFallback: true,
      };
    }

    const notifTpl = NOTIFICATION_TEMPLATES[request.templateId];
    if (notifTpl) {
      return {
        heading: notifTpl.heading,
        paragraphs: [notifTpl.intro],
        ctaLabel: notifTpl.cta,
        ctaUrl: `${WEB_BASE_URL}${notifTpl.path}`,
        showLinkFallback: false,
      };
    }

    // Graceful generic fallback — a branded message that points back to the
    // app, never a raw variable dump.
    return {
      heading: request.subject || APP_NAME,
      paragraphs: [
        'Vous avez une nouvelle notification sur votre compte ' +
          APP_NAME +
          '.',
      ],
      ctaLabel: 'Ouvrir ' + APP_NAME,
      ctaUrl: `${WEB_BASE_URL}/dashboard`,
      showLinkFallback: false,
    };
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // A bulletproof, table-based responsive email. Inline styles only; an MSO
  // (Outlook) VML fallback gives the CTA rounded corners there too.
  private renderHtml(content: EmailContent, subject: string, dir: string): string {
    const year = new Date().getFullYear();
    const preheader = content.paragraphs[0] ?? subject;
    const align = dir === 'rtl' ? 'right' : 'left';

    const paragraphs = content.paragraphs
      .map(
        (p) =>
          `<p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6">${this.escape(
            p,
          )}</p>`,
      )
      .join('');

    const button = content.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
              <tr>
                <td align="center" bgcolor="${BRAND.primary}" style="border-radius:8px">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${content.ctaUrl}" style="height:44px;v-text-anchor:middle;width:280px;" arcsize="18%" strokecolor="${BRAND.primary}" fillcolor="${BRAND.primary}">
                  <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${this.escape(
                    content.ctaLabel ?? '',
                  )}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${content.ctaUrl}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background:${BRAND.primary}">${this.escape(
                    content.ctaLabel ?? '',
                  )}</a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>`
      : '';

    const note = content.note
      ? `<p style="margin:20px 0 0;color:${BRAND.faint};font-size:13px;line-height:1.55">${this.escape(
          content.note,
        )}</p>`
      : '';

    const linkFallback =
      content.showLinkFallback && content.ctaUrl
        ? `<p style="margin:20px 0 0;color:${BRAND.faint};font-size:12px;line-height:1.5">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
            <a href="${content.ctaUrl}" style="color:${BRAND.primary};word-break:break-all">${this.escape(
              content.ctaUrl,
            )}</a></p>`
        : '';

    return `<!doctype html>
<html lang="fr" dir="${dir}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${this.escape(subject)}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${this.escape(
    preheader,
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg}">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
          <tr>
            <td style="height:4px;background:${BRAND.primary};background:linear-gradient(90deg,${BRAND.primary},${BRAND.primaryDark})">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px" align="${align}">
              <span style="display:inline-block;font-size:18px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.2px">
                <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:6px;background:${BRAND.primary};color:#fff;font-size:13px;vertical-align:middle;margin-${
                  dir === 'rtl' ? 'left' : 'right'
                }:8px">${APP_NAME.charAt(0)}</span>${APP_NAME}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px" align="${align}">
              <h1 style="margin:0 0 14px;color:${BRAND.ink};font-size:21px;line-height:1.35;font-weight:700">${this.escape(
                content.heading,
              )}</h1>
              ${paragraphs}
              ${button}
              ${note}
              ${linkFallback}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND.hairline}" align="${align}">
              <p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.55">Cet email vous a été envoyé automatiquement par ${APP_NAME}. Merci de ne pas y répondre.</p>
              <p style="margin:6px 0 0;color:${BRAND.faint};font-size:12px">© ${year} ${APP_NAME}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // Plain-text alternative — every client that prefers text still gets the
  // heading, body, link and note, cleanly formatted.
  private renderText(content: EmailContent): string {
    const parts = [content.heading, '', ...content.paragraphs];
    if (content.ctaUrl) {
      parts.push('', `${content.ctaLabel ?? 'Ouvrir'} : ${content.ctaUrl}`);
    }
    if (content.note) {
      parts.push('', content.note);
    }
    parts.push('', `— ${APP_NAME}`);
    return parts.join('\n');
  }
}
