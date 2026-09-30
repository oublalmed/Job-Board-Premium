import { ConfigService } from '@nestjs/config';
import { OcrProvider } from '../../ports/ocr.port.js';
import { StubOcrAdapter } from './stub-ocr.adapter.js';
import { RealOcrAdapter } from './real-ocr.adapter.js';

// OCR_DRIVER selects the extractor at boot:
//   • 'stub' (default) — deterministic fake text; keeps CI/tests hermetic.
//   • 'real'           — pdf-parse (PDF) + tesseract.js (images).
export function ocrProviderFactory(config: ConfigService): OcrProvider {
  const driver = config.get<string>('OCR_DRIVER') ?? 'stub';
  return driver === 'real' ? new RealOcrAdapter() : new StubOcrAdapter();
}
