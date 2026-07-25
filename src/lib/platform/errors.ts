import type { PlatformErrorCode } from "@/lib/platform/types";

export class PlatformIntegrationError extends Error {
  readonly code: PlatformErrorCode;
  readonly httpStatus: number;

  constructor(code: PlatformErrorCode, message?: string, httpStatus?: number) {
    super(message ?? thaiMessageForCode(code));
    this.name = "PlatformIntegrationError";
    this.code = code;
    this.httpStatus = httpStatus ?? defaultStatusForCode(code);
  }
}

export function thaiMessageForCode(code: PlatformErrorCode): string {
  switch (code) {
    case "UNAUTHENTICATED":
      return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    case "FORBIDDEN":
      return "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้";
    case "TENANT_CONTEXT_REQUIRED":
      return "กรุณาเลือกองค์กรก่อนใช้งาน HR";
    case "PRODUCT_NOT_ENTITLED":
      return "องค์กรนี้ยังไม่มีสิทธิ์ใช้งาน GoldenSoft HR";
    case "SUBSCRIPTION_INACTIVE":
      return "การสมัครใช้บริการ HR ไม่พร้อมใช้งาน";
    case "BRANCH_OUT_OF_SCOPE":
      return "สาขานี้อยู่นอกขอบเขตที่คุณได้รับอนุญาต";
    case "CLIENT_ORG_MISMATCH":
      return "ข้อมูลองค์กรไม่ตรงกับบริบทที่ตรวจสอบแล้ว";
    case "INVALID_BODY":
      return "ข้อมูลไม่ถูกต้อง";
    case "PROFILE_NOT_FOUND":
      return "ไม่พบโปรไฟล์ผู้ใช้บนแพลตฟอร์ม";
    case "PROFILE_SUSPENDED":
      return "บัญชีถูกระงับการใช้งาน";
    case "PLATFORM_UNAVAILABLE":
      return "เชื่อมต่อแพลตฟอร์มไม่สำเร็จ กรุณาลองใหม่";
    default:
      return "เกิดข้อผิดพลาด";
  }
}

function defaultStatusForCode(code: PlatformErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "INVALID_BODY":
      return 400;
    case "PLATFORM_UNAVAILABLE":
      return 503;
    default:
      return 403;
  }
}

export function isInactiveSubscriptionStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const code = status.toUpperCase();
  return (
    code === "CANCELLED" ||
    code === "EXPIRED" ||
    code === "SUSPENDED" ||
    code === "INACTIVE"
  );
}
