/**
 * HR audit trail.
 *
 * Two hard rules live here:
 *   1. Compensation amounts are masked before they reach the audit table — the
 *      trail proves *that* pay changed, never *what* anyone earns.
 *   2. Credentials never reach the trail at all; any token/secret-looking key
 *      is dropped rather than masked.
 */
import type { HrRepository } from "@/lib/hr/repository/types";

export const HR_AUDIT_ACTIONS = {
  employeeCreate: "employee.create",
  employeeUpdate: "employee.update",
  employeeDeactivate: "employee.deactivate",
  employeeLinkUser: "employee.link_user",
  employeeUnlinkUser: "employee.unlink_user",
  employeeAuthDetected: "employee.auth_detected",
  employeeAuthLinked: "employee.auth_linked",
  employeeAuthUnlinked: "employee.auth_unlinked",
  employeeOtpRequested: "employee.otp_requested",
  employeeOtpVerified: "employee.otp_verified",
  employeeInvitationCreated: "employee.invitation_created",
  employeeInvitationAccepted: "employee.invitation_accepted",
  employeeNoNotificationSelected: "employee.no_notification_selected",
  employeeAccountActivated: "employee.account_activated",
  employeeAccountDisabled: "employee.account_disabled",
  contextOrganizationSwitched: "context.organization_switched",
  contextBranchSwitched: "context.branch_switched",
  faceEnrolled: "face.enrolled",
  faceDuplicateBlocked: "face.duplicate_blocked",
  faceRevoked: "face.revoked",
  employeeEmploymentTerminated: "employee.employment_terminated",
  employeeEmploymentReactivated: "employee.employment_reactivated",
  compensationAdd: "compensation.add",
  departmentCreate: "department.create",
  departmentUpdate: "department.update",
  departmentDeactivate: "department.deactivate",
  positionCreate: "position.create",
  positionUpdate: "position.update",
  positionDeactivate: "position.deactivate",
  shiftCreate: "shift.create",
  shiftUpdate: "shift.update",
  shiftDeactivate: "shift.deactivate",
  payrollScheduleCreate: "payroll_schedule.create",
  payrollScheduleUpdate: "payroll_schedule.update",
  payrollPeriodCreate: "payroll_period.create",
  payrollPeriodStatusChange: "payroll_period.status_change",
  overtimeRuleCreate: "overtime_rule.create",
  overtimeRuleUpdate: "overtime_rule.update",
  overtimeRuleDeactivate: "overtime_rule.deactivate",
} as const;

export type HrAuditAction =
  (typeof HR_AUDIT_ACTIONS)[keyof typeof HR_AUDIT_ACTIONS];

export const MASKED_VALUE = "****";

const SECRET_KEY_PATTERN =
  /(token|secret|password|passwd|api[-_]?key|authorization|cookie|credential|session)/i;

const MASKED_MONEY_KEYS = new Set([
  "amount",
  "fixedamount",
  "baseamount",
  "salary",
  "wage",
  "netpay",
  "grosspay",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Recursively strip credentials and mask money fields.
 * Returns `null` for nullish input so the audit column stays NULL.
 */
export function sanitizeAuditPayload(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditPayload(item));
  if (!isPlainObject(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (MASKED_MONEY_KEYS.has(key.toLowerCase()) && item != null) {
      output[key] = MASKED_VALUE;
      continue;
    }
    output[key] = sanitizeAuditPayload(item);
  }
  return output;
}

/**
 * Compensation snapshots keep currency and effective dates readable while the
 * figure itself is replaced with a mask.
 */
export function maskCompensationSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot) return null;
  const masked = sanitizeAuditPayload(snapshot);
  return isPlainObject(masked) ? masked : null;
}

export type WriteHrAuditInput = {
  organizationId: string | null;
  branchId?: string | null;
  actorAuthUserId: string | null;
  actionCode: HrAuditAction | string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Write one audit row. Never throws into the caller's business transaction —
 * a failed audit must not roll back a legitimate HR change, but it is logged.
 */
export async function writeHrAudit(
  repository: HrRepository,
  input: WriteHrAuditInput,
): Promise<void> {
  try {
    const actionType = await repository.masters.findByCode(
      "auditActionType",
      input.actionCode,
    );
    if (!actionType) {
      console.warn(`[hr-audit] unknown action code ${input.actionCode}`);
      return;
    }

    await repository.audit.create({
      organizationId: input.organizationId,
      branchId: input.branchId ?? null,
      actorAuthUserId: input.actorAuthUserId,
      actionTypeId: actionType.id,
      actionCode: actionType.code,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: sanitizeAuditPayload(input.before),
      afterJson: sanitizeAuditPayload(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (error) {
    console.error("[hr-audit] failed to write audit entry", error);
  }
}
