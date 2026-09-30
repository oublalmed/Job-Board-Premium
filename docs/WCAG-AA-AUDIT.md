# WCAG 2.1 AA — manual audit checklist (ENF-11)

The automated gate (`frontend/src/a11y/a11y.test.tsx`, vitest-axe) catches the
**machine-detectable** subset of WCAG A/AA — missing labels, ARIA misuse,
roles/names, obvious contrast. It runs in CI and blocks regressions. It does
**not** and cannot replace a human audit: keyboard operability end-to-end,
screen-reader comprehension, real contrast against actual rendered pixels,
focus management, and reflow are judgement calls a person must make.

This checklist makes that human audit turnkey. Run it per release, on the
flows below, with the tools listed. Record pass/fail + notes in the table at
the bottom. **This document is the methodology; the sign-off is the human's.**

## Tools

- **Keyboard only** — unplug the mouse. Tab / Shift+Tab / Enter / Space / Esc / arrows.
- **Screen reader** — NVDA (Windows), VoiceOver (macOS, ⌘+F5), or Orca (Linux).
- **Contrast** — browser DevTools (Elements → Accessibility → contrast), or the
  TPGi Colour Contrast Analyser, on the real rendered UI (light **and** dark themes).
- **Zoom / reflow** — browser zoom to 200% and 400%; viewport 320px wide.
- **axe DevTools** browser extension for a second automated pass on the live app
  (the CI gate runs on components; this runs on full rendered pages).

## Flows to audit (Cobalt)

1. **Auth** — login, register (with the consent checkbox), password reset, MFA step-up.
2. **Candidate** — profile edit, CV upload, assessment start → **exam (QCM)** → result.
3. **Recruiter** — CVthèque search, candidate detail, **Contacter** popup, messaging thread, interview scheduling.
4. **Admin** — subscriptions (assign/suspend/reactivate), recruiters, integrity/anti-cheat.
5. **Billing** — subscription status card, restricted-access bar, invoices.
6. **Locale/RTL** — repeat a core flow in Arabic (RTL): focus order and layout must mirror correctly.

## Checklist (AA success criteria that need a human)

### Keyboard & focus
- [ ] Every interactive element is reachable and operable by keyboard (2.1.1).
- [ ] No keyboard trap — focus can always leave a widget/dialog (2.1.2).
- [ ] Visible focus indicator on every focusable element, both themes (2.4.7).
- [ ] Focus order matches the visual/reading order, incl. RTL (2.4.3).
- [ ] Dialogs (Contacter popup, confirmations) trap focus while open, restore it on close, and close on Esc.
- [ ] The exam QCM options are operable by keyboard and announce selected state (the `aria-pressed` toggle) (4.1.2).

### Screen reader
- [ ] Page has a meaningful `<title>` and a logical heading outline (h1→h2→…) (2.4.2, 1.3.1).
- [ ] Form fields have programmatic labels; errors are announced and associated (3.3.1, 3.3.2, 4.1.2).
- [ ] Status/toasts are announced (live regions) (4.1.3).
- [ ] Icon-only buttons have accessible names.
- [ ] Anonymised/gated states (CVthèque) are conveyed non-visually, not by colour/emphasis alone (1.4.1).

### Contrast & visual
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for large text), light **and** dark themes (1.4.3).
- [ ] UI component / focus-ring contrast ≥ 3:1 (1.4.11).
- [ ] Information is never conveyed by colour alone (1.4.1).

### Reflow & resize
- [ ] No loss of content/function at 200% zoom (1.4.4) and 400% / 320px reflow (1.4.10).
- [ ] No horizontal scrolling of the whole page at 320px width.
- [ ] Text spacing overrides don't clip content (1.4.12).

### Content & media
- [ ] Images convey their meaning via `alt` (decorative images have empty alt) (1.1.1).
- [ ] Language of the page is set (`<html lang>`), and switches for Arabic (`dir="rtl"`) (3.1.1).
- [ ] Motion/animations respect `prefers-reduced-motion` (2.3.3).

## Sign-off log

| Date | Auditor | Build/commit | SR used | Flows | Result | Findings ref |
|------|---------|--------------|---------|-------|--------|--------------|
|      |         |              |         |       |        |              |

> Until a row here is filled with a passing audit, ENF-11 stays **75 %** in the
> audit (automated gate delivered; manual AA sign-off pending). Record each new
> finding as an issue and, once fixed, add a regression case to the axe suite.
