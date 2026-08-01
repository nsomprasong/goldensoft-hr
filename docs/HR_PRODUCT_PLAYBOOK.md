# HR Product Playbook

> **อ่านไฟล์นี้ก่อนแก้ HR ทุกครั้ง** — เป็นแหล่งอ้างอิงเดียว ไม่ต้องไล่โครงสร้างโปรเจกต์ใหม่  
> อัปเดตไฟล์นี้ทุกครั้งที่ปิดงานย่อยหรือขออนุมัติปิดเฟส

Last updated: 2026-08-01  
Repos: `goldensoft-hr` (product), `goldensoft-app` (shell + tokens), `goldensoft-platform` (auth/permissions)

---

## 1. Product goals (locked)

| Topic | Decision |
|-------|----------|
| Org / branch | พนักงานและข้อมูลปฏิบัติการแยกตามองค์กรและสาขา (ของใครของมัน) |
| Clock-in | **1C:** ถ่ายรูปเก็บหลักฐาน + GPS ตามรัศมีที่ตั้งได้ → บันทึกทันที; face matching = Phase 8 |
| GPS radius | แต่ละ `WorkLocation` ตั้ง `geofenceRadiusMeters` ได้; นอกรัศมี = ปฏิเสธ |
| Employee list | แสดง **EmployeeAvatar** (รูปวงกลม) ข้างชื่อทุกครั้ง; ไม่มีรูป = อักษรย่อ |
| OT / leave / late | ใช้งานง่าย; หักลา ขาด สาย เชื่อมจากสรุปรายวัน |
| Pay cycle | รายวัน / รายอาทิตย์ / รายเดือน ผ่าน payroll schedules |
| Tax / SSO | **2B:** โครงหัก + อัตราตั้งค่าได้ก่อน; ยังไม่เคลมถูกกฎหมายจนกว่า Phase 8 |
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
| การลา / OT / อนุมัติ | leave, overtime, approvals | working | 3 | รวมคิวลา/OT/ปรับเวลา; me leave/OT + ขอแก้เวลา |
| ประมวลผล / สลิป / รายงาน | payroll runs, payslips, reports | stub | 4–7 | |
| ลงเวลาของฉัน | `/hr/me/attendance` | working | 2 | รูป + GPS + รัศมี; face = Phase 8 |
| me อื่นๆ | schedule/leave/OT/payslips | partial | 3–5 | leave/OT ของฉันใช้งานได้; payslips ยัง stub |
| เบิกล่วงหน้า | — | missing | 6 | |
| Face matching | — | missing | 8 | |
| Tax/SSO legal | payroll-calc placeholders | partial | 4 then 8 | |

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
- Status: **READY_FOR_APPROVAL**
- Done:
  - Me leave / me OT workspaces (compact list + overlay submit)
  - Org leave + OT approval lists (compact rows + approve/reject)
  - Attendance adjustments: create / list / approve|reject API; apply clocks to `AttendanceDay`
  - Me attendance: ขอแก้เวลา; admin `/hr/attendance/adjustments` + rows on `/hr/approvals`
  - Navigation pending UI (shell + HR) for screen changes
  - Login-test seed: pending adjustment (EMP-0007); `npm test` 187 pass
- Close when: user approves (do not mark CLOSED without approval)

### Phase 4 — Payroll UI + tax/SSO configurable (2B)
- Status: **OPEN**

### Phase 5 — Mobile self-service hub
- Status: **OPEN**

### Phase 6 — Advances + notification center
- Status: **OPEN**

### Phase 7 — Reports + manager dashboard
- Status: **OPEN**

### Phase 8 — Face matching + legal tax/SSO depth
- Status: **OPEN** (separate approvals OK)

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
| Admin attendance day | `attendance-day-workspace.tsx`, `listAttendanceDays` in `operations.ts` |
| Login-test dataset | `src/lib/seed/login-test-dataset.ts`, `docs/HR_LOGIN_TEST_DATASET.md` |
| Demo dataset (legacy) | `src/lib/seed/demo-dataset.ts`, `docs/HR_DEMO_DATASET.md` |
| Tokens | `src/app/design-tokens.css`, `src/app/globals.css` |

Do **not** re-read whole repo if this map answers the question — update the map when paths change.

---

## 8. Changelog

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
