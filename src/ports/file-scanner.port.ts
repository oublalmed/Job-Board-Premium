export interface ScanResult {
  clean: boolean;
  threat?: string;
}

export interface FileScanner {
  scan(buffer: Buffer, filename: string): Promise<ScanResult>;
}

export const FILE_SCANNER = Symbol('FILE_SCANNER');
