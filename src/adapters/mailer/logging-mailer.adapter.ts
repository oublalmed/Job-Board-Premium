import { Injectable, Logger } from '@nestjs/common';
import { Mailer, SendMailParams } from '../../ports/mailer.port.js';

// EF-MSG-02 — the default, CI/dev-safe Mailer: it logs instead of sending, so
// it needs no external service, no credentials and no new required env. It is
// the only adapter shipped today; an SMTP adapter (env MAIL_DRIVER=smtp) is a
// documented extension point — add a `SmtpMailerAdapter implements Mailer` and
// select it in PortsModule once a real transport dependency is introduced.
@Injectable()
export class LoggingMailerAdapter implements Mailer {
  private readonly logger = new Logger(LoggingMailerAdapter.name);

  sendMail(params: SendMailParams): Promise<void> {
    this.logger.log(
      `[LOG-MAILER] Email dispatched to=${params.to}, subject="${params.subject}"`,
    );
    return Promise.resolve();
  }
}
