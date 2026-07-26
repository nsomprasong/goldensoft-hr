# HR pre-migration status

Status date: 2026-07-26. Migration `0002_hr_operations_suite` has **not** been applied and must not be applied as part of this work.

## Code complete before apply

- HR route registry, permission gates, embedded-safe shell, self-service pages, manager/admin workspaces, settings hub, and Thai unavailable states.
- Existing employee, department, position, shift, overtime-rule, payroll-schedule, and payroll-period features remain available through their existing repositories and API routes.
- The proposed ERD, data ownership boundaries, and permission matrix are documented.

## Waiting for migration and API implementation

- Persistence, list loaders, and mutations for calendars, locations, scheduling, attendance, leave, OT requests, approvals, pay items, payroll runs, and payslips.
- Dashboard counts for pending leave/OT, missing clock-out, and payroll warnings.
- Server-side geofence validation, payroll calculation/review/approval, CSV exports, notification outbox processing, and printable payslip populated from issued snapshots.

## UI behavior until apply

The pages render Thai empty/unavailable states. Client actions post to their intended `/api/hr/*` contracts and report 404/500 failures without inventing a record, time, PDF, or success result.
