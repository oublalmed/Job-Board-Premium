export interface OcrExtractionResult {
  text: string;
  // 0-100 — how confident the OCR engine is in the extracted text itself,
  // independent of whether that text matches a known grande école (that
  // matching happens separately, in SchoolVerificationService).
  confidence: number;
}

export interface OcrProvider {
  extractText(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<OcrExtractionResult>;
}

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
