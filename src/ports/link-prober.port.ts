// EF-CAND-04 — asynchronous accessibility verification of candidate-supplied
// external profile links (GitHub / portfolio / LinkedIn / other).
//
// A narrow outbound-HTTP port so the domain (LinkVerificationService) never
// depends on `fetch`, DNS, or SSRF-guard details directly: the HTTP adapter is
// swappable (real prober in prod, deterministic stub in CI/dev) and the service
// stays trivially unit-testable. Same convention as FileScanner / Mailer.
export interface LinkProbeResult {
  /**
   * True when the origin answered with a non-server-error HTTP status within
   * the timeout. A 4xx (e.g. a private portfolio behind auth) still counts as
   * "reachable" — the host exists and responded. Network errors, DNS
   * failures, timeouts, 5xx and SSRF-blocked targets are `false`.
   */
  readonly reachable: boolean;
  /** HTTP status observed, when a response was received (diagnostics/logging). */
  readonly statusCode?: number;
  /** Short machine reason when unreachable (diagnostics/logging only). */
  readonly reason?: string;
}

export interface LinkProber {
  probe(url: string): Promise<LinkProbeResult>;
}

export const LINK_PROBER = Symbol('LINK_PROBER');
