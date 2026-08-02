# Job Board Premium — Frontend

React 18 + TypeScript (strict) + Vite. Sibling project to the backend at
the repo root — see the root `PROGRESS.md` ("Frontend — Front 0") for why
it's not an npm workspace.

## Setup

```bash
npm install
cp .env.example .env.local   # then adjust VITE_API_BASE_URL if needed
npm run dev
```

Requires the backend running (see the repo root `README.md`) at the URL
configured in `.env.local`.

## Scripts

| Command                | What it does                                          |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Vite dev server (default: http://localhost:5173)       |
| `npm run build`         | Typecheck (`tsc -b`) + production build to `dist/`      |
| `npm run preview`       | Serve the production build locally                      |
| `npm run lint`          | ESLint (auto-fix)                                        |
| `npm run format`        | Prettier (write)                                          |
| `npm run generate:api`  | Regenerate `src/api/schema.d.ts` from the backend's OpenAPI contract |

## API client

`src/api/schema.d.ts` is **generated**, never hand-edited — it's the
TypeScript mirror of the backend's real OpenAPI contract
(`GET /api/v1/docs-json`, only served outside `NODE_ENV=production` — see
`main.ts` on the backend). `src/api/client.ts` wraps it with
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) for fully typed
requests/responses (paths, params, bodies) without a second, separately-
maintained set of API types.

To regenerate after a backend change:

```bash
# 1. Start the backend (repo root)
npm run start:dev

# 2. From frontend/, with the backend reachable at localhost:3000
npm run generate:api
```

Commit the regenerated `schema.d.ts` alongside whatever frontend code
change depended on the new/changed endpoint — same discipline as the
backend's own migrations: generated from a real source, reviewed like
any other diff, never written by hand.

## i18n / RTL

FR and AR, `react-i18next`. AR is RTL — `src/i18n/index.ts` is the single
place that derives `<html lang>`/`<html dir>` from the active locale.
Layout code must use CSS logical properties (`ps-*`/`pe-*`/`ms-*`/`me-*`,
`text-start`/`text-end`) instead of physical ones (`pl-*`/`pr-*`/
`text-left`) — physical properties don't flip with `dir` and will look
broken in Arabic. New translation keys go in both
`src/i18n/locales/fr/common.json` and `.../ar/common.json` — never a
hardcoded string in a component, including French.

## Design system

Tailwind v4 (CSS-first — no `tailwind.config.js`) + shadcn/ui. All design
tokens (colors, radius, font stack) live in exactly one place:
`src/index.css`'s `:root`/`.dark`/`@theme inline` blocks. Add new shadcn
components with `npx shadcn add <component>` (not `shadcn init` — see the
Front 0 commit 2 message for a documented CLI bug in this repo's
environment; components.json is already committed and correct).
