import { Injectable, Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { Mailer, SendMailParams } from '../../ports/mailer.port.js';
import { createSmtpTransport, mailFrom } from '../mail/smtp-transport.js';

// EF-MSG-02 — real SMTP delivery for the notification email channel. Selected
// when MAIL_DRIVER=smtp (see ports.module.ts); otherwise the logging adapter
// is used. Shares the transport/sender identity with the template MailProvider
// so both channels go out through the same relay. Delivery is best-effort: a
// failure is logged but not rethrown, so a notification never breaks the
// business action that triggered it.
@Injectable()
export class SmtpMailerAdapter implements Mailer {
  private readonly logger = new Logger(SmtpMailerAdapter.name);
  private readonly transporter: Transporter = createSmtpTransport();
  private readonly from = mailFrom();

  async sendMail(params: SendMailParams): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.body,
        html: params.html,
      });
      this.logger.log(
        `[SMTP-MAILER] Email sent to=${params.to}, subject="${params.subject}", messageId=${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `[SMTP-MAILER] Failed to send to=${params.to}, subject="${params.subject}": ${(error as Error).message}`,
      );
    }
  }
}
