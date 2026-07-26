# HR permission matrix

| Area | Self-service | Manager / HR read | HR manage |
|---|---|---|---|
| Schedule | `hr.schedule.read` | `hr.schedule.read` | `hr.schedule.manage`, `hr.schedule.publish` |
| Attendance | `hr.attendance.self` | `hr.attendance.read` | `hr.attendance.manage`, `hr.attendance.override` |
| Leave | `hr.leave.self` | `hr.leave.read` | `hr.leave.manage`, `hr.leave.approve` |
| Overtime | `hr.overtime.self` | `hr.overtime.read` | `hr.overtime.manage`, `hr.overtime.approve` |
| Payroll | `hr.payslip.self` | `hr.payroll.read`, `hr.payslip.read` | `hr.payroll.calculate`, `hr.payroll.review`, `hr.payroll.approve`, `hr.payroll.lock` |
| Sensitive compensation | — | `hr.compensation.read` | `hr.compensation.manage` |
| Operational settings | — | — | `hr.location.manage`, `hr.calendar.manage`, `hr.settings.manage` |
| Reporting / inbox | — | `hr.report.read`, `hr.approval.read` | `hr.approval.manage` |

All permissions are enforced by `requireHrPage` for pages and must also be enforced at the corresponding `/api/hr/*` mutation route. Organization and branch scope remain Platform-owned.
