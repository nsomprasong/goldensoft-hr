# HR performance benchmark (Phase 8B)

## Goal

**Warm in-app navigation** under **2000ms** for primary HR routes (product target for production-like runs).

## How we measure

The Phase 8B acceptance script (`scripts/phase8b-runtime-acceptance.ts`):

1. Viewport 1280×900
2. **Cold**: full document load (`goto`, `domcontentloaded`, best-effort `networkidle`)
3. **Warm**: return to `/` then client navigation via sidebar link when available (else second `goto`)
4. Records timings per route and horizontal overflow at multiple widths

## Environment caveat (important)

Acceptance runs against **Next.js 15 dev + turbopack** by default. Dev mode compiles on demand and is **not** representative of production.

| Route | Warm (ms) — sample dev run 2026-07-26 |
| --- | --- |
| `/` | 2223 |
| `/employees` | 3076 |
| `/settings/departments` | 1943 |
| `/settings/positions` | 1998 |
| `/settings/shifts` | 1977 |
| `/settings/payroll-schedules` | 2032 |
| `/settings/overtime-rules` | 2032 |
| `/payroll/periods` | 2008 |

Several routes sit near or slightly above 2s in dev; `/employees` is heavier (list + Platform context).

## Acceptance gates

- **CI / local acceptance (dev)**: default pass threshold `ACCEPTANCE_WARM_DEV_MS=3500` unless overridden
- **Production validation** (recommended before go-live): `npm run build && npm run start`, re-run the same routes with Playwright or manual DevTools Performance; expect warm navigation **&lt; 2000ms** on a machine comparable to deployment

## Optimizations already in place (Phase 8B Apply)

- Parallel Platform entitlement checks (`hr.access` + `hr.employee_limit`) in `resolveHrRequestContext`
- Test-auth header forwarding to Platform for local integration acceptance

## Re-run

```bash
npm run accept:phase8b
```

Inspect `docs/phase8b-runtime-acceptance.results.json` → `performance` array for cold/warm ms per route.
