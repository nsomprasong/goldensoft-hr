# HR performance benchmark (Phase 8B.2)

Goal: warm user transition under 2,000 ms, while recording dev compile/network-idle costs separately.

## Recorded 2026-07-26

Unified browser acceptance:

- Platform bootstrap warm calls: 1,078 ms, 1,075 ms, 1,101 ms
- Customer App → `/hr/employees` warm DOM transition: **748 ms**
- Cold deep link after dev compilation: 2,322 ms
- Result: warm transition target met

Full HR acceptance uses a stricter best-effort `networkidle` measurement in Next.js dev mode:

- `/hr`: 2,541 ms
- `/hr/employees`: 2,475 ms
- `/hr/settings/departments`: 2,275 ms
- `/hr/settings/positions`: 2,245 ms
- `/hr/settings/shifts`: 3,174 ms
- `/hr/settings/payroll-schedules`: 2,371 ms
- `/hr/settings/overtime-rules`: 2,389 ms
- `/hr/payroll/periods`: 2,371 ms

These network-idle values include dev-server and external asset settling and use the local dev gate of 3,500 ms. They are not the client transition metric.

## Runtime design

- Customer bootstrap queries execute in parallel on Platform
- Customer App uses a 10-second, per-session hashed bootstrap cache to avoid repeating header/sidebar/context queries during a navigation burst
- Context-cookie changes produce a new cache key, so organization or branch switches bootstrap fresh data
- Customer App signs a short-lived compact HR bootstrap bridge; HR verifies it and avoids three duplicate Platform calls per product request
- HR chunks use `/__hr_assets/_next/*`, preventing collisions with Customer App chunks and preserving React hydration
- Employee list remains paginated and dashboard data loaders use parallel operations

## Re-run

- Unified transition: `npm run accept:phase8b2` in `goldensoft-app`
- Full HR route/API benchmark: `npm run accept:phase8b` in `goldensoft-hr`

Production builds passed, but an authenticated production-runtime timing was not run because no real-session credential fixture was available. The 748 ms figure is a hydrated Next.js dev warm DOM transition with an existing development-only authorized fixture.
