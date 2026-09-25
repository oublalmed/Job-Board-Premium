import type { AxeMatchers } from 'vitest-axe';

// ENF-11 — vitest-axe ships its type augmentation against the legacy `Vi`
// namespace, which Vitest 3 no longer uses for `expect(...)` assertions (it
// augments `declare module 'vitest'` instead, the same channel jest-dom uses).
// This bridges the axe matchers onto Vitest 3's `Assertion` so
// `expect(results).toHaveNoViolations()` type-checks. Runtime registration is
// still done via `expect.extend(axeMatchers)` in the test file.
declare module 'vitest' {
  // Interface merging to attach the axe matchers; empty bodies are the whole
  // point of the augmentation, so the empty-interface rule doesn't apply.
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  interface Assertion extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}
