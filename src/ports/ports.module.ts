import { Global, Module } from '@nestjs/common';
import { SCORING_PROVIDER } from './scoring.port.js';
import { PAYMENT_PROVIDER } from './payment.port.js';
import { MAIL_PROVIDER } from './mail.port.js';
import { FILE_SCANNER } from './file-scanner.port.js';
import { OBJECT_STORAGE } from './object-storage.port.js';
import { OCR_PROVIDER } from './ocr.port.js';
import { StubScoringAdapter } from '../adapters/scoring/stub-scoring.adapter.js';
import { StripePaymentProvider } from '../adapters/payment/stripe-payment.adapter.js';
import { StubMailAdapter } from '../adapters/mail/stub-mail.adapter.js';
import { StubFileScannerAdapter } from '../adapters/file-scanner/stub-file-scanner.adapter.js';
import { StubObjectStorageAdapter } from '../adapters/object-storage/stub-object-storage.adapter.js';
import { StubOcrAdapter } from '../adapters/ocr/stub-ocr.adapter.js';

@Global()
@Module({
  providers: [
    { provide: SCORING_PROVIDER, useClass: StubScoringAdapter },
    { provide: PAYMENT_PROVIDER, useClass: StripePaymentProvider },
    { provide: MAIL_PROVIDER, useClass: StubMailAdapter },
    { provide: FILE_SCANNER, useClass: StubFileScannerAdapter },
    { provide: OBJECT_STORAGE, useClass: StubObjectStorageAdapter },
    { provide: OCR_PROVIDER, useClass: StubOcrAdapter },
  ],
  exports: [
    SCORING_PROVIDER,
    PAYMENT_PROVIDER,
    MAIL_PROVIDER,
    FILE_SCANNER,
    OBJECT_STORAGE,
    OCR_PROVIDER,
  ],
})
export class PortsModule {}
