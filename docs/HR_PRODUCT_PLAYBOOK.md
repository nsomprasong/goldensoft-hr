# HR Product Playbook

> **อ่านไฟล์นี้ก่อนแก้ HR ทุกครั้ง** — เป็นแหล่งอ้างอิงเดียว ไม่ต้องไล่โครงสร้างโปรเจกต์ใหม่  
> อัปเดตไฟล์นี้ทุกครั้งที่ปิดงานย่อยหรือขออนุมัติปิดเฟส

Last updated: 2026-08-02 (Phase 8 Track B tax/SSO legal-depth IN_PROGRESS)  
Repos: `goldensoft-hr` (product), `goldensoft-app` (shell + tokens), `goldensoft-platform` (auth/permissions)

---

## 1. Product goals (locked)

| Topic | Decision |
|-------|----------|
| Org / branch | พนักงานและข้อมูลปฏิบัติการแยกตามองค์กรและสาขา (ของใครของมัน) |
| Clock-in | **1C:** ถ่ายรูป + GPS ตามรัศมี → บันทึกทันที; face matching = Phase 8 Track A (OFF/WARN/REQUIRE) |
| GPS radius | แต่ละ `WorkLocation` ตั้ง `geofenceRadiusMeters` ได้; นอกรัศมี = ปฏิเสธ |
| Employee list | แสดง **EmployeeAvatar** (รูปวงกลม) ข้างชื่อทุกครั้ง; ไม่มีรูป = อักษรย่อ |
| OT / leave / late | ใช้งานง่าย; หักลา ขาด สาย เชื่อมจากสรุปรายวัน |
| Pay cycle | รายวัน / รายอาทิตย์ / รายเดือน ผ่าน payroll schedules |
| Tax / SSO | Phase 8 Track B: FLAT หรือ PROGRESSIVE + SSO ฐาน min/max — ประมาณการ ไม่ใช่คำปรึกษากฎหมาย |
| Advances | Phase 6 |
| Notifications | รวมดูจาก UI เดียว (in-app); ส่งนอกระบบนอกสโคปถ้าไม่มี provider |
| Self-service | ประวัติเวลา ขาด/ลา/สาย ส่งใบลา แนบรูป กราฟกะทัดรัด มือถือก่อน |
| Theme | Customer design tokens กลาง — ห้ามนำเข้า Platform CSS |
| Dates | แสดง พ.ศ. (`formatThaiDate` / `ThaiDateInput`); เก็บ ISO |

---

## 2. Central theme (ทุกครั้งที่ออกแบบ UI)

**Canonical tokens:** `goldensoft-app/src/app/design-tokens.css`  
**HR copy (ต้อง hash ตรงกัน):** `goldensoft-hr/src/app/design-tokens.css`

Sync:

```bash
# from goldensoft-hr
npm run sync:design-tokens
```

Rules:

- ใช้ `--color-*`, typography, space, radius จาก tokens + alias `--hr-*` ใน `globals.css`
- ห้าม hardcode ม่วง/ครีมธีมใหม่; ห้าม import CSS จาก `goldensoft-platform`
- คอมโพเนนต์ซ้ำ: `EmployeeAvatar`, `ThaiDateInput`, `Field`, `Alert`
- มือถือก่อน: avatar วงกลม, ตารางเลื่อนแนวนอน, กราฟเล็ก
- Cursor rule: `.cursor/rules/customer-ui-theme.mdc`

Contract doc: `goldensoft-app/docs/customer-ui-design-contract-v1.md`

---

## 3. Data pipeline (สั้น ห้ามแยกแหล่งความจริง)

```
Organization → Branch → Employee(+photoUrl)
  → WorkLocation(geofenceRadiusMeters) + WorkCalendar + Shift
  → SchedulePeriod / ShiftAssignment
  → AttendanceEvent(photo, GPS) → AttendanceDay(late/absent)
  → LeaveRequest / OvertimeRequest
  → PayrollPeriod → PayrollRun → Payslip
  → SalaryAdvance (Phase 6)
  → Notification inbox
```

Scope บังคับ: `organizationId` + branch allow-list ใน authorize/API ทุกครั้ง  
**Header branch = CRITICAL #1:** ถ้าเลือกสาขาใน shell ต้องกรองตามสาขานั้นแม้ OWNER/ADMIN (หมุดลงเวลา / รายการ / ฟอร์ม) — ใช้ `employeeBranchWhere` / `employeeOwnBranchWhere` / `resolveBranchScope` (กฎ `.cursor/rules/hr-branch-scope.mdc`)  
หมุด GPS: `resolvePrimaryWorkLocation(employeeId, ctx.branchId ?? employee.branchId)` — ห้าม fallback ไปหมุดสาขาอื่น

---

## 4. Menu readiness matrix

Legend: `working` | `partial` | `stub` | `missing`

| Menu | Path | Status | Phase | Notes |
|------|------|--------|-------|-------|
| แดชบอร์ด | `/hr` | working | — | |
| พนักงาน | `/hr/employees` | partial | 1 | มี avatar ในรายการแล้ว; ใส่รูปผ่าน URL ในฟอร์ม (อัปโหลดไฟล์ = เฟสถัดไปถ้าต้องการ) |
| แผนก / ตำแหน่ง / กะ / กฎ OT | `/hr/settings/*` | working | — | |
| รอบจ่าย / งวด | payroll schedules/periods | working | 4 | UI รอบชัดขึ้นใน Phase 4 |
| ตารางกะ | `/hr/schedules` | working | — | |
| ปฏิทินทำงาน | `/hr/calendars` | working | — | |
| สถานที่ทำงาน | `/hr/locations` | working | 1 | UI จริง + ตั้งรัศมี GPS ได้ |
| เวลาทำงาน | `/hr/attendance` | working | 2 | รายวัน + avatar + รูปหลักฐาน |
| การลา / OT / อนุมัติ | leave, overtime, approvals | working | 3 | รวมคิวลา/OT/ปรับเวลา/ย้ายกะผิดกะ; me leave/OT + ขอแก้เวลา |
| ประมวลผล / สลิป / รายงาน | payroll runs, payslips, reports | partial | 4–7 | Run table: ค่าจ้าง/OT/จ่ายเบิก/รายได้อื่น + หักภาษี/SSO/หักเบิก/สาย/ขาด; sticky ชื่อ; reports ยัง stub |
| งานของฉัน (home) | `/` (Customer App) | working | — | เมนูลัดพนักงาน — ไม่ทำ hub ซ้ำที่ `/hr/me` |
| ลงเวลาของฉัน | `/hr/me/attendance` | working | 2 | รูป + GPS + รัศมี; face ตามโหมดองค์กร |
| me อื่นๆ | schedule/leave/OT/payslips/advances/face | working | 3–8 | leaf ครบ; เข้าจาก `/` + bottom tabs |
| เบิกล่วงหน้า | `/hr/advances`, `/hr/me/advances` | working | 6 | งวดหักคืน + วิธีรับเงิน + สลิป; notification center ยังค้าง |
| Face matching | `/hr/settings/face-matching`, `/hr/me/face` | working | 8A | OFF/WARN/REQUIRE + enroll + clock compare — Track A CLOSED |
| Tax/SSO legal | `/hr/settings/payroll-deductions` | partial | 8B | FLAT / PROGRESSIVE + SSO wage base; ยังไม่ใช่ตารางกรมสรรพากรเต็ม |

Key API catch-all: `src/app/api/hr/[...operations]/route.ts`  
Ops services: `src/lib/hr/services/operations.ts`

Stub pattern to replace: `OperationsWorkspace` (ไม่ GET รายการ)

---

## 5. Phases

Status values: `OPEN` | `IN_PROGRESS` | `READY_FOR_APPROVAL` | `CLOSED`

### Phase 0 — Playbook + theme + agent rules
- Status: **CLOSED**
- Done: playbook, cursor rules (suite + HR), `npm run sync:design-tokens`, design-tokens hash test
- Closed: 2026-07-31 — user confirmed test pass

### Phase 1 — Locations + employee avatar
- Status: **CLOSED**
- Done:
  - `EmployeeAvatar` + list/detail/form show circular icon
  - Photo input: **camera or file upload only** (no URL field) → `POST /api/hr/employees/{id}/photo`
  - Locations page real UI: list, create/edit, **geofenceRadiusMeters**, lat/lng, toggle active
  - Demo / login-test datasets — see [`HR_DEMO_DATASET.md`](./HR_DEMO_DATASET.md), [`HR_LOGIN_TEST_DATASET.md`](./HR_LOGIN_TEST_DATASET.md)
- Closed: 2026-07-31 — user confirmed test pass

### Phase 2 — Attendance 1C
- Status: **CLOSED**
- Done:
  - Self clock: require punch photo + GPS; geofence via `WorkLocation.geofenceRadiusMeters`
  - Dev GPS mock panel on `/hr/me/attendance` (inside / outside / device)
  - Admin day view `/hr/attendance`: cards + `EmployeeAvatar` + evidence thumbs
  - Storage: `storage/attendance-photos/` + `GET /api/hr/attendance/events/{id}/photo`
- Closed: 2026-08-01 — user confirmed test pass

### Phase 3 — Leave / OT / unified approvals
- Status: **CLOSED**
- Done:
  - Me leave / me OT workspaces (compact list + overlay submit)
  - Org leave + OT approval lists (compact rows + approve/reject)
  - Attendance adjustments: create / list / approve|reject API; apply clocks to `AttendanceDay`
  - Me attendance: ขอแก้เวลา; admin `/hr/attendance/adjustments` + rows on `/hr/approvals`
  - Wrong-shift clock-in: confirm → punch first + approval; approve moves day shift; reject marks `WRONG_SHIFT`
  - Unified `/hr/approvals` tabs (ลา / OT / ปรับเวลา / ย้ายกะ) + inbox/history by event date window
  - Branch-scoped leave/OT visibility for BRANCH_MANAGER; dashboard action tiles wired to live counts
  - Navigation pending UI (shell + HR) for screen changes
  - Login-test seed: pending adjustment (EMP-0007)
- Closed: 2026-08-01 — user approved close

### Phase 4 — Payroll UI + tax/SSO configurable (2B)
- Status: **CLOSED** (+ follow-up 2026-08-01 tested OK)
- Done:
  - Runs / run detail / org+me payslips UI (cards + FAB/overlay, no internal codes)
  - Tax/SSO org settings `/hr/settings/payroll-deductions` (2B rates → calculate)
  - Payslips filter by งวดจ่าย (default = งวดปัจจุบัน)
  - Login-test: deduction settings + approved run with issued payslips + draft run
  - Migration `0009_payroll_deduction_settings`
  - Smoke: `npm run test:payroll-phase4` (7/7 pass)
  - **Follow-up (user tested OK 2026-08-01):**
    - Calculate pulls approved OT + late minutes + ABSENT days into pay lines
    - Settings `/hr/settings/attendance-pay` (หักสาย / ขาดงาน; 0 = derive from wage)
    - Run detail columns: ค่าจ้าง / OT / จ่ายเบิก / รายได้อื่น / ภาษี / SSO / หักเบิก / สาย / ขาดงาน; sticky ชื่อ
    - Migration `0014_attendance_pay_settings` (+ `LATE` deduction type)
- Closed: 2026-08-01 — user approved close + commit/push; follow-up pass same day

### Phase 5 — Mobile self-service hub
- Status: **CANCELLED** (ไม่ต้องทำ — หน้าแรก Customer `/` จัดเมนูพนักงานครบแล้ว)
- Decision 2026-08-01: ถอด `/hr/me` hub ที่ซ้ำ; `/hr/me` redirect → attendance ตามเดิม
- Next open: **Phase 7** (Reports + notification center)

### Phase 6 — Advances + notification center
- Status: **CLOSED** (advances); notification center deferred → track under Phase 7 / follow-up
- Done (advances):
  - Self-submit `/hr/me/advances` + admin `/hr/advances`
  - Installment plan (N งวด); start period optional until calculate binds
  - Employee chooses รับเงินเลย / รับพร้อมเงินเดือน; approver can change
  - รับเงินเลย: optional transfer slip now or later; stored as employee document `ADVANCE_SLIP`
  - Calculate: `ADVANCE_PAYOUT` (WITH_SALARY) in payout period; **หักงวดถัดไป** (ไม่หักงวดเดียวกับที่จ่าย)
  - Approvals inbox tab `เบิก` + main-nav hub รายการรออนุมัติ; permissions `hr.advance.self` / `hr.advance.approve`
  - Migrations `0010`–`0013` (advances, installments, nullable period, transfer slip)
- Closed: 2026-08-01 — user approved close + commit/push; WITH_SALARY deferral follow-up tested OK same day
- Deferred: in-app notification center UI

### Phase 7 — Reports + manager dashboard
- Status: **CLOSED** (absorbs deferred notification center from Phase 6)
- Done:
  - In-app notification center `/hr/notifications` (list / unread / mark read / mark all)
  - Emit on leave / OT / advance submit + review; body + `dateLabel` (วันลา / วัน OT / วันเบิก)
  - Deep-link `focus` + `notify` — open request and mark read reliably
  - Manager dashboard: unread strip + advances pending tile
  - Reports hub: month cards (attendance / leave / OT / advances)
  - Leave cover: คนแทน must be same branch as leave employee
  - Nav แจ้งเตือน (HR routes + Customer App registry)
  - Master types: `ADVANCE_SUBMITTED` / `ADVANCE_APPROVED` / `ADVANCE_REJECTED`
- Closed: 2026-08-01 — user approved close

### Phase 8 — Face matching + legal tax/SSO depth
- Status: **IN_PROGRESS** (Track A closed; Track B open)
- Track A — Face matching MVP: **CLOSED** (2026-08-02 — user tested OFF/WARN/REQUIRE)
  - Org mode: `OFF` | `WARN` | `REQUIRE` + match threshold
  - Employee enrolls reference face (descriptor 128-d + photo)
  - Clock-in/out compares punch face vs enrollment
  - Client: face-api CDN + downscale/retry detect; server: Euclidean match
  - Migration `0015_face_matching`; settings `/hr/settings/face-matching`; self `/hr/me/face`
- Track B — legal-grade tax brackets / SSO depth: **IN_PROGRESS** (started 2026-08-02)
  - Tax method: `FLAT` (%) หรือ `PROGRESSIVE` (annualize → brackets → ÷12)
  - Personal allowance + optional expense deduction (ประมาณการ — ไม่ใช่คำปรึกษากฎหมาย)
  - SSO: ฐานค่าจ้าง min/max + อัตรา% + เพดานเงินหัก
  - Settings UI: `/hr/settings/payroll-deductions`
- Separate approvals OK between A and B — Phase 8 stays open until Track B closes

**Phase close rule:** tests pass → update this playbook → ask user → **do not mark CLOSED without approval**

---

## 6. Test commands

```bash
cd goldensoft-hr
npm run sync:design-tokens   # after token edits in app
npm test
npm run accept:hr100         # when runtime gate needed
```

Per-phase: add checklist under Changelog when closing.

---

## 7. Important file map (token-saving)

| Area | Paths |
|------|--------|
| Routes / nav | `src/lib/hr/routes.ts` |
| Permissions | `src/lib/hr/permissions.ts` |
| Data readers | `src/lib/hr/data.ts` |
| Ops API | `src/app/api/hr/[...operations]/route.ts`, `src/lib/hr/services/operations.ts` |
| Shell embed | `src/components/hr-shell.tsx`, app `compose-product-html.ts` |
| Thai dates | `src/lib/hr/thai-date.ts`, `src/components/hr/thai-date-input.tsx` |
| Geofence | `src/lib/hr/geo.ts`, `WorkLocation.geofenceRadiusMeters` |
| Employee photo | `src/lib/hr/employee-photos.ts`, `api/hr/employees/[id]/photo`, `employee-photo-picker.tsx` |
| Punch photo | `src/lib/hr/attendance-photos.ts`, `api/hr/attendance/events/[id]/photo`, `me-attendance-workspace.tsx` |
| Face matching | `face-match.ts`, `services/face-matching.ts`, `client/face-descriptor.ts`, `/hr/settings/face-matching`, `/hr/me/face` |
| Tax / SSO depth | `thai-tax.ts`, `payroll-calc.ts`, `services/payroll-deduction-settings.ts`, `/hr/settings/payroll-deductions` |
| Admin attendance day | `attendance-day-workspace.tsx`, `listAttendanceDays` in `operations.ts` |
| Login-test dataset | `src/lib/seed/login-test-dataset.ts`, `docs/HR_LOGIN_TEST_DATASET.md` |
| Demo dataset (legacy) | `src/lib/seed/demo-dataset.ts`, `docs/HR_DEMO_DATASET.md` |
| Tokens | `src/app/design-tokens.css`, `src/app/globals.css` |
| Payroll UI | `payroll-runs-workspace.tsx`, `payroll-run-detail-workspace.tsx`, `payslips-workspace.tsx`, `me-payslips-workspace.tsx`, `payroll-deduction-settings-form.tsx`, `attendance-pay-settings-form.tsx` |
| Payroll services | `services/payroll-runs.ts`, `services/payroll-deduction-settings.ts`, `services/payroll-attendance-effects.ts`, `services/salary-advances.ts` |
| Notifications | `services/notify.ts`, `/hr/notifications`, `notifications-workspace.tsx`, `notification-link.tsx`, `mark-notify-from-query.ts` |
| Reports hub | `services/report-summaries.ts`, `/hr/reports` |
| Leave cover | `listLeaveCoverCandidates` / `assertLeaveCoverSameBranch` in `operations.ts` |
Do **not** re-read whole repo if this map answers the question — update the map when paths change.

---

## 8. Changelog

### 2026-08-02 — Phase 8 Track B started (tax / SSO depth)
- Status Track B → **IN_PROGRESS**
- Migration `0016_tax_sso_depth`: tax_method, personal allowance, expense flag, SSO wage base min/max
- `thai-tax.ts` + `payroll-calc`: FLAT or PROGRESSIVE (annualize → brackets → ÷12); SSO clamp wage base
- Settings UI `/hr/settings/payroll-deductions` updated; disclaimer ประมาณการ ไม่ใช่คำปรึกษากฎหมาย
- Unit tests: `tests/thai-tax.test.ts` (compat flat 20k still 600+750)

### 2026-08-02 — Phase 8 Track A CLOSED (Face matching)
- User tested all modes OFF / WARN / REQUIRE — approved close Track A
- Detector fix: downscale + multi inputSize/threshold + WebGL ready (มือถือถ่ายชัดแล้วยังไม่เจอใบหน้า)
- Seed fix: schedulePeriod code sync + primary work-location re-seed
- Face matrix → **working**; Phase 8 remains **IN_PROGRESS** for Track B (tax/SSO legal)
- Next open: **Phase 8 Track B** — legal tax brackets / SSO depth

### 2026-08-01 — Phase 7 CLOSED
- User approved close after smoke (notifications, reports, dashboard, leave cover same-branch)
- Notifications: center UI + emit leave/OT/advance; dates in body/`dateLabel`; mark-read on open (`notify` query)
- Approvals deep-link `focus=<id>`; empty POST body allowed for mark-read APIs
- Dashboard: unread strip + เบิกรออนุมัติ; Reports hub month cards
- Leave cover candidates + assign: same branch as leave employee only

### 2026-08-01 — Phase 8 Track A started (Face matching MVP)
- Status Phase 8 → **IN_PROGRESS** (Track A face; Track B tax/SSO later)
- Migration `0015_face_matching`: `attendance_face_settings` + `employee_face_enrollments`
- Settings `/hr/settings/face-matching` — mode OFF|WARN|REQUIRE + threshold
- Self enroll `/hr/me/face` — photo + face-api descriptor (CDN)
- Clock: compare descriptor; REQUIRE blocks, WARN allows + warning in response/metadata
- Default mode OFF — existing GPS smoke unaffected
- Unit tests: `tests/face-match.test.ts`

### 2026-08-01 — Schedule overlap + workdays on assign
- Assign: warn when employee+date already in another period (no silent skip)
- Resolve: ข้ามวันที่ชน / ย้ายมาช่วงนี้ / เปิดจัดการช่วงเก่า (เปิด/ลบ)
- Create + detail + list: show overlapping periods; detail panel to manage old ranges
- Assign UI: choose work days/week (จ–ศ · ทุกวัน · chip กำหนดเอง)
- Fix false “กะซ้ำ”: time-overlap check is per-employee (was mixing people)
- Seed: BRANCH01 staff no longer land on HQ June schedule; cleanup moved cross-branch rows
- Delete schedule: blocked when any punch exists on covered days (PUBLISHED ok only if no attendance)

### 2026-08-01 — Phase 5 CANCELLED
- User: customer `/` จัดหน้าพนักงานเรียบร้อยแล้ว — hub `/hr/me` ซ้ำซ้อน ให้ถอดออก
- Restored `/hr/me` → redirect attendance; removed MeHubWorkspace / me-hub service
- Next open phase: **Phase 7**

### 2026-08-01 — Payroll follow-up tested OK (OT / สาย / ขาด / จ่ายเบิก)
- User confirmed browser test pass
- Calculate: OT (approved) + late + absence; settings `/hr/settings/attendance-pay`
- Run table: split earnings (incl. จ่ายเบิก / รายได้อื่น) + sticky name column
- WITH_SALARY: credit this period, deduct from next period only
- Migration `0014_attendance_pay_settings`
- Next open phase: **Phase 5 — Mobile self-service hub**
- Awaiting user: commit/push? start Phase 5?

### 2026-08-01 — Phase 4 + Phase 6 CLOSED
- User approved close → commit/push (hr, app, platform)
- Phase 4: payroll UI + tax/SSO 2B + payslip period filter (default current)
- Phase 6 advances: installments, payout mode, transfer slip evidence, approve inbox, nav section rename
- Notification center deferred (not in this close)
- Nav (app): รายการรออนุมัติ as own hub; section **จัดการเงินเดือน/เบิกล่วงหน้า**
- Platform: `hr.advance.self` / `hr.advance.approve` in catalog + seed

### 2026-08-01 — Phase 4 READY_FOR_APPROVAL
- Replaced OperationsWorkspace stubs for payroll runs, org/me payslips with card + FAB/overlay UI
- Run detail: calculate / approve / mark paid / issue payslips; employee cards + expandable items
- Settings: `/hr/settings/payroll-deductions` — rates feed calculate (2B); not legal-grade
- Periods list → cards; schedule labels name-only (no codes)
- Login-test: tax 3% / SSO 5% cap 750, 9 issued payslips, draft run for calculate
- Smoke `npm run test:payroll-phase4` 7/7 pass — awaiting user close

### 2026-08-01 — Phase 3 CLOSED → Phase 4 IN_PROGRESS
- User approved Phase 3 close (Leave / OT / unified approvals + post-READY polish)
- Status Phase 3 → **CLOSED**; Phase 4 → **IN_PROGRESS** (Payroll UI + tax/SSO 2B)
- Landed before close: inbox vs history by event date, approvals tabs + counts, branch-scoped leave lists, dashboard action counts from approvals/ops

### 2026-08-01 — Wrong-shift clock approval
- Detect punch outside assigned shift (±60m window); require confirm before clock-in
- On confirm: save punch + `ShiftMismatchRequest` (PENDING); approve moves shift for that day; reject marks `WRONG_SHIFT`
- Approvals inbox section **ย้ายกะ (ผิดกะ)**; me history badges
- Migration `0007_shift_mismatch`

### 2026-08-01 — Phase 3 READY_FOR_APPROVAL
- Attendance adjustments end-to-end (API + me submit + admin approve/reject + approvals inbox)
- Leave org list compact; unified `/hr/approvals` shows leave + OT + adjustments
- Fixed unit tests: Platform home-branch sync skip without config (non-prod); demo cleanup mock + `attendanceAdjustment`
- `npm test`: 187 pass / 0 fail — awaiting user close

### 2026-08-01 — Phase 2 CLOSED → Phase 3 IN_PROGRESS
- User confirmed Phase 2 browser/test pass
- Status Phase 2 → **CLOSED**; Phase 3 → **IN_PROGRESS** (Leave / OT / unified approvals)
- Also landed before close: schedule assign polish, dashboard uses header branch only, branch labels without codes, nav pending UI
- Phase 3 start: `/hr/approvals` unified inbox (hero + leave section + OT compact list + adjustment count/link)

### 2026-07-31 — Phase 2 Attendance 1C in progress
- Punch requires photo evidence (`photoBase64`) + GPS; outside radius rejected
- `MeAttendanceWorkspace` with camera capture + dev GPS mock panel
- Admin `AttendanceDayWorkspace`: day picker, employee cards, avatars, evidence links
- Auto test script updated to send punch photo

### 2026-07-31 — Phase 0 + Phase 1 CLOSED
- User confirmed browser/test pass for phases 0–1
- Status → **CLOSED**; next open work is Phase 2 (Attendance 1C)

### 2026-07-31 — Phase 0 ready for approval
- Created this playbook
- Added `.cursor/rules/customer-ui-theme.mdc` and `hr-product-playbook.mdc` (suite + HR)
- Added `npm run sync:design-tokens` (app → HR copy)
- Verified `design-tokens.css` SHA256 match between app and HR
- Locked decisions: 1C clock, GPS radius configurable, EmployeeAvatar, tax/SSO 2B

### 2026-07-31 — List surface UX (cards + FAB)
- Rule: `.cursor/rules/hr-list-surface-ux.mdc` — list cards, FAB `+`, overlay create/edit, hide internal codes, newest-first dates
- Schedules: period/assignment cards; add via FAB; edit/delete assignment; shift **name only**
- Phase 1: employees list → cards + FAB; locations cards omit code

### 2026-07-31 — Schedule flow: period → shifts → employees
- Create **ช่วงเวลา** first; period detail lists **กะในช่วงนี้** (FAB เพิ่มกะ)
- Open a shift → assign only **พนักงานที่ยังไม่ได้จัดลงกะ**; migration `0003_schedule_period_shifts`

### 2026-07-31 — Phase 1 in progress
- `EmployeeAvatar` on employees list/detail/form; `photoUrl` on `EmployeeRow` + form field
- Replaced locations stub with real CRUD UI including configurable GPS radius (meters)
- Toggle active for `work-locations`; nav key `locations`

### 2026-07-26 — Phase 1 photo upload + demo ×10
- Removed employee photo URL field; camera (`capture`) + file upload via `EmployeePhotoPicker`
- Local storage under `storage/employee-photos/` + GET/POST/DELETE `/api/hr/employees/{id}/photo`
- Expanded demo seed to **10 linked employees** covering attendance/leave/OT/payroll/notifications
- Added [`HR_DEMO_DATASET.md`](./HR_DEMO_DATASET.md) (entities + relationships + phase coverage)

### 2026-07-31 — Login-test tenant (แทน demo สำหรับทดสอบจริง)
- Platform + HR `seed:login-test`: องค์กร **แพลูกแพรว**, 2 สาขา, 10 Auth users รหัสผ่าน `12345678`
- พนักงาน HR ลิงก์ `platformUserId`/`authUserId` — ทดสอบได้ตั้งแต่หน้า login
- Docs: [`HR_LOGIN_TEST_DATASET.md`](./HR_LOGIN_TEST_DATASET.md); cleanup คู่กันทั้งสองโปรเจกต์

### 2026-07-31 — Fix customer header growth loop
- Root cause: ResizeObserver wrote measured header height into `--header-height` while `.customer-header-inner` used that var as `min-height` (+ padding) → infinite stretch
- Fix in `goldensoft-app`: fixed `min-height: 3.875rem`, cap sync 56–192px, `max-height` on header, keep org/branch chips on one row
- Same guardrails in embed shell (`compose-product-html.ts`)
