import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MailProvider, SendMailRequest } from '../../ports/mail.port.js';

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
    return Promise.resolve({ messageId });
  }

  getSentMails(): SendMailRequest[] {
    return [...this.sentMails];
  }

  clearSentMails(): void {
    this.sentMails.length = 0;
  }
}
