import { ConfigService } from '@nestjs/config';
import { HttpLinkProberAdapter } from '../http-link-prober.adapter.js';

// Exercises the SSRF guard and the reachable/unreachable status mapping.
// IP-literal hosts short-circuit DNS, so these cases need no DNS stubbing;
// outbound HTTP is stubbed by replacing the global fetch.
describe('HttpLinkProberAdapter (EF-CAND-04 SSRF guard)', () => {
  const config = {
    get: (_key: string, def: unknown) => def,
  } as unknown as ConfigService;
  const adapter = new HttpLinkProberAdapter(config);

  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects a non-http(s) scheme without any network call', async () => {
    const spy = jest.fn();
    global.fetch = spy;
    const result = await adapter.probe('ftp://example.com/file');
    expect(result).toEqual({ reachable: false, reason: 'unsupported_scheme' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a malformed URL', async () => {
    const result = await adapter.probe('not a url');
    expect(result.reachable).toBe(false);
    expect(result.reason).toBe('invalid_url');
  });

  it.each([
    ['loopback', 'http://127.0.0.1/'],
    ['private 10/8', 'http://10.0.0.5/'],
    ['private 192.168/16', 'http://192.168.1.1/'],
    ['link-local / cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['IPv6 ULA', 'http://[fd00::1]/'],
  ])('blocks %s (%s) as an internal target', async (_label, url) => {
    const spy = jest.fn();
    global.fetch = spy;
    const result = await adapter.probe(url);
    expect(result).toEqual({ reachable: false, reason: 'blocked_host' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a public host that answers 2xx as reachable', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 200 });
    // 93.184.216.34 is a public IP literal → no DNS lookup needed.
    const result = await adapter.probe('https://93.184.216.34/');
    expect(result.reachable).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('reports a 5xx public host as unreachable', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 503 });
    const result = await adapter.probe('https://93.184.216.34/');
    expect(result.reachable).toBe(false);
    expect(result.reason).toBe('server_error');
  });

  it('treats a network error as unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await adapter.probe('https://93.184.216.34/');
    expect(result.reachable).toBe(false);
    expect(result.reason).toBe('network_error');
  });
});
