# HR Login Test Dataset — แพลูกแพรว

ชุดข้อมูล**จริงสำหรับทดสอบ** (ไม่ใช่ DEMO mock อีกต่อไป)

- องค์กร + สาขา + บัญชี Auth ที่ล็อกอินได้
- พนักงานผูกกับบัญชีแล้ว (self-service / แอดมิน HR)
- รหัสผ่านทุกคน: **`12345678`**
- ใช้เสร็จแล้วล้างออกได้ทั้งฝั่ง HR และ Platform

> เอกสารชุดเก่า `HR_DEMO_DATASET.md` ถูกเลิกใช้ — ใช้ไฟล์นี้แทน

---

## 1. วิธีสร้างข้อมูล

```bash
# 1) Platform — องค์กร / สาขา / Auth users
cd goldensoft-platform
npm run seed:login-test

# 2) HR — พนักงาน + ตารางงาน / ลงเวลา / ลา / OT / payroll
cd ../goldensoft-hr
npm run seed:hr          # master ครั้งแรกถ้ายังไม่มี
npm run seed:login-test
```

ล็อกอินที่: `http://localhost:3000/login`  
จากนั้นเลือกองค์กร **แพลูกแพรว** แล้วเข้า Customer App / HR

---

## 2. วิธีล้างข้อมูล (เมื่อทดสอบเสร็จ)

```bash
# ลบข้อมูล HR ก่อน
cd goldensoft-hr
npm run seed:login-test:cleanup
# ตรวจก่อนลบ: npm run seed:login-test:cleanup -- --dry-run

# แล้วลบองค์กร + Auth users ที่ Platform
cd ../goldensoft-platform
npm run seed:login-test:cleanup
# ตรวจก่อนลบ: npm run seed:login-test:cleanup -- --dry-run
```

ล้างเฉพาะรหัส `TEST-PLUKPRAEW` / อีเมลในตารางด้านล่าง — **ไม่แตะ GOLDENSOFT**

---

## 3. องค์กรและสาขา

| รายการ | ค่า |
|--------|-----|
| ชื่อองค์กร | **แพลูกแพรว** |
| รหัสองค์กร | `TEST-PLUKPRAEW` |
| สาขา HQ | `HQ` — สำนักงานใหญ่ |
| สาขา 2 | `BRANCH01` — สาขาพระราม 9 |
| สินค้า | GoldenSoft HR (ACTIVE) |
| รหัสผ่านทุกบัญชี | `12345678` |

---

## 4. บัญชีล็อกอิน (10 คน)

รหัสผ่านทุกแถว: **`12345678`**

| รหัสพนักงาน | อีเมล | ชื่อ | บทบาท Platform | สาขา | ใช้ทดสอบ |
|-------------|--------|------|----------------|------|----------|
| EMP-0001 | `plukpraew.owner@example.com` | สมชาย ใจดี | **OWNER** | ทุกสาขา | แอดมิน HR ครบสิทธิ์ |
| EMP-0002 | `plukpraew.admin@example.com` | สมหญิง รักงาน | **ADMIN** | ทุกสาขา | แอดมินองค์กร |
| EMP-0003 | `plukpraew.hq.supervisor@example.com` | วิชัย ขยันงาน | EMPLOYEE | HQ | self-service HQ |
| EMP-0004 | `plukpraew.hq.staff1@example.com` | นภา สุขใจ | EMPLOYEE | HQ | ลาป่วยรออนุมัติ |
| EMP-0005 | `plukpraew.hq.staff2@example.com` | ประยุทธ์ มั่นคง | EMPLOYEE | HQ | payroll หัก TAX/SSO |
| EMP-0006 | `plukpraew.b1.manager@example.com` | ศิริพร ยิ้มแย้ม | **BRANCH_MANAGER** | BRANCH01 | ผู้ดูแลสาขา — อนุมัติในสาขา |
| EMP-0007 | `plukpraew.b1.staff1@example.com` | อนุชา ตรงเวลา | EMPLOYEE | BRANCH01 | มาสาย / ขาดงาน / ขอปรับเวลาเข้ารออนุมัติ |
| EMP-0008 | `plukpraew.hq.newhire@example.com` | จิราภรณ์ ใหม่งาน | EMPLOYEE | HQ | ทดลองงาน |
| EMP-0009 | `plukpraew.hq.resigned@example.com` | ธนา ลาออกแล้ว | EMPLOYEE | HQ | สถานะลาออก |
| EMP-0010 | `plukpraew.b1.suspended@example.com` | วราภรณ์ พักงาน | EMPLOYEE | BRANCH01 | OT รออนุมัติ |

### แนะนำลำดับทดสอบล็อกอิน

1. **สมชาย** (`plukpraew.owner@example.com`) — เข้า HR จัดการพนักงาน / อนุมัติลา-OT  
2. **นภา** (`plukpraew.hq.staff1@example.com`) — มุมพนักงาน self-service  
   (เมนู: ลงเวลา / ตารางงาน / การลา / OT / สลิป — บทบาท EMPLOYEE)
3. **ศิริพร** (`plukpraew.b1.manager@example.com`) — ผู้ดูแลสาขา BRANCH01  
   (เมนู: รายการรออนุมัติ — เห็นเฉพาะคำขอของสาขาตน; OWNER/ADMIN เห็นทั้งองค์กร)

---

## 5. ความสัมพันธ์ข้อมูล

```text
Platform
  Organization TEST-PLUKPRAEW (แพลูกแพรว)
    ├─ Branch HQ
    ├─ Branch BRANCH01
    ├─ Subscription GOLDENSOFT_HR
    └─ UserProfile × 10  ← Auth password 12345678
         └─ OrganizationMembership + Role + BranchScope

HR
  Employee EMP-0001…0010
    ├─ platformUserId / authUserId  (ลิงก์กับ UserProfile)
    ├─ branchId → HQ หรือ BRANCH01
    ├─ Department / Position / Compensation / Avatar
    ├─ ShiftAssignment + AttendanceDay/Event
    ├─ LeaveRequest / OvertimeRequest / Notification
    ├─ PayrollDeductionSettings (ภาษี 3% / SSO 5% เพดาน 750)
    ├─ PayrollRun งวดแรก = อนุมัติแล้ว + ออกสลิปทุกคน (EMP-0005 ภาษี 5%)
    └─ PayrollRun งวดถัดไป = ร่าง (สำหรับทดสอบคำนวณ)
```

### Payroll / สลิป (Phase 4)

| หน้า | บัญชีทดสอบ | สิ่งที่ควรเห็น |
|------|------------|----------------|
| `/hr/settings/payroll-deductions` | owner | อัตราภาษี 3% + SSO 5% เพดาน 750 |
| `/hr/payroll/runs` | owner | รอบอนุมัติแล้ว + รอบร่าง |
| `/hr/payslips` | owner | สลิปออกแล้วหลายใบ (ชื่อคน + ยอดสุทธิ) |
| `/hr/me/payslips` | `plukpraew.hq.staff1@example.com` | สลิปของนภา |
| `/hr/me/payslips` | `plukpraew.hq.staff2@example.com` | สลิปประยุทธ์ (หักภาษีสูงกว่า) |
| `/hr/advances` | owner | แผนหักหลายงวด + คำขอรออนุมัติ |
| `/hr/me/advances` | พนักงาน (เช่น staff1) | ส่งคำขอเบิกของตนเอง |
| `/hr/approvals?tab=advance` | owner / branch manager | อนุมัติ + เลือกเงินสดหรือโอนพร้อมเงินเดือน |
| `/hr/reports` | owner | สรุปเบิกล่วงหน้า รอหัก/หักแล้ว |

---

## 6. ทดสอบ GPS / ลงเวลา

ชุด login-test มีสถานที่ทำงาน + ผูกพนักงานแล้ว:

| สาขา | รหัสสถานที่ | พิกัด (lat, lng) | รัศมี |
|------|-------------|------------------|--------|
| HQ | `TEST_HQ` (ชื่อ: สำนักงานใหญ่) | **13.75630, 100.50180** | 50 ม. |
| BRANCH01 | `TEST_BRANCH01` (ชื่อ: สาขาพระราม 9) | **13.74600, 100.53400** | 100 ม. |

พนักงาน HQ (เช่น นภา EMP-0004) → จุด HQ  
พนักงาน BRANCH01 (เช่น ศิริพร EMP-0006) → จุดสาขาพระราม 9

### วิธีทดสอบในหน้าลงเวลา (`/hr/me/attendance`)

1. ล็อกอิน `plukpraew.hq.staff1@example.com` / `12345678`
2. เปิด **ลงเวลาของฉัน**
3. **ถ่ายรูป** หลักฐาน (จำเป็น — ไม่มีรูปจะลงเวลาไม่ได้)
4. ในโหมด **development** มีแผง **ทดสอบ GPS (dev เท่านั้น)**:
   - เลือก **จำลอง: อยู่ในรัศมี** → กดเข้างาน → ต้องสำเร็จ + ขึ้นประวัติ
   - เลือก **จำลอง: นอกรัศมี** → กดเข้างาน → ต้องถูกปฏิเสธ
   - **ใช้ GPS เครื่องจริง** — ผ่านเฉพาะเมื่ออยู่ใกล้พิกัดด้านบนจริง ๆ
5. แอดมินเปิด **เวลาทำงาน** (`/hr/attendance`) ดูการ์ดรายวัน + avatar + รูปหลักฐาน

แอดมินดู/แก้จุดลงเวลาได้ที่เมนูสถานที่ทำงาน (สิทธิ์ `hr.location.manage`)

### Checklist GPS + รูป

- [ ] เห็นชื่อจุดลงเวลา + รัศมีบนหน้าลงเวลา
- [ ] ไม่มีรูป → ลงเวลาไม่ได้
- [ ] ถ่ายรูป + จำลองอยู่ในรัศมี → บันทึกได้
- [ ] จำลองนอกรัศมี → ถูกปฏิเสธ
- [ ] ประวัติวันนี้แสดงรายการหลังบันทึกสำเร็จ
- [ ] แอดมินเห็นการ์ดพนักงาน + avatar ในหน้าเวลาทำงาน

รันทดสอบอัตโนมัติ (EMP-0004 / TEST_HQ):

```bash
cd goldensoft-hr
npx tsx scripts/test-attendance-gps.ts
```

---

## 7. Checklist ทดสอบเร็ว

- [ ] ล็อกอินด้วย `plukpraew.owner@example.com` / `12345678`
- [ ] เห็นองค์กร **แพลูกแพรว** และเข้า HR ได้
- [ ] รายชื่อพนักงาน 10 คน มีรูปไอคอน
- [ ] ล็อกอินเป็น EMP-0004 แล้วเห็นมุม self-service
- [ ] ล็อกอินเป็น EMP-0006 แล้วสังกัดสาขา BRANCH01
- [ ] แอดมินเห็นคำขอลา/OT รออนุมัติ
- [ ] ทดสอบ GPS ตามหมวด 6
- [ ] หลังทดสอบ: รัน cleanup ทั้ง HR แล้ว Platform

---

## 8. ไฟล์ที่เกี่ยวข้อง

| โปรเจกต์ | ไฟล์ |
|----------|------|
| Platform | `src/lib/seed/login-test-dataset.ts` |
| Platform | `npm run seed:login-test` / `seed:login-test:cleanup` |
| HR | `src/lib/seed/login-test-dataset.ts` |
| HR | `npm run seed:login-test` / `seed:login-test:cleanup` |
