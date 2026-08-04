import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { decodePhotoBase64 } from "@/lib/hr/attendance-photos";
import { assertHrPermission } from "@/lib/hr/authorize";
import { HrError } from "@/lib/hr/errors";
import {
  deleteFaceEnrollmentPhoto,
  faceEnrollmentPhotoPublicPath,
  saveFaceEnrollmentPhoto,
} from "@/lib/hr/face-enrollment-photos";
import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  FACE_DESCRIPTOR_VERSION,
  euclideanDistance,
  isFaceMatch,
  isFaceMatchMode,
  parseFaceDescriptor,
  type FaceMatchMode,
} from "@/lib/hr/face-match";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import type { HrServiceContext } from "@/lib/hr/services/shared";

function facePhotoSaveErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message.trim() : "";
  if (raw === "PHOTO_TOO_LARGE") return "ไฟล์รูปใหญ่เกิน 2.5 MB";
  if (raw === "UNSUPPORTED_PHOTO_TYPE") {
    return "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF";
  }
  if (raw === "EMPTY_PHOTO") return "ไฟล์รูปว่างเปล่า — ถ่ายใหม่";
  if (/EACCES|EPERM|permission denied/i.test(raw)) {
    return "บันทึกรูปใบหน้าไม่สำเร็จ — เซิร์ฟเวอร์ไม่มีสิทธิ์เขียนโฟลเดอร์เก็บรูป (storage/face-enrollments)";
  }
  if (/ENOSPC/i.test(raw)) {
    return "บันทึกรูปใบหน้าไม่สำเร็จ — พื้นที่ดิสก์ของเซิร์ฟเวอร์เต็ม";
  }
  if (/ENOENT|EROFS|read-only/i.test(raw)) {
    return "บันทึกรูปใบหน้าไม่สำเร็จ — สร้างโฟลเดอร์เก็บรูปบนเซิร์ฟเวอร์ไม่ได้";
  }
  if (raw) return `บันทึกรูปใบหน้าไม่สำเร็จ — ${raw.slice(0, 180)}`;
  return "บันทึกรูปใบหน้าไม่สำเร็จ";
}

function faceEnrollmentDbErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message.trim() : String(err ?? "");
  if (/employee_face_enrollments|42P01|does not exist/i.test(raw)) {
    return "บันทึกใบหน้าไม่สำเร็จ — ยังไม่มีตารางใบหน้าในฐานข้อมูล (ต้องรัน migration 0015_face_matching)";
  }
  if (/foreign key|23503/i.test(raw)) {
    return "บันทึกใบหน้าไม่สำเร็จ — ข้อมูลพนักงานไม่พร้อมใช้งาน";
  }
  if (/unique|23505/i.test(raw)) {
    return "บันทึกใบหน้าไม่สำเร็จ — มีข้อมูลใบหน้าซ้ำในระบบ";
  }
  if (raw) {
    const short = raw.replace(/\s+/g, " ").slice(0, 180);
    return `บันทึกใบหน้าไม่สำเร็จ — ${short}`;
  }
  return "บันทึกใบหน้าไม่สำเร็จ — เกิดข้อผิดพลาดฐานข้อมูล";
}

async function resolveSelfEmployee(ctx: HrServiceContext) {
  const employee = await prisma.employee.findFirst({
    where: {
      organizationId: ctx.organizationId,
      authUserId: ctx.actorAuthUserId,
      isActive: true,
    },
  });
  if (!employee) {
    throw new HrError("NOT_FOUND", {
      message: "ไม่พบข้อมูลพนักงานที่เชื่อมต่อ",
    });
  }
  return employee;
}

export type AttendanceFaceSettingsRow = {
  id: string;
  organizationId: string;
  mode: FaceMatchMode;
  matchThreshold: number;
  updatedAt: string;
};

export type SelfFaceMatchStatus = {
  mode: FaceMatchMode;
  matchThreshold: number;
  enrolled: boolean;
  enrolledAt: string | null;
  photoUrl: string | null;
  /** Client should extract + send faceDescriptor when true. */
  requireDescriptor: boolean;
};

export type FaceClockCheckResult = {
  mode: FaceMatchMode;
  matched: boolean | null;
  distance: number | null;
  warning: string | null;
};

type SettingsDbRow = {
  id: string;
  organization_id: string;
  mode: string;
  match_threshold: string | number;
  updated_at: Date;
};

function toSettingsRow(row: SettingsDbRow): AttendanceFaceSettingsRow {
  const mode = isFaceMatchMode(row.mode) ? row.mode : "OFF";
  return {
    id: row.id,
    organizationId: row.organization_id,
    mode,
    matchThreshold: Number(row.match_threshold),
    updatedAt: row.updated_at.toISOString(),
  };
}

function defaultSettings(organizationId: string): AttendanceFaceSettingsRow {
  return {
    id: "",
    organizationId,
    mode: "OFF",
    matchThreshold: DEFAULT_FACE_MATCH_THRESHOLD,
    updatedAt: new Date(0).toISOString(),
  };
}

async function findSettingsRow(
  organizationId: string,
): Promise<SettingsDbRow | null> {
  try {
    const rows = await prisma.$queryRaw<SettingsDbRow[]>`
      SELECT
        id::text AS id,
        organization_id::text AS organization_id,
        mode,
        match_threshold,
        updated_at
      FROM hr.attendance_face_settings
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getAttendanceFaceSettings(
  ctx: HrServiceContext,
): Promise<AttendanceFaceSettingsRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.settingsManage,
    HR_PERMISSIONS.attendanceManage,
    HR_PERMISSIONS.attendanceRead,
  ]);
  const row = await findSettingsRow(ctx.organizationId);
  return row ? toSettingsRow(row) : defaultSettings(ctx.organizationId);
}

export async function upsertAttendanceFaceSettings(
  ctx: HrServiceContext,
  input: { mode?: unknown; matchThreshold?: unknown },
): Promise<AttendanceFaceSettingsRow> {
  assertHrPermission(ctx, [
    HR_PERMISSIONS.settingsManage,
    HR_PERMISSIONS.attendanceManage,
  ]);

  const current = await findSettingsRow(ctx.organizationId);
  const mode = isFaceMatchMode(input.mode)
    ? input.mode
    : current
      ? toSettingsRow(current).mode
      : "OFF";
  const thresholdRaw =
    input.matchThreshold == null
      ? current
        ? Number(current.match_threshold)
        : DEFAULT_FACE_MATCH_THRESHOLD
      : Number(input.matchThreshold);
  if (
    !Number.isFinite(thresholdRaw) ||
    thresholdRaw <= 0 ||
    thresholdRaw > 2
  ) {
    throw new HrError("VALIDATION_ERROR", {
      message: "เกณฑ์จับคู่ใบหน้าต้องอยู่ระหว่าง 0 ถึง 2",
    });
  }

  const id = current?.id ?? randomUUID();
  const actor = ctx.actorAuthUserId;

  await prisma.$executeRaw`
    INSERT INTO hr.attendance_face_settings (
      id, organization_id, mode, match_threshold,
      updated_by_auth_user_id, created_at, updated_at
    )
    VALUES (
      ${id}::uuid,
      ${ctx.organizationId}::uuid,
      ${mode},
      ${thresholdRaw},
      ${actor}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      mode = EXCLUDED.mode,
      match_threshold = EXCLUDED.match_threshold,
      updated_by_auth_user_id = EXCLUDED.updated_by_auth_user_id,
      updated_at = CURRENT_TIMESTAMP
  `;

  const saved = await findSettingsRow(ctx.organizationId);
  return saved ? toSettingsRow(saved) : defaultSettings(ctx.organizationId);
}

type EnrollmentMetaRow = {
  enrolled_at: Date;
  photo_url: string | null;
};

type EnrollmentDescriptorRow = {
  descriptor: unknown;
};

async function findEnrollmentMeta(
  organizationId: string,
  employeeId: string,
): Promise<EnrollmentMetaRow | null> {
  try {
    const rows = await prisma.$queryRaw<EnrollmentMetaRow[]>`
      SELECT enrolled_at, photo_url
      FROM hr.employee_face_enrollments
      WHERE organization_id = ${organizationId}::uuid
        AND employee_id = ${employeeId}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function findEnrollmentDescriptor(
  organizationId: string,
  employeeId: string,
): Promise<EnrollmentDescriptorRow | null> {
  try {
    const rows = await prisma.$queryRaw<EnrollmentDescriptorRow[]>`
      SELECT descriptor
      FROM hr.employee_face_enrollments
      WHERE organization_id = ${organizationId}::uuid
        AND employee_id = ${employeeId}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

type OrgEnrollmentRow = {
  employee_id: string;
  descriptor: unknown;
};

/** All enrollments in the org except one employee — used for duplicate face checks. */
async function listOrgEnrollmentDescriptors(
  organizationId: string,
  exceptEmployeeId: string,
): Promise<OrgEnrollmentRow[]> {
  try {
    return await prisma.$queryRaw<OrgEnrollmentRow[]>`
      SELECT employee_id::text AS employee_id, descriptor
      FROM hr.employee_face_enrollments
      WHERE organization_id = ${organizationId}::uuid
        AND employee_id <> ${exceptEmployeeId}::uuid
    `;
  } catch {
    return [];
  }
}

export async function getSelfFaceMatchStatus(
  ctx: HrServiceContext,
): Promise<SelfFaceMatchStatus> {
  assertHrPermission(ctx, HR_PERMISSIONS.attendanceSelf);
  const employee = await resolveSelfEmployee(ctx);
  const settingsRow = await findSettingsRow(ctx.organizationId);
  const settings = settingsRow
    ? toSettingsRow(settingsRow)
    : defaultSettings(ctx.organizationId);

  const enrollment = await findEnrollmentMeta(
    ctx.organizationId,
    employee.id,
  );
  const enrolled = Boolean(enrollment);
  const enrolledAt = enrollment?.enrolled_at?.toISOString() ?? null;
  const photoUrl = enrollment
    ? enrollment.photo_url ?? faceEnrollmentPhotoPublicPath(employee.id)
    : null;

  return {
    mode: settings.mode,
    matchThreshold: settings.matchThreshold,
    enrolled,
    enrolledAt,
    photoUrl,
    requireDescriptor: settings.mode !== "OFF",
  };
}

export async function enrollMyFace(
  ctx: HrServiceContext,
  input: { faceDescriptor?: unknown; photoBase64?: unknown },
): Promise<{
  enrolled: true;
  enrolledAt: string;
  photoUrl: string | null;
}> {
  assertHrPermission(ctx, HR_PERMISSIONS.attendanceSelf);
  const employee = await resolveSelfEmployee(ctx);
  const descriptor = parseFaceDescriptor(input.faceDescriptor);
  if (!descriptor) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ไม่พบข้อมูลใบหน้าสำหรับลงทะเบียน — ถ่ายรูปให้เห็นใบหน้าชัดเจน",
    });
  }

  // Org-wide duplicate check (all branches). Never reveal other organizations.
  const settingsForDup = await findSettingsRow(ctx.organizationId);
  const threshold = settingsForDup
    ? Number(settingsForDup.match_threshold)
    : DEFAULT_FACE_MATCH_THRESHOLD;
  const otherDescriptors = await listOrgEnrollmentDescriptors(
    ctx.organizationId,
    employee.id,
  );
  for (const other of otherDescriptors) {
    const otherDesc = parseFaceDescriptor(other.descriptor);
    if (!otherDesc) continue;
    const distance = euclideanDistance(otherDesc, descriptor);
    if (isFaceMatch(distance, threshold)) {
      throw new HrError("FORBIDDEN", {
        message:
          "ใบหน้านี้ถูกใช้กับพนักงานอื่นในบริษัทนี้แล้ว — ติดต่อผู้ดูแลองค์กร",
        details: { code: "FACE_DUPLICATE_IN_ORG" },
      });
    }
  }

  const photoBuffer = decodePhotoBase64(input.photoBase64);
  if (!photoBuffer) {
    throw new HrError("VALIDATION_ERROR", {
      message: "ต้องถ่ายรูปใบหน้าตอนลงทะเบียน",
    });
  }

  let photoUrl: string | null = null;
  try {
    const saved = await saveFaceEnrollmentPhoto({
      organizationId: ctx.organizationId,
      employeeId: employee.id,
      buffer: photoBuffer,
    });
    photoUrl = saved.photoUrl;
  } catch (err) {
    throw new HrError("VALIDATION_ERROR", {
      message: facePhotoSaveErrorMessage(err),
    });
  }

  const id = randomUUID();
  const descriptorJson = JSON.stringify(descriptor);
  try {
    await prisma.$executeRaw`
    INSERT INTO hr.employee_face_enrollments (
      id, organization_id, employee_id, descriptor, descriptor_version,
      photo_url, enrolled_at, enrolled_by_auth_user_id, created_at, updated_at
    )
    VALUES (
      ${id}::uuid,
      ${ctx.organizationId}::uuid,
      ${employee.id}::uuid,
      CAST(${descriptorJson} AS JSONB),
      ${FACE_DESCRIPTOR_VERSION},
      ${photoUrl},
      CURRENT_TIMESTAMP,
      ${ctx.actorAuthUserId}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (employee_id) DO UPDATE SET
      descriptor = EXCLUDED.descriptor,
      descriptor_version = EXCLUDED.descriptor_version,
      photo_url = EXCLUDED.photo_url,
      enrolled_at = CURRENT_TIMESTAMP,
      enrolled_by_auth_user_id = EXCLUDED.enrolled_by_auth_user_id,
      updated_at = CURRENT_TIMESTAMP
  `;
  } catch (err) {
    console.error("[face-enroll] insert failed", err);
    throw new HrError("INTERNAL_ERROR", {
      message: faceEnrollmentDbErrorMessage(err),
    });
  }

  const saved = await findEnrollmentMeta(ctx.organizationId, employee.id);
  return {
    enrolled: true,
    enrolledAt: saved?.enrolled_at?.toISOString() ?? new Date().toISOString(),
    photoUrl: saved?.photo_url ?? photoUrl,
  };
}

export async function clearMyFaceEnrollment(
  ctx: HrServiceContext,
): Promise<{ cleared: true }> {
  assertHrPermission(ctx, HR_PERMISSIONS.attendanceSelf);
  const employee = await resolveSelfEmployee(ctx);
  await prisma.$executeRaw`
    DELETE FROM hr.employee_face_enrollments
    WHERE organization_id = ${ctx.organizationId}::uuid
      AND employee_id = ${employee.id}::uuid
  `.catch(() => undefined);
  await deleteFaceEnrollmentPhoto({
    organizationId: ctx.organizationId,
    employeeId: employee.id,
  });
  return { cleared: true };
}

/**
 * Enforce org face policy for clock-in/out.
 * OFF → no-op; WARN → allow with warning; REQUIRE → throw on failure.
 */
export async function assertFaceMatchForClock(
  ctx: HrServiceContext,
  employeeId: string,
  faceDescriptorRaw: unknown,
): Promise<FaceClockCheckResult> {
  const settingsRow = await findSettingsRow(ctx.organizationId);
  const settings = settingsRow
    ? toSettingsRow(settingsRow)
    : defaultSettings(ctx.organizationId);

  if (settings.mode === "OFF") {
    return {
      mode: "OFF",
      matched: null,
      distance: null,
      warning: null,
    };
  }

  const descriptor = parseFaceDescriptor(faceDescriptorRaw);
  const enrollment = await findEnrollmentDescriptor(
    ctx.organizationId,
    employeeId,
  );

  const fail = (message: string): FaceClockCheckResult => {
    if (settings.mode === "REQUIRE") {
      throw new HrError("FORBIDDEN", {
        message,
        details: { code: "FACE_MATCH_FAILED", mode: settings.mode },
      });
    }
    return {
      mode: settings.mode,
      matched: false,
      distance: null,
      warning: message,
    };
  };

  if (!enrollment) {
    return fail(
      "ยังไม่ได้ลงทะเบียนใบหน้า — ไปที่ «ลงทะเบียนใบหน้า» ก่อนลงเวลา",
    );
  }
  if (!descriptor) {
    return fail(
      "ตรวจใบหน้าไม่สำเร็จ — ถ่ายรูปให้เห็นใบหน้าชัดเจนแล้วลองใหม่",
    );
  }

  const enrolled = parseFaceDescriptor(enrollment.descriptor);
  if (!enrolled) {
    return fail("ข้อมูลใบหน้าที่ลงทะเบียนไว้ไม่ถูกต้อง — ลงทะเบียนใหม่");
  }

  const distance = euclideanDistance(enrolled, descriptor);
  const matched = isFaceMatch(distance, settings.matchThreshold);
  if (!matched) {
    return fail(
      `ใบหน้าไม่ตรงกับที่ลงทะเบียน (ระยะ ${distance.toFixed(3)} > ${settings.matchThreshold})`,
    );
  }

  return {
    mode: settings.mode,
    matched: true,
    distance,
    warning: null,
  };
}
