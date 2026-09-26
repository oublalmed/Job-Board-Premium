import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SCORING_PROVIDER } from './scoring.port.js';
import { PAYMENT_PROVIDER } from './payment.port.js';
import { MAIL_PROVIDER } from './mail.port.js';
import { MAILER } from './mailer.port.js';
import { FILE_SCANNER, type FileScanner } from './file-scanner.port.js';
import { OBJECT_STORAGE } from './object-storage.port.js';
import { OCR_PROVIDER } from './ocr.port.js';
import { StubScoringAdapter } from '../adapters/scoring/stub-scoring.adapter.js';
import { StripePaymentProvider } from '../adapters/payment/stripe-payment.adapter.js';
import { StubMailAdapter } from '../adapters/mail/stub-mail.adapter.js';
import { SmtpMailAdapter } from '../adapters/mail/smtp-mail.adapter.js';
import type { MailProvider } from './mail.port.js';
import { LoggingMailerAdapter } from '../adapters/mailer/logging-mailer.adapter.js';
import { StubFileScannerAdapter } from '../adapters/file-scanner/stub-file-scanner.adapter.js';
import { ClamavFileScannerAdapter } from '../adapters/file-scanner/clamav-file-scanner.adapter.js';
import { StubObjectStorageAdapter } from '../adapters/object-storage/stub-object-storage.adapter.js';
import { StubOcrAdapter } from '../adapters/ocr/stub-ocr.adapter.js';

// EF-CAND-03 — select the antivirus adapter by ANTIVIRUS_DRIVER. Default is
// `stub` (always clean) so CI/local/dev behavior is unchanged; `clamav`
// streams uploads to a clamd daemon. Kept as an exported factory so the
// selection logic is unit-testable without booting the module.
export function fileScannerFactory(config: ConfigService): FileScanner {
  const driver = config.get<string>('antivirus.driver', 'stub');
  if (driver === 'clamav') {
    return new ClamavFileScannerAdapter(config);
  }
  return new StubFileScannerAdapter();
}

// EF-CAND-01 / EF-MSG-02 — select the mail provider by MAIL_DRIVER. Default is
// `log` (StubMailAdapter: no network, logs a dev link); `smtp` delivers real
// mail via Nodemailer (local catcher like Mailpit in dev, a relay elsewhere).
export function mailProviderFactory(config: ConfigService): MailProvider {
  const driver = config.get<string>('notifications.mailDriver', 'log');
  if (driver === 'smtp') {
    return new SmtpMailAdapter();
  }
  return new StubMailAdapter();
}

@Global()
@Module({
  providers: [
    { provide: SCORING_PROVIDER, useClass: StubScoringAdapter },
    { provide: PAYMENT_PROVIDER, useClass: StripePaymentProvider },
    {
      provide: MAIL_PROVIDER,
      useFactory: mailProviderFactory,
      inject: [ConfigService],
    },
    { provide: MAILER, useClass: LoggingMailerAdapter },
    {
      provide: FILE_SCANNER,
      useFactory: fileScannerFactory,
      inject: [ConfigService],
    },
    { provide: OBJECT_STORAGE, useClass: StubObjectStorageAdapter },
    { provide: OCR_PROVIDER, useClass: StubOcrAdapter },
  ],
  exports: [
    SCORING_PROVIDER,
    PAYMENT_PROVIDER,
    MAIL_PROVIDER,
    MAILER,
    FILE_SCANNER,
    OBJECT_STORAGE,
    OCR_PROVIDER,
  ],
})
export class PortsModule {}
