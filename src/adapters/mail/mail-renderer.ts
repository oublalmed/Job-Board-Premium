import { APP_NAME } from '../../common/brand.js';

const WEB_BASE_URL = (
  process.env['APP_WEB_URL'] ?? 'http://localhost:3001'
).replace(/\/+$/, '');

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

export interface EmailContent {
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
  showLinkFallback: boolean;
}

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
      ' ! Il ne reste qu'une étape : confirmez votre adresse email pour activer votre compte et accéder à la plateforme.',
    cta: 'Vérifier mon adresse',
    note: 'Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.',
  },
  'password-reset': {
    path: '/reset-password',
    heading: 'Réinitialisation de votre mot de passe',
    intro:
      'Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.',
    cta: 'Choisir un nouveau mot de passe',
    note: 'Ce lien est valable une heure. Si vous n'êtes pas à l'origine de cette demande, aucune action n'est requise : votre mot de passe reste inchangé.',
  },
  'recruiter-invitation': {
    path: '/accept-invite',
    heading: 'Vous êtes invité(e) à rejoindre une équipe',
    intro:
      'Une entreprise vous invite à la rejoindre comme recruteur sur ' +
      APP_NAME +
      '. Cliquez ci-dessous pour définir votre mot de passe et activer votre compte recruteur.',
    cta: 'Activer mon compte',
    note: 'Ce lien expire dans 7 jours. Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.',
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
      'Bonne nouvelle : le délai d'attente est écoulé. Vous pouvez retenter votre évaluation dès maintenant pour améliorer votre score et votre visibilité auprès des recruteurs.',
    cta: 'Repasser mon évaluation',
  },
  'profile-viewed': {
    path: '/dashboard',
    heading: 'Un recruteur a consulté votre profil',
    intro:
      'Votre profil a retenu l'attention d'un recruteur. Gardez-le complet et à jour pour maximiser vos chances d'être contacté.',
    cta: 'Voir mon tableau de bord',
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveContent(
  templateId: string,
  subject: string,
  variables: Record<string, string>,
  to: string,
): EmailContent {
  const token = variables['token'];

  if (templateId === 'recruiter-invite' && token) {
    const login = variables['email'] ?? to;
    const companyName = variables['companyName'];
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

  const tokenTpl = TOKEN_TEMPLATES[templateId];
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

  const notifTpl = NOTIFICATION_TEMPLATES[templateId];
  if (notifTpl) {
    return {
      heading: notifTpl.heading,
      paragraphs: [notifTpl.intro],
      ctaLabel: notifTpl.cta,
      ctaUrl: `${WEB_BASE_URL}${notifTpl.path}`,
      showLinkFallback: false,
    };
  }

  return {
    heading: subject || APP_NAME,
    paragraphs: [
      'Vous avez une nouvelle notification sur votre compte ' + APP_NAME + '.',
    ],
    ctaLabel: 'Ouvrir ' + APP_NAME,
    ctaUrl: `${WEB_BASE_URL}/dashboard`,
    showLinkFallback: false,
  };
}

export function renderHtml(
  content: EmailContent,
  subject: string,
  dir: string,
): string {
  const year = new Date().getFullYear();
  const preheader = content.paragraphs[0] ?? subject;
  const align = dir === 'rtl' ? 'right' : 'left';

  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6">${escapeHtml(p)}</p>`,
    )
    .join('');

  const button = content.ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
            <tr>
              <td align="center" bgcolor="${BRAND.primary}" style="border-radius:8px">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${content.ctaUrl}" style="height:44px;v-text-anchor:middle;width:280px;" arcsize="18%" strokecolor="${BRAND.primary}" fillcolor="${BRAND.primary}">
                <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${escapeHtml(
                  content.ctaLabel ?? '',
                )}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${content.ctaUrl}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background:${BRAND.primary}">${escapeHtml(
                  content.ctaLabel ?? '',
                )}</a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>`
    : '';

  const note = content.note
    ? `<p style="margin:20px 0 0;color:${BRAND.faint};font-size:13px;line-height:1.55">${escapeHtml(content.note)}</p>`
    : '';

  const linkFallback =
    content.showLinkFallback && content.ctaUrl
      ? `<p style="margin:20px 0 0;color:${BRAND.faint};font-size:12px;line-height:1.5">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          <a href="${content.ctaUrl}" style="color:${BRAND.primary};word-break:break-all">${escapeHtml(content.ctaUrl)}</a></p>`
      : '';

  return `<!doctype html>
<html lang="fr" dir="${dir}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
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
              <h1 style="margin:0 0 14px;color:${BRAND.ink};font-size:21px;line-height:1.35;font-weight:700">${escapeHtml(content.heading)}</h1>
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

export function renderText(content: EmailContent): string {
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

export function parseSender(from: string): { name: string; email: string } {
  // Parses "Name <email@example.com>" or bare "email@example.com"
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: APP_NAME, email: from.trim() };
}
