# Multi-org Auth ↔ Employee — Delta Design (temporary)

Status: implementation guide for additive work. Prefer code over this doc if they diverge.

## 1. Current structure (reuse)

| Layer | What exists |
| --- | --- |
| Platform Auth | `UserProfile.authUserId` unique; optional `phone` unique (E.164) |
| Multi-org access | `OrganizationMembership` unique `(organizationId, userProfileId)` + roles/branch scopes |
| Session context | Cookie `gs_platform_ctx`: `organizationId`, `branchId`, `mode` |
| HR Employee | Soft links `authUserId` / `platformUserId` (nullable); org-scoped uniques |
| Employment status | Master `employee_statuses` (ACTIVE / INACTIVE / RESIGNED / TERMINATED / SUSPENDED) |
| Onboarding today | `createEmployee` always unlinked; `linkPlatformUser` / Platform `UserInvitation` |
| Face | `employee_face_enrollments` unique per `employeeId`, indexed by `organizationId`; duplicate descriptor check is **org-scoped**; same-org face match requires **email or phone** align |
| Audit | `audit_action_types` + `writeHrAudit` / Platform `writeAuditLog` |

## 2. Gaps

- No separate **account access** status vs employment status
- No HR onboarding method (OTP / invitation / none)
- `@@unique(organizationId, authUserId)` blocks **rehire** while keeping prior row’s auth link
- Context cookie has no `employeeId`
- Face enroll lacks audit on duplicate block (check itself is org-scoped)
- Phone Auth probe must not leak other orgs

## 3. Chosen delta (minimal)

1. Keep Membership + Employee soft links — do **not** invent a parallel link table
2. Replace org+auth / org+platformUser **full** unique with **partial unique** `WHERE is_active AND col IS NOT NULL`
3. Add masters: `employee_account_access_statuses`, `employee_onboarding_methods`
4. Add nullable Employee columns + `employee_activation_challenges` for OTP/invite tokens (mockable)
5. Extend context cookie with optional `employeeId` (backward compatible decode)
6. Compatibility: `resolveSelfEmployee` stays org-scoped; prefer `isActive` + optional context employeeId

## 4. Risks to existing data

- Applying partial unique fails if org already has two active employees sharing auth — validation script must detect first
- Do **not** apply migration / backfill to production without approval

## 5. Out of scope / approval required

- `prisma migrate deploy`, production seed, real SMS OTP, real invitation email, DB reset
