/*
 * ENF-01 / ENF-03 — load-test harness for the hottest read path (CVthèque
 * search) and the health endpoint. This is the measurement tool the audit
 * flagged as missing: it encodes the CDC targets as k6 thresholds so a run
 * either meets them or fails.
 *
 *   CDC targets: API p95 < 400ms (ENF-01); ≥500 concurrent users (ENF-03).
 *
 * Run against a deployed/staging instance (never a laptop dev server, which
 * does not reflect prod hardware):
 *
 *   BASE_URL=https://staging.example \
 *   K6_TOKEN="<recruiter access token>" \
 *   k6 run --vus 500 --duration 2m test/load/k6-search.js
 *
 * Without K6_TOKEN it exercises only the public /health endpoint (still a
 * useful availability/throughput probe); with a token it also drives the
 * authenticated candidate search, which is the p95-sensitive path.
 *
 * Measuring the numbers is an ops activity (needs prod-like infra + a running
 * target); committing the harness is the code deliverable.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API = `${BASE_URL}/api/v1`;
const TOKEN = __ENV.K6_TOKEN || '';

export const options = {
  // Default profile approximates the ENF-03 concurrency target; override with
  // --vus / --stages on the CLI for other shapes.
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 500 },
        { duration: '30s', target: 0 },
      ],
      gracefulStop: '10s',
    },
  },
  thresholds: {
    // ENF-01 — p95 under 400ms, and a low error budget.
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const health = http.get(`${API}/health`, { tags: { name: 'health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  if (TOKEN) {
    const res = http.get(`${API}/search/candidates?limit=20`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      tags: { name: 'search' },
    });
    check(res, {
      'search 200': (r) => r.status === 200,
      'search under 400ms': (r) => r.timings.duration < 400,
    });
  }

  sleep(1);
}
