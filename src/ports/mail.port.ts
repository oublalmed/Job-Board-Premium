export interface SendMailRequest {
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, string>;
  locale?: 'fr' | 'ar';
}

export interface MailProvider {
  send(request: SendMailRequest): Promise<{ messageId: string }>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
