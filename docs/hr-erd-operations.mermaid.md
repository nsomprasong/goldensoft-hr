# HR Operations ERD (pre-migration)

```mermaid
erDiagram
  EMPLOYEES ||--o{ EMPLOYEE_ASSIGNMENT_HISTORY : assigned
  EMPLOYEES ||--o{ EMPLOYEE_WORK_LOCATIONS : works_at
  EMPLOYEES ||--o{ SHIFT_ASSIGNMENTS : receives
  EMPLOYEES ||--o{ ATTENDANCE_EVENTS : records
  EMPLOYEES ||--o{ ATTENDANCE_DAYS : summarizes
  EMPLOYEES ||--o{ LEAVE_REQUESTS : requests
  EMPLOYEES ||--o{ OVERTIME_REQUESTS : requests
  EMPLOYEES ||--o{ EMPLOYEE_LEAVE_BALANCES : owns
  EMPLOYEES ||--o{ PAYSLIPS : receives
  WORK_CALENDARS ||--o{ HOLIDAYS : contains
  WORK_CALENDARS ||--o{ EMPLOYEE_WORK_CALENDARS : assigned
  SCHEDULE_PERIODS ||--o{ SHIFT_ASSIGNMENTS : contains
  SHIFT_ASSIGNMENTS ||--o{ SHIFT_ASSIGNMENT_SEGMENTS : splits
  LEAVE_TYPES ||--o{ LEAVE_REQUESTS : classifies
  LEAVE_TYPES ||--o{ EMPLOYEE_LEAVE_BALANCES : tracks
  PAYROLL_RUNS ||--o{ PAYROLL_RUN_EMPLOYEES : calculates
  PAYROLL_RUN_EMPLOYEES ||--o{ PAYROLL_RUN_ITEMS : itemizes
  PAYROLL_RUN_EMPLOYEES ||--|| PAYSLIPS : issues
  APPROVAL_ACTIONS }o--|| LEAVE_REQUESTS : audits
  APPROVAL_ACTIONS }o--|| OVERTIME_REQUESTS : audits
```

The authoritative proposed columns, keys, and indexes remain in `prisma/migrations/0002_hr_operations_suite/migration.sql`; this diagram deliberately summarizes relationships only.
