# HR 100% Completion — Scope Matrix

Date: 2026-07-26  
Repos: `goldensoft-hr`, `goldensoft-platform`, `goldensoft-app`  
Gate: **Final HR Release Gate** — migration `0002_hr_operations_suite` applied.

Legend: `IMPLEMENTED` | `PARTIAL` | `MISSING` | `BLOCKED`

| Code | Module | Baseline (pre Master) | Current at Final Gate | Notes |
|---|---|---|---|---|
| A | Employee Core | PARTIAL | IMPLEMENTED | Core CRUD/link exists; add photo, emergency contact, assignment history, multi-branch UX, terminate flows |
| B | Departments and Positions | IMPLEMENTED | IMPLEMENTED | Keep; ensure menu under บุคลากร |
| C | Work Locations and Geofence | PARTIAL | IMPLEMENTED | Table exists; need CRUD, employee sites, server Haversine, override+audit |
| D | Shift Definitions | IMPLEMENTED | IMPLEMENTED | Templates exist (incl. overnight); keep |
| E | Shift Scheduling | MISSING | IMPLEMENTED | periods, assignments, publish, copy/bulk confirm UX |
| F | Attendance | MISSING | IMPLEMENTED | events + daily summary + self clock + adjustments |
| G | Holidays and Work Calendars | MISSING | IMPLEMENTED | org/branch calendars; no hard-coded Thai holidays in logic |
| H | Leave | MISSING | IMPLEMENTED | types, balances ledger, requests, approve |
| I | Overtime | PARTIAL | IMPLEMENTED | rules exist; add requests/approval/payroll link |
| J | Compensation | IMPLEMENTED | IMPLEMENTED | Extend recurring earnings/deductions |
| K | Payroll | PARTIAL | IMPLEMENTED | periods exist; add runs, calc engine, review/approve |
| L | Payslip | MISSING | IMPLEMENTED | issued snapshot; self + manager read; print HTML (PDF optional/BLOCKED if tooling unsafe) |
| M | Employee Self-Service | MISSING | IMPLEMENTED | /hr/me/* routes |
| N | Approvals | MISSING | IMPLEMENTED | unified inbox |
| O | Notifications | MISSING | IMPLEMENTED | in-app + outbox contract; external send BLOCKED |
| P | Reports | MISSING | IMPLEMENTED | dashboard + CSV exports with permission |
| Q | Permissions and Security | PARTIAL | IMPLEMENTED | expand Platform catalog + HR enforcement + resident-only |
| R | Audit | PARTIAL | IMPLEMENTED | extend action vocabulary for all mutations |
| S | Demo and Acceptance Data | PARTIAL | IMPLEMENTED | extend demo seed for one pay cycle 1–16 |
| T | Responsive and Performance | PARTIAL | IMPLEMENTED | measure after apply |

## BLOCKED (external only — allowed at final gate)

| Item | Reason |
|---|---|
| LINE / SMS / email delivery | Outbox records only; no external provider in this phase |
| Biometric / face recognition | Explicitly out of scope |
| Continuous location tracking | Punch-time location only |
| Legal-grade tax/SSO calculation | Placeholder fields only; must not claim legal completeness |
| PDF payslip download | Optional; if tooling not safe, omit button (no fake CTA) |

## Verification evidence

- `npm run db:verify`: **59/59 tables**; migrations `0001` and `0002` applied.
- `npm run seed:hr` ×2 and `npm run seed:hr:demo` ×2; Platform `npm run seed:hr-permissions`: **44 codes**.
- `npm run hr:reconcile`: **PASS**.
- `npm test`: **161/161** passing.
- `npm run accept:hr100`: **43/43** passing; see `docs/hr100-runtime-acceptance.results.json`.
- `AUTH_INVITE_MODE=mock` remains unchanged.

## Fake-button policy

Any future feature outside this matrix must not appear as a clickable control. Coming-soon products remain disabled tiles only.

## Working rule for this Master Phase

- No PARTIAL/MISSING remaining in A–T at Final HR Release Gate (except BLOCKED rows above).
- Migration `0002_hr_operations_suite` applied after approval.
- `AUTH_INVITE_MODE=mock` unchanged. No push. No Legacy / resident-v2 / qrstation / Payment Gateway edits.
