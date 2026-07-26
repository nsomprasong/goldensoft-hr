# Phase 8B runtime acceptance

Manual and automated checks after applying migration `0001_hr_core` and seeding demo data.

## Prerequisites

- Platform dev server: `http://127.0.0.1:3000` with `ALLOW_TEST_AUTH=true`
- HR dev server: `http://127.0.0.1:3001` with `ALLOW_TEST_AUTH=true`, `PLATFORM_BASE_URL=http://127.0.0.1:3000`
- Demo org **RESORT-DEMO** must have HR entitlements (`hr.access`, `hr.employee_limit`, etc.) — applied during Phase 8B Apply via Platform entitlement upsert for demo tenants only
- Platform catalog: `npm run seed:hr-permissions` (in `goldensoft-platform`, `APP_CODE=PLATFORM`, `SEED_MODE=system`)

## Run

From `goldensoft-hr`:

```bash
npm run accept:phase8b
```

Optional: `ACCEPTANCE_WARM_DEV_MS=3500` (default) adjusts the dev warm-navigation gate. Production target remains **2000ms** (see [PERFORMANCE_BENCHMARK.md](./PERFORMANCE_BENCHMARK.md)).

Machine-readable output: [phase8b-runtime-acceptance.results.json](./phase8b-runtime-acceptance.results.json) (regenerated each run).

## Scope

- **Routes**: canonical `/hr/*` (legacy paths redirect)
- **API**: CRUD employees, compensations, masters, shifts, payroll schedules/periods, dashboard; security (401, forged org header ignored)
- **Browser**: Thai UI under Debug Shell (standalone) or Product Frame; create employee; compensation tab for SUPER_ADMIN; unauthenticated redirect; no placeholder actions
- **Responsive**: horizontal overflow check at 375–1440px widths
- **Performance**: cold/warm navigation timings on Next.js **dev + turbopack** (not production build)

See also [adr-unified-customer-shell.md](./adr-unified-customer-shell.md).

## Compensation UI vs org admin roles

Organization **OWNER/ADMIN** role mapping in HR **does not** include `hr.compensation.read` / `hr.compensation.manage`. Those codes must be granted explicitly on Platform (custom org role permissions).

**SUPER_ADMIN** with `platform_admin` context uses `canHr()` which bypasses product-local permission codes (including compensation) for support operations. The acceptance script asserts the compensation tab is visible when opening the API-created acceptance employee by id.

## Limitations

- Does not send real invites; does not change `AUTH_INVITE_MODE`
- Creates `ACCEPTANCE-*` rows on demo orgs; deactivates the API employee after UI checks
- Does not modify Legacy or production demo tenants beyond entitlement fix already applied for three demo orgs

## Last recorded run (2026-07-26)

Full run after script fixes: **52/52 PASS** (`npm run accept:phase8b`). See `phase8b-runtime-acceptance.results.json` for timings; warm navigation in dev is ~2.0–2.2s on most routes (production target 2000ms — see [PERFORMANCE_BENCHMARK.md](./PERFORMANCE_BENCHMARK.md)).
