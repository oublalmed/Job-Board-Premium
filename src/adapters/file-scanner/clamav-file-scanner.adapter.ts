import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'node:net';
import { FileScanner, ScanResult } from '../../ports/file-scanner.port.js';

// EF-CAND-03 — real antivirus adapter speaking the clamd INSTREAM protocol
// over a plain TCP socket (Node's built-in `net`, no extra dependency).
//
// Wire protocol (clamd):
//   1. send the command `zINSTREAM\0` (the `z` prefix = NUL-terminated reply)
//   2. stream the file as one or more chunks, each framed by a 4-byte
//      big-endian length prefix followed by that many bytes
//   3. terminate with a zero-length chunk (4 zero bytes)
//   4. clamd replies `stream: OK\0` (clean) or
//      `stream: <SignatureName> FOUND\0` (infected), or an `... ERROR` line.
@Injectable()
export class ClamavFileScannerAdapter implements FileScanner {
  private readonly logger = new Logger(ClamavFileScannerAdapter.name);
  private readonly host: string;
  private readonly port: number;
  // clamd's own StreamMaxLength defaults to 25M; frame the stream well under
  // that per chunk. The overall upload size limit is enforced upstream.
  private readonly chunkSize = 64 * 1024;
  private readonly timeoutMs = 30_000;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.get<string>('antivirus.host', 'localhost');
    this.port = this.config.get<number>('antivirus.port', 3310);
  }

  scan(buffer: Buffer, filename: string): Promise<ScanResult> {
    return new Promise<ScanResult>((resolve, reject) => {
      const socket = this.createConnection();
      const chunks: Buffer[] = [];
      let settled = false;

      const done = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        fn();
      };

      socket.setTimeout(this.timeoutMs);

      socket.on('connect', () => {
        try {
          socket.write('zINSTREAM\0');
          for (
            let offset = 0;
            offset < buffer.length;
            offset += this.chunkSize
          ) {
            const chunk = buffer.subarray(offset, offset + this.chunkSize);
            const size = Buffer.alloc(4);
            size.writeUInt32BE(chunk.length, 0);
            socket.write(size);
            socket.write(chunk);
          }
          // Zero-length terminating chunk.
          socket.write(Buffer.from([0, 0, 0, 0]));
        } catch (err) {
          done(() => reject(this.toError(err)));
        }
      });

      socket.on('data', (data: Buffer) => chunks.push(data));

      // clamd closes the connection once it has written its reply.
      socket.on('end', () =>
        done(() => this.settleFromResponse(chunks, filename, resolve, reject)),
      );
      socket.on('close', () =>
        done(() => this.settleFromResponse(chunks, filename, resolve, reject)),
      );

      socket.on('timeout', () =>
        done(() =>
          reject(new Error(`ClamAV scan timed out after ${this.timeoutMs}ms`)),
        ),
      );
      socket.on('error', (err) => done(() => reject(this.toError(err))));
    });
  }

  // Extracted so tests can inject a fake socket without a live daemon.
  protected createConnection(): net.Socket {
    return net.createConnection({ host: this.host, port: this.port });
  }

  private settleFromResponse(
    chunks: Buffer[],
    filename: string,
    resolve: (r: ScanResult) => void,
    reject: (e: Error) => void,
  ): void {
    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      resolve(this.parseResponse(raw, filename));
    } catch (err) {
      reject(this.toError(err));
    }
  }

  // Parses a clamd INSTREAM reply into a ScanResult. Throws on an empty or
  // ERROR response so the caller treats a scanner failure as a failure rather
  // than silently passing the file.
  parseResponse(raw: string, filename?: string): ScanResult {
    const text = raw.replace(/\0/g, '').trim();
    if (text.length === 0) {
      throw new Error('ClamAV returned an empty response');
    }

    const found = text.match(/:\s*(.+?)\s+FOUND$/);
    if (found) {
      const threat = found[1];
      this.logger.warn(
        `ClamAV flagged ${filename ?? 'upload'} as infected: ${threat}`,
      );
      return { clean: false, threat };
    }

    if (/\bOK$/.test(text)) {
      return { clean: true };
    }

    throw new Error(`ClamAV scan error: ${text}`);
  }

  private toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
  }
}
