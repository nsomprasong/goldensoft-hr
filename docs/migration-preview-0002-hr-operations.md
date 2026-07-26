# HR Operations Suite Migration Preview (0002)

**Status: NOT APPLIED.** This package is preview-only and must not be run with Prisma or directly against PostgreSQL until the HR migration approval gate is granted.

## Scope

`prisma/migrations/0002_hr_operations_suite/migration.sql` is an additive migration confined to the `hr` schema. It:

- adds optional employee profile and termination fields;
- creates immutable-code lookup masters and idempotently seeds them;
- adds calendars, locations, assignments, schedules, attendance, leave, overtime, recurring pay, payroll, payslips, approvals, and notifications;
- uses internal `hr` foreign keys only. `organization_id`, `branch_id`, and user identifiers are UUID soft references; and
- adds lookup, work-queue, date-range, status, and pagination indexes, including one attendance day per employee/work date.

## Table list

| Area | Tables |
|---|---|
| Lookup masters | `attendance_statuses`, `attendance_event_types`, `leave_request_statuses`, `overtime_request_statuses`, `schedule_period_statuses`, `holiday_types`, `leave_units`, `approval_entity_types`, `notification_types`, `notification_statuses`, `leave_balance_tx_types`, `earning_types`, `deduction_types` |
| Calendars and schedule | `work_calendars`, `holidays`, `employee_work_calendars`, `employee_work_locations`, `employee_assignment_history`, `schedule_periods`, `shift_assignments`, `shift_assignment_segments` |
| Time and leave | `attendance_events`, `attendance_days`, `attendance_adjustments`, `leave_types`, `leave_policies`, `employee_leave_balances`, `leave_balance_transactions`, `leave_requests`, `overtime_requests` |
| Pay and delivery | `employee_recurring_pay_items`, `payroll_adjustments`, `payroll_runs`, `payroll_run_employees`, `payroll_run_items`, `payslips`, `approval_actions`, `notifications`, `notification_outbox` |

## Safety review checklist

- [x] Schema is `hr` only.
- [x] Additive operations only: table/index creation, employee `ADD COLUMN IF NOT EXISTS`, and master inserts.
- [x] No `DROP`, `TRUNCATE`, or deletion of business data.
- [x] No PostgreSQL `ENUM` types.
- [x] No cross-schema foreign keys.
- [x] UUID IDs are application/generated values; master seed IDs use `gen_random_uuid()` as established by migration `0001`.
- [x] Monetary values use `DECIMAL(14,2)`; geolocation uses `DECIMAL(10,7)`; temporal events use `TIMESTAMPTZ`.
- [x] Timezone defaults are `Asia/Bangkok`; existing work-location geofence default remains 50 metres.
- [x] Master seed inserts use `ON CONFLICT DO NOTHING`.
- [ ] Confirm required `pgcrypto`/`gen_random_uuid()` availability in the target database (already required by `0001`).
- [ ] Review employee/work-calendar policy and payroll calculation rules with HR before applying.
- [ ] Back up and test the migration on a production-like database before approval.

## Apply prohibition

Do **not** run `prisma migrate`, `prisma migrate deploy`, `prisma db push`, or execute the SQL manually. This document and the migration file are **NOT APPLIED**.
