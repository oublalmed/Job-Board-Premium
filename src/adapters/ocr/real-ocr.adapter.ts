import { Injectable, Logger } from '@nestjs/common';
import { OcrProvider, OcrExtractionResult } from '../../ports/ocr.port.js';

// Real document text extraction (replaces StubOcrAdapter):
//   • PDF   → the embedded text layer via pdf-parse (fast, offline; the common
//             case for CVs/diplomas exported as text PDFs).
//   • Image → OCR via tesseract.js (fra+eng) for scanned PNG/JPEG documents.
// The extracted text is matched against the grande-école reference by
// SchoolVerificationService. Any failure degrades to empty text + 0 confidence
// (so the match returns null and the admin decides) — never a crash.
@Injectable()
export class RealOcrAdapter implements OcrProvider {
  private readonly logger = new Logger(RealOcrAdapter.name);

  async extractText(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<OcrExtractionResult> {
    try {
      if (mimeType === 'application/pdf') {
        const text = await this.extractPdfText(fileBuffer);
        const confidence = text.trim().length > 0 ? 92 : 0;
        this.logger.log(
          `PDF text extracted: ${text.length} chars, confidence=${confidence}`,
        );
        return { text, confidence };
      }
      if (
        mimeType === 'image/png' ||
        mimeType === 'image/jpeg' ||
        mimeType === 'image/jpg'
      ) {
        return await this.extractImageText(fileBuffer);
      }
      this.logger.warn(`Unsupported OCR mime type: ${mimeType}`);
      return { text: '', confidence: 0 };
    } catch (err) {
      this.logger.warn(
        `OCR extraction failed (${mimeType}): ${(err as Error).message}`,
      );
      return { text: '', confidence: 0 };
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    // pdf-parse v2: class API over pdfjs. Extracts the embedded text layer.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text ?? '';
    } finally {
      await parser.destroy();
    }
  }

  private async extractImageText(buffer: Buffer): Promise<OcrExtractionResult> {
    const { recognize } = await import('tesseract.js');
    const { data } = await recognize(buffer, 'fra+eng');
    const confidence = Math.round(data.confidence ?? 0);
    this.logger.log(
      `Image OCR: ${data.text?.length ?? 0} chars, confidence=${confidence}`,
    );
    return { text: data.text ?? '', confidence };
  }
}
