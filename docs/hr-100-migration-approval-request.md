# HR 100% — Pre-migration Gate Report

**STOP HERE FOR SINGLE MIGRATION APPROVAL**  
Date: 2026-07-26  
Migration: `goldensoft-hr/prisma/migrations/0002_hr_operations_suite/migration.sql`  
Status: **NOT APPLIED** (preview only)

## 1. Scope matrix

See `docs/hr-100-percent-scope-matrix.md`.

Code-complete for A–T implementation surface (services, APIs, UI, calc libs, permissions, nav). Runtime DB persistence for new tables waits on apply.

## 2. Schema / tables

- Existing: 20 tables (`0001_hr_core`) — applied earlier
- Preview `0002`: +employee columns + masters + operational tables (calendars, locations, schedules, attendance, leave, OT requests, pay items, payroll runs/items, payslips, approvals, notifications/outbox)
- Safety: `npm run db:migration:check` → OK (hr-only, additive)
- Docs: `docs/migration-preview-0002-hr-operations.md`, `docs/hr-erd-operations.mermaid.md`

## 3. Migration safety review

- [x] schema `hr` only
- [x] additive CREATE / ADD COLUMN / indexes / master INSERT ON CONFLICT
- [x] no DROP / TRUNCATE / ENUM / cross-schema FK
- [x] money DECIMAL(14,2); geofence default 50m; timezone Asia/Bangkok
- [x] multiple shifts/day via `(employee_id, work_date, sequence_no)` unique

## 4. APIs / services

Prisma-backed services + catch-all `/api/hr/[...operations]` covering locations, calendars, schedules (confirm-gated mutations), attendance/clock + geofence, leave, OT requests, pay items, payroll runs/calc, payslips, approvals, notifications (outbox only), reports, self-service `/me/*`.

Pure libs (no DB): geo, attendance-calc, schedule-conflicts, leave-balance-math, payroll-calc.

## 5. UI pages

Self-service + manager/admin workspaces under `/hr/*` (schedules, attendance, leave, OT, approvals, payroll runs/review, payslips, reports, settings hub, locations, calendars). Thai empty/error states; no fake PDF/pay/gateway buttons.

## 6. Permissions

Platform catalog expanded (**44** `hr.*` codes, Thai/EN labels). Seed path remains `npm run seed:hr-permissions` (no DDL). Customer App nav registry expanded with entitlement `hr.access` gates.

## 7. Calculation specifications

`src/lib/hr/payroll-spec.md` + unit tests for daily/monthly/hourly, overnight attendance, geofence, leave ledger, schedule overlap.

## 8. Tests passing without new DB

- HR: calculations + service guards + updated Phase 8B UI inventory + prior Phase 8B suites
- Platform: permission catalog + db-verify mock (billing 0006 aware)
- App: navigation registry

## 9. Waiting on migration apply

- Persist/list/mutate against new tables on real DB
- System/demo seed extensions for full 1–16 pay-cycle dataset
- Browser/responsive/performance Final HR Release Gate
- `db:verify` expectations for new HR table counts

## 10. Git commits (local, no push)

Prepared for:

- Platform: `feat: complete hr authorization foundation`
- Customer App: `feat: complete hr unified experience`
- HR: `feat: complete hr management suite`

## 11–12. Confirmations

- Migration **0002 not applied**
- No `db push` / migrate reset / destructive SQL
- `AUTH_INVITE_MODE=mock` unchanged
- No Legacy / resident-v2 / qrstation / Payment Gateway changes
- No Git push

---

**Approval requested:** apply only `0002_hr_operations_suite` on the shared Supabase project (additive). After approval, Cursor will continue apply → seed ×2 → generate → verify → acceptance → Final HR Release Gate without further user commands.
