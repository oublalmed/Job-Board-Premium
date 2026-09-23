import { Injectable } from '@nestjs/common';
import { LinkProber, LinkProbeResult } from '../../ports/link-prober.port.js';

// EF-CAND-04 — deterministic prober for CI/dev, selected when
// LINK_PROBER_DRIVER != 'http'. It performs NO outbound network I/O (keeping
// test runs hermetic) and reports every syntactically valid http/https URL as
// reachable. The real HttpLinkProberAdapter is enabled in production.
@Injectable()
export class StubLinkProberAdapter implements LinkProber {
  probe(url: string): Promise<LinkProbeResult> {
    try {
      const parsed = new URL(url);
      const ok = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      return Promise.resolve(
        ok
          ? { reachable: true, statusCode: 200 }
          : { reachable: false, reason: 'unsupported_scheme' },
      );
    } catch {
      return Promise.resolve({ reachable: false, reason: 'invalid_url' });
    }
  }
}
