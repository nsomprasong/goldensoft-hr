# Multi-org Auth ↔ Employee — QA Dataset

ชุดข้อมูลทดสอบฟังก์ชัน Multi-org Auth ↔ Employee (additive บน Full QA)

| รายการ | ค่า |
|--------|-----|
| Prerequisite | Full QA (`TEST-ALPHA` / `TEST-BETA`) + Migration 0017 |
| รหัสผ่านบัญชีที่เชื่อม Auth | **`11111111`** |
| Prefix พนักงาน | `MOA-` |
| Marker | `multi-org-auth-qa` |

ไม่แตะองค์กร `GOLDENSOFT` และไม่ลบ Full QA roster เดิม

---

## 1. วิธีสร้างข้อมูล

```bash
# 0) ถ้ายังไม่มี Full QA
cd goldensoft-platform && npm run seed:full-qa
cd ../goldensoft-hr && npm run seed:full-qa

# 1) Platform — Auth + membership ข้ามบริษัท
cd ../goldensoft-platform
npm run seed:multi-org-auth-qa

# 2) HR — พนักงาน + account access / onboarding / challenge mock
cd ../goldensoft-hr
npm run seed:multi-org-auth-qa
```

ล้างเฉพาะชุดนี้:

```bash
cd goldensoft-hr && npm run seed:multi-org-auth-qa:cleanup
cd ../goldensoft-platform && npm run seed:multi-org-auth-qa:cleanup
```

---

## 2. บัญชี Auth ที่เพิ่ม

| อีเมล | องค์กร | สาขา (Platform scope) | พนักงาน HR | ใช้ทดสอบ |
|--------|--------|------------------------|------------|----------|
| `x.both@ex.com` | **อัลฟ่า + เบต้า** | **ADMIN** · อัลฟ่าทุกสาขา · เบต้า HQ | `MOA-BOTH` ทั้ง 2 บริษัท | สลับบริษัท + ใช้เมนู HR ครบ (ไม่ติดแค่「งานของฉัน」) |
| `x.branch@ex.com` | อัลฟ่า | EMPLOYEE · ทุกสาขา | `MOA-BR` (บ้านที่ B2) | เลือกสาขา + เมนูงานของฉัน |
| `x.rehire@ex.com` | อัลฟ่า | EMPLOYEE · HQ | `MOA-OLD` + `MOA-NEW` | rehire / partial unique |

---

## 3. พนักงาน HR เพิ่มเติม (ไม่บังคับมี Auth)

| รหัส | องค์กร | account access | onboarding | ใช้ทดสอบ |
|------|--------|----------------|------------|----------|
| `MOA-FREE` | อัลฟ่า | `NOT_LINKED` | `NO_NOTIFICATION` | พนักงานยังไม่เชื่อมบัญชี |
| `MOA-OTP` | อัลฟ่า | `PENDING_ACTIVATION` | `OTP_VERIFICATION` | challenge OTP mock (`moa-otp-otp`) — **ไม่ส่ง SMS** |
| `MOA-INV` | อัลฟ่า | `PENDING_ACTIVATION` | `INVITATION` | challenge invitation mock (`moa-invite-inv`) — **ไม่ส่งอีเมล** |
| `MOA-OLD` | อัลฟ่า | `DISABLED` | — | แถวเก่า inactive ยังมี `auth_user_id` |
| `MOA-NEW` | อัลฟ่า | `ACTIVE` | — | รีไฮร์ active คนละแถว Auth เดิม |
| `MOA-BOTH` | อัลฟ่า + เบต้า | `ACTIVE` | — | พนักงานสองบริษัท Auth เดียว |
| `MOA-BR` | อัลฟ่า | `ACTIVE` | — | สังกัดสาขา B2 |

---

## 4. ลำดับทดสอบที่แนะนำ

1. Login `x.both@ex.com` → เข้า shell ทันที (ไม่เจอหน้าเลือกองค์กรเต็มจอ) → สลับบริษัทจากแถบด้านบน → เห็นเมนู HR ฝั่งแอดมิน
2. ในแต่ละบริษัท เปิดรายชื่อพนักงาน แล้วหา `MOA-BOTH` ของบริษัทนั้น
3. Login `x.branch@ex.com` → เข้า shell ทันที → เลือกสาขาจากแถบด้านบน → ใช้「งานของฉัน」(ลงเวลา/ลา) ได้
4. Login `x.rehire@ex.com` → บริบทพนักงานต้องชี้ไป `MOA-NEW` ไม่ใช่ `MOA-OLD`
5. ใน HR (owner/admin อัลฟ่า) เปิด `MOA-FREE` / `MOA-OTP` / `MOA-INV` ตรวจสถานะ account access
6. ยืนยันว่าไม่เห็นบริษัทนอก membership และ forged `employeeId` ถูกปฏิเสธใน API

---

## 5. ไฟล์ที่เกี่ยวข้อง

| ฝั่ง | ไฟล์ |
|------|------|
| Platform seed | `goldensoft-platform/src/lib/seed/multi-org-auth-qa-dataset.ts` |
| Platform scripts | `npm run seed:multi-org-auth-qa` / `:cleanup` |
| HR seed | `goldensoft-hr/src/lib/seed/multi-org-auth-qa-dataset.ts` |
| HR scripts | `npm run seed:multi-org-auth-qa` / `:cleanup` |
| เอกสารนี้ | `goldensoft-hr/docs/MULTI_ORG_AUTH_QA_DATASET.md` |
