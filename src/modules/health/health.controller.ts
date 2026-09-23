import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

// Heap ceiling for the readiness probe. Kept generous (512 MiB) so a healthy
// process is never marked unready by ordinary load; a breach signals a real
// leak/pressure, at which point the orchestrator should stop routing traffic.
const READINESS_HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

// ENF-09 (observabilité) — Kubernetes-style probes. Three endpoints, each with
// a distinct contract so the orchestrator can act correctly (see deploy/k8s):
//   /health       — full check (backwards-compatible aggregate)
//   /health/live  — liveness: is the process itself up? No external deps, so a
//                   transient DB blip never triggers a pod restart loop.
//   /health/ready — readiness: can this instance serve traffic right now?
//                   DB reachable + heap within budget. A failure here pulls the
//                   pod out of the load balancer without killing it.
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', READINESS_HEAP_LIMIT_BYTES),
    ]);
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
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', READINESS_HEAP_LIMIT_BYTES),
    ]);
  }
}
