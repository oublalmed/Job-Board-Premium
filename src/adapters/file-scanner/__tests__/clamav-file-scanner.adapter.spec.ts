import { EventEmitter } from 'node:events';
import { ConfigService } from '@nestjs/config';
import { ClamavFileScannerAdapter } from '../clamav-file-scanner.adapter.js';
import { StubFileScannerAdapter } from '../stub-file-scanner.adapter.js';
import { fileScannerFactory } from '../../../ports/ports.module.js';

// Minimal fake clamd socket: an EventEmitter with the Socket surface the
// adapter touches. `write` records the framed bytes so the INSTREAM protocol
// can be asserted.
class FakeSocket extends EventEmitter {
  writes: Buffer[] = [];
  destroyed = false;
  setTimeout = jest.fn();
  write = jest.fn((data: string | Buffer) => {
    this.writes.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return true;
  });
  destroy = jest.fn(() => {
    this.destroyed = true;
  });
}

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  return {
    get: <T>(key: string, def?: T): T => (overrides[key] as T) ?? (def as T),
  } as unknown as ConfigService;
}

describe('fileScannerFactory (adapter selection)', () => {
  it('defaults to the stub adapter when ANTIVIRUS_DRIVER is unset', () => {
    const scanner = fileScannerFactory(makeConfig());
    expect(scanner).toBeInstanceOf(StubFileScannerAdapter);
  });

  it('returns the stub adapter when driver is explicitly "stub"', () => {
    const scanner = fileScannerFactory(
      makeConfig({ 'antivirus.driver': 'stub' }),
    );
    expect(scanner).toBeInstanceOf(StubFileScannerAdapter);
  });

  it('returns the ClamAV adapter when driver is "clamav"', () => {
    const scanner = fileScannerFactory(
      makeConfig({ 'antivirus.driver': 'clamav' }),
    );
    expect(scanner).toBeInstanceOf(ClamavFileScannerAdapter);
  });
});

describe('ClamavFileScannerAdapter.parseResponse', () => {
  const adapter = new ClamavFileScannerAdapter(makeConfig());

  it('parses a clean "stream: OK" reply', () => {
    expect(adapter.parseResponse('stream: OK\0')).toEqual({ clean: true });
  });

  it('parses an infected "... FOUND" reply and extracts the threat name', () => {
    expect(
      adapter.parseResponse('stream: Eicar-Test-Signature FOUND\0'),
    ).toEqual({ clean: false, threat: 'Eicar-Test-Signature' });
  });

  it('throws on an ERROR reply rather than passing the file', () => {
    expect(() =>
      adapter.parseResponse('INSTREAM size limit exceeded ERROR\0'),
    ).toThrow(/ClamAV scan error/);
  });

  it('throws on an empty reply', () => {
    expect(() => adapter.parseResponse('')).toThrow(/empty response/);
  });
});

describe('ClamavFileScannerAdapter.scan (mocked socket)', () => {
  let adapter: ClamavFileScannerAdapter;
  let socket: FakeSocket;

  beforeEach(() => {
    adapter = new ClamavFileScannerAdapter(
      makeConfig({ 'antivirus.host': 'clamd', 'antivirus.port': 3310 }),
    );
    socket = new FakeSocket();
    jest
      .spyOn(
        adapter as unknown as { createConnection: () => FakeSocket },
        'createConnection',
      )
      .mockReturnValue(socket);
  });

  it('streams the buffer with the INSTREAM framing and resolves clean on OK', async () => {
    const promise = adapter.scan(Buffer.from('hello'), 'cv.pdf');
    socket.emit('connect');

    // zINSTREAM command, then a 4-byte length frame + payload, then the
    // zero-length terminating chunk.
    expect(socket.writes[0].toString()).toBe('zINSTREAM\0');
    expect(socket.writes[1].readUInt32BE(0)).toBe(5);
    expect(socket.writes[2].toString()).toBe('hello');
    expect(socket.writes[3].readUInt32BE(0)).toBe(0);

    socket.emit('data', Buffer.from('stream: OK\0'));
    socket.emit('end');

    await expect(promise).resolves.toEqual({ clean: true });
    expect(socket.destroy).toHaveBeenCalled();
  });

  it('resolves infected with the threat name on FOUND', async () => {
    const promise = adapter.scan(Buffer.from('x'), 'cv.pdf');
    socket.emit('connect');
    socket.emit('data', Buffer.from('stream: Win.Test.EICAR_HDB-1 FOUND\0'));
    socket.emit('close');

    await expect(promise).resolves.toEqual({
      clean: false,
      threat: 'Win.Test.EICAR_HDB-1',
    });
  });

  it('rejects on a socket error', async () => {
    const promise = adapter.scan(Buffer.from('x'), 'cv.pdf');
    socket.emit('error', new Error('ECONNREFUSED'));

    await expect(promise).rejects.toThrow(/ECONNREFUSED/);
  });
});
