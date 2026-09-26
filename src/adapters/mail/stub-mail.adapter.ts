import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MailProvider, SendMailRequest } from '../../ports/mail.port.js';

// Dev-only convenience: no SMTP is wired locally, so verification and
// password-reset emails never leave the machine. In any non-production
// environment this adapter therefore prints a ready-to-click link built from
// the email's token variable, so those flows are testable end to end from the
// API console. Never active in production (guarded on NODE_ENV), where a real
// mail provider is expected instead.
const WEB_BASE_URL = process.env['APP_WEB_URL'] ?? 'http://localhost:3001';
const IS_PROD = process.env['NODE_ENV'] === 'production';

const TEMPLATE_LINK_PATHS: Record<string, string> = {
  'email-verification': '/verify-email',
  'password-reset': '/reset-password',
};

@Injectable()
export class StubMailAdapter implements MailProvider {
  private readonly logger = new Logger(StubMailAdapter.name);
  private readonly sentMails: SendMailRequest[] = [];

  send(request: SendMailRequest): Promise<{ messageId: string }> {
    const messageId = uuidv4();
    this.sentMails.push(request);
    this.logger.log(
      `[STUB] Email sent to=${request.to}, subject="${request.subject}", template=${request.templateId}, messageId=${messageId}`,
    );

    if (!IS_PROD) {
      const token = request.variables?.['token'];
      const path = TEMPLATE_LINK_PATHS[request.templateId];
      if (token && path) {
        this.logger.log(
          `[STUB] Dev link for ${request.to} → ${WEB_BASE_URL}${path}?token=${encodeURIComponent(token)}`,
        );
      } else if (token) {
        this.logger.log(`[STUB] Dev token for ${request.to} → ${token}`);
      }
    }

    return Promise.resolve({ messageId });
  }

  getSentMails(): SendMailRequest[] {
    return [...this.sentMails];
  }

  clearSentMails(): void {
    this.sentMails.length = 0;
  }
}
