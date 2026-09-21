import { registerAs } from '@nestjs/config';

// EF-CAND-03 — antivirus scanning of candidate uploads. `driver` selects the
// bound FileScanner adapter (see PortsModule): `stub` (default, always clean)
// keeps CI/local/dev behavior unchanged, `clamav` streams uploads to a clamd
// daemon over TCP. Host/port are only consulted by the ClamAV adapter.
export const antivirusConfig = registerAs('antivirus', () => ({
  driver: process.env['ANTIVIRUS_DRIVER'] ?? 'stub',
  host: process.env['CLAMAV_HOST'] ?? 'localhost',
  port: parseInt(process.env['CLAMAV_PORT'] ?? '3310', 10),
}));
