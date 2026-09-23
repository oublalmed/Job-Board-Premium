import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import { LinkProber, LinkProbeResult } from '../../ports/link-prober.port.js';

// EF-CAND-04 — real accessibility prober for candidate-supplied URLs.
//
// SSRF is the dominant risk here: we are fetching an attacker-controlled URL
// from inside the platform's network. Defences applied, in order:
//   1. Only http/https schemes are allowed.
//   2. The host is DNS-resolved up front and EVERY resolved address must be a
//      public unicast address — loopback, private (RFC 1918), link-local,
//      CGNAT, ULA, mapped/embedded ranges and unspecified addresses are all
//      rejected before any socket is opened.
//   3. Redirects are NOT followed automatically (`redirect: 'manual'`), so a
//      public URL cannot bounce us onto an internal 302 target. A 3xx still
//      proves the origin is reachable, which is all this check asserts.
// There remains a theoretical DNS-rebinding TOCTOU window between the lookup
// and the connect; the manual-redirect + resolved-set check keeps it small and
// this deterrent layer is not a substitute for network egress controls, which
// belong to the infrastructure (documented in HARDENING.md).
@Injectable()
export class HttpLinkProberAdapter implements LinkProber {
  private readonly logger = new Logger(HttpLinkProberAdapter.name);
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.timeoutMs = config.get<number>('business.linkProbeTimeoutMs', 5000);
  }

  async probe(url: string): Promise<LinkProbeResult> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { reachable: false, reason: 'invalid_url' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { reachable: false, reason: 'unsupported_scheme' };
    }

    try {
      await this.assertPublicHost(parsed.hostname);
    } catch (error) {
      // Refusing to probe an internal/reserved target is a security decision,
      // not a candidate error — surface it as unreachable and log at debug.
      this.logger.debug(
        `Refusing to probe ${parsed.hostname}: ${(error as Error).message}`,
      );
      return { reachable: false, reason: 'blocked_host' };
    }

    return this.request(parsed);
  }

  private async request(url: URL): Promise<LinkProbeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      // HEAD first (cheap). Some origins reject HEAD (405/501) — fall back to a
      // ranged GET that asks for a single byte so we never download a body.
      let response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'CobaltLinkProbe/1.0' },
      });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'user-agent': 'CobaltLinkProbe/1.0', range: 'bytes=0-0' },
        });
      }
      const reachable = response.status < 500;
      return {
        reachable,
        statusCode: response.status,
        reason: reachable ? undefined : 'server_error',
      };
    } catch (error) {
      const reason =
        (error as Error).name === 'AbortError' ? 'timeout' : 'network_error';
      return { reachable: false, reason };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolve `hostname` and throw if it is (or resolves to) any non-public
   * address. Accepts IP literals without a DNS round-trip.
   */
  private async assertPublicHost(hostname: string): Promise<void> {
    // `URL.hostname` keeps the brackets around an IPv6 literal
    // (e.g. "[::1]"); strip them so net.isIP recognises the address.
    const host =
      hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname;
    const literalFamily = net.isIP(host);
    if (literalFamily !== 0) {
      this.assertPublicAddress(host);
      return;
    }
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) {
      throw new Error('no_dns_records');
    }
    for (const { address } of records) {
      this.assertPublicAddress(address);
    }
  }

  private assertPublicAddress(address: string): void {
    if (net.isIPv4(address)) {
      if (HttpLinkProberAdapter.isPrivateIpv4(address)) {
        throw new Error(`private_ipv4:${address}`);
      }
      return;
    }
    // IPv6 (possibly an IPv4-mapped ::ffff:a.b.c.d address).
    const mapped = HttpLinkProberAdapter.extractMappedIpv4(address);
    if (mapped) {
      if (HttpLinkProberAdapter.isPrivateIpv4(mapped)) {
        throw new Error(`private_mapped_ipv4:${mapped}`);
      }
      return;
    }
    if (HttpLinkProberAdapter.isPrivateIpv6(address)) {
      throw new Error(`private_ipv6:${address}`);
    }
  }

  private static isPrivateIpv4(address: string): boolean {
    const parts = address.split('.').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8 "this host"
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 test
    if (a >= 224) return true; // multicast + reserved (224.0.0.0/3)
    return false;
  }

  private static extractMappedIpv4(address: string): string | null {
    const lower = address.toLowerCase();
    const idx = lower.lastIndexOf(':');
    const tail = lower.slice(idx + 1);
    if (
      (lower.startsWith('::ffff:') || lower.startsWith('::')) &&
      net.isIPv4(tail)
    ) {
      return tail;
    }
    return null;
  }

  private static isPrivateIpv6(address: string): boolean {
    const a = address.toLowerCase();
    if (a === '::1' || a === '::') return true; // loopback / unspecified
    if (
      a.startsWith('fe8') ||
      a.startsWith('fe9') ||
      a.startsWith('fea') ||
      a.startsWith('feb')
    )
      return true; // fe80::/10 link-local
    if (a.startsWith('fc') || a.startsWith('fd')) return true; // fc00::/7 ULA
    if (a.startsWith('ff')) return true; // ff00::/8 multicast
    return false;
  }
}
