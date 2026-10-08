import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { MailProvider, SendMailRequest } from '../../ports/mail.port.js';
import { mailFrom } from './smtp-transport.js';
import {
  resolveContent,
  renderHtml,
  renderText,
  parseSender,
} from './mail-renderer.js';

// Brevo transactional email via REST API (port 443). Chosen over SMTP when
// MAIL_DRIVER=brevo because many cloud providers (Railway, Render, …) block
// outbound SMTP ports (25/465/587/2525); HTTPS is never blocked.
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class BrevoMailAdapter implements MailProvider {
  private readonly logger = new Logger(BrevoMailAdapter.name);
  private readonly apiKey = process.env['BREVO_API_KEY'] ?? '';
  private readonly sender = parseSender(mailFrom());

  async send(request: SendMailRequest): Promise<{ messageId: string }> {
    const content = resolveContent(
      request.templateId,
      request.subject,
      request.variables ?? {},
      request.to,
    );
    const dir = request.locale === 'ar' ? 'rtl' : 'ltr';
    const html = renderHtml(content, request.subject, dir);
    const text = renderText(content);

    const body = JSON.stringify({
      sender: this.sender,
      to: [{ email: request.to }],
      subject: request.subject,
      htmlContent: html,
      textContent: text,
    });

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const msg = `Brevo API error ${response.status}: ${detail}`;
      this.logger.error(
        `[BREVO] Failed to send to=${request.to}, template=${request.templateId}: ${msg}`,
      );
      throw new Error(msg);
    }

    const data = (await response.json()) as { messageId?: string };
    const messageId = data.messageId ?? uuidv4();
    this.logger.log(
      `[BREVO] Email sent to=${request.to}, subject="${request.subject}", template=${request.templateId}, messageId=${messageId}`,
    );
    return { messageId };
  }
}
