import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OcrProvider, OcrExtractionResult } from '../../ports/ocr.port.js';

// No real OCR vendor is wired up yet — this stub fabricates plausible
// extracted text instead of actually reading the file. Deterministic
// (hashed from the file bytes, never Math.random()) so the same upload
// always produces the same result, which is what makes it testable and
// what keeps repeated candidate uploads from flapping between outcomes.
// A real adapter (e.g. Textract/Google Vision/Mindee) would replace this
// entirely — SchoolVerificationService only depends on the OcrProvider
// interface, not on how the text was produced.
const STUB_DIPLOMA_TEXTS = [
  "DIPLOME NATIONAL\nEcole Nationale Superieure d'Informatique et d'Analyse des Systemes\nENSIAS - Rabat\nDelivre a l'issue du cycle ingenieur",
  "ATTESTATION DE REUSSITE\nEcole Mohammadia d'Ingenieurs\nEMI - Universite Mohammed V\nRabat, Maroc",
  'DIPLOME\nEcole Hassania des Travaux Publics\nEHTP Casablanca',
  'CERTIFICATE OF GRADUATION\nUniversite privee\nProgramme non reconnu',
];

@Injectable()
export class StubOcrAdapter implements OcrProvider {
  private readonly logger = new Logger(StubOcrAdapter.name);

  extractText(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<OcrExtractionResult> {
    const hash = createHash('sha256').update(fileBuffer).digest();
    const index = hash[0] % STUB_DIPLOMA_TEXTS.length;
    // Spread across a realistic OCR confidence band (60-95) instead of a
    // single fixed number, still fully deterministic per-file.
    const confidence = 60 + (hash[1] % 36);

    this.logger.log(
      `[STUB] OCR extraction for ${mimeType} file (${fileBuffer.length} bytes) -> sample #${index}, confidence=${confidence}`,
    );

    return Promise.resolve({
      text: STUB_DIPLOMA_TEXTS[index],
      confidence,
    });
  }
}
