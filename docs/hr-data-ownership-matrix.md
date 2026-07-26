# HR data ownership matrix

| Data area | System of record | Owner | Consumer |
|---|---|---|---|
| Organization, branch, identity, role | GoldenSoft Platform | Platform | HR |
| Employee employment profile | HR | HR administrator | Payroll, schedules |
| Work locations and calendars | HR | HR administrator | Scheduling, attendance |
| Attendance event and day summary | HR | Employee / HR override | Payroll, reports |
| Leave and OT requests | HR | Employee; manager approves | Payroll, reports |
| Compensation and recurring pay | HR | Authorized compensation manager | Payroll |
| Payroll run, result, payslip | HR | Payroll approver | Employee, finance |
| Approval trail and notifications | HR | HR workflow | Platform delivery adapters |

Platform IDs are soft references in the HR schema. HR must not write Platform memberships, roles, organization selection, or authentication data.
