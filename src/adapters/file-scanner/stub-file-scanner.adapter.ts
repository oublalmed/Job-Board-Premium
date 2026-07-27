import { Injectable, Logger } from '@nestjs/common';
import { FileScanner, ScanResult } from '../../ports/file-scanner.port.js';

@Injectable()
export class StubFileScannerAdapter implements FileScanner {
  private readonly logger = new Logger(StubFileScannerAdapter.name);

  scan(_buffer: Buffer, filename: string): Promise<ScanResult> {
    this.logger.log(`[STUB] File scanned: ${filename} (always clean)`);
    return Promise.resolve({ clean: true });
  }
}
