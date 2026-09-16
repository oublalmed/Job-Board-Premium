// EF-MSG-02 (email channel) — a deliberately minimal outbound-mail port,
// distinct from the template-based MailProvider (mail.port.ts) used by the
// transactional/marketing flows. The notification email channel only needs a
// subject + body, so it gets its own narrow contract rather than being forced
// through a templateId/variables shape it has no template for.
export interface SendMailParams {
  to: string;
  subject: string;
  // Plain-text body (always provided). `html` is an optional richer variant a
  // real SMTP adapter may prefer; the logging adapter ignores it.
  body: string;
  html?: string;
}

export interface Mailer {
  sendMail(params: SendMailParams): Promise<void>;
}

export const MAILER = Symbol('MAILER');
