import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

// ENF-09 (observabilité) — Kubernetes-style probes. Three endpoints, each with
// a distinct contract so the orchestrator can act correctly (see deploy/k8s):
//   /health       — full check (backwards-compatible aggregate)
//   /health/live  — liveness: is the process itself up? No external deps, so a
//                   transient DB blip never triggers a pod restart loop.
//   /health/ready — readiness: can this instance serve traffic right now?
//                   DB reachable. A failure here pulls the pod out of the load
//                   balancer without killing it.
//
// Memory pressure is intentionally NOT a probe signal: the Node heap in a
// healthy process varies widely and a fixed ceiling flaps between environments
// (it would false-fail readiness and the /health contract). Memory limits +
// the OOM killer are the orchestrator's job, not the health endpoint's.
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('live')
  @HealthCheck()
  live() {
    // Liveness must not depend on anything external — a passing HTTP response
    // is itself the signal that the event loop is alive.
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
