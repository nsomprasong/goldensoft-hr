# Phase 8B.2 HR runtime acceptance

Recorded on 2026-07-26 through Customer App (`http://127.0.0.1:3002/hr/*`), not direct HR navigation.

## Database reconciliation

- Initial and final classification: **B — APPLIED_SUCCESSFULLY**
- `0001_hr_core`: one rolled-back zero-step attempt plus one successful one-step record
- Successful record checksum matches the checked-in migration (`62add8dafc5526615b40a831b7f478e889f4d5ece35938ca7a97536bb31a7dfe`)
- Prisma status: up to date; no migration deploy, reset, db push, or migration edit occurred
- Schema `hr`: 20/20 expected base tables
- Master verification: 8/8 tables populated; Thai text remained valid UTF-8

## Seeds

- `SEED_MODE=system npm run seed:hr`: two runs, identical counts (4 employment types, 5 employee statuses, 5 shift types, 4 pay frequencies, 3 wage types, 4 overtime rate types, 7 payroll statuses, 22 audit actions)
- System seed did not create employees, Auth users, or invitations
- Development demo seed: two runs against three existing demo organizations only; each remained at 1 department, 1 position, 1 work location, 1 shift, 1 overtime rule, 1 payroll schedule, 2 periods, 2 employees, and 2 compensations
- Demo seed reported `no Auth users created`; no production or GOLDENSOFT real-tenant demo seed was run

## Runtime result

`npm run accept:phase8b` completed **52/52 PASS**:

- Employee list/search/filter, create, duplicate rejection, detail, update, deactivate, link validation, tenant and branch isolation
- Compensation initial/history records, previous-record closing, negative/overlap rejection, permission gating
- Department and position writes with inactive-master enforcement
- Normal and overnight shifts, validation, and deactivate
- Payroll schedule, 1–16 and 17–month-end periods, duplicate handling, and status transitions
- Real database persistence, Thai feedback, and audit writes
- Hydrated employee creation through `/hr/employees/new`
- Embedded Customer Shell exactly once; no standalone Debug Shell
- Deep links, active menu, and unauthenticated central-login redirect

The acceptance creates `ACCEPTANCE-*` rows in demo tenants. The principal API employee is deactivated at the end; records are retained for audit evidence rather than destructively deleted.

## Verification

- Tests: 147/147 PASS
- Lint: PASS
- Typecheck: PASS
- Production build: PASS
- `db:preflight`, `db:verify`, `db:migration:check`, and `prisma migrate status`: PASS
- Responsive overflow checks: PASS at 375, 768, 820, 1024, 1130, 1280, and 1440 px

## Authentication boundary

The unauthenticated redirect to Platform login is a real HTTP/browser flow. No authorized password or secure real-session fixture existed in the environment, so authenticated CRUD/browser checks used the existing SUPER_ADMIN fixture with development-only `ALLOW_TEST_AUTH`. No user was created and no credential was exposed.

No real invite was sent, `AUTH_INVITE_MODE` remained `mock`, Legacy was not changed, and no destructive database action was used.
