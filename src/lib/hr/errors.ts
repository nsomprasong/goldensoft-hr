/**
 * HR domain errors.
 *
 * Every failure surfaced to a Thai-speaking operator carries a stable machine
 * code plus a localized message. Codes are the contract; messages may change.
 */

export const HR_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "TENANT_CONTEXT_REQUIRED",
  "PRODUCT_NOT_ENTITLED",
  "SUBSCRIPTION_INACTIVE",
  "VALIDATION_ERROR",
  "DUPLICATE_CODE",
  "DUPLICATE_PLATFORM_USER",
  "DUPLICATE_AUTH_USER",
  "DUPLICATE_PERIOD",
  "NOT_FOUND",
  "INACTIVE_MASTER",
  "INACTIVE_ENTITY",
  "CROSS_ORG_LINK",
  "OVERLAP_COMPENSATION",
  "NEGATIVE_AMOUNT",
  "INVALID_SHIFT",
  "INVALID_STATUS_TRANSITION",
  "BRANCH_OUT_OF_SCOPE",
  "PERIOD_LOCKED",
  "LIMIT_EXCEEDED",
  "INTERNAL_ERROR",
] as const;

export type HrErrorCode = (typeof HR_ERROR_CODES)[number];

const THAI_MESSAGES: Record<HrErrorCode, string> = {
  UNAUTHENTICATED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
  FORBIDDEN: "คุณไม่มีสิทธิ์ดำเนินการนี้",
  TENANT_CONTEXT_REQUIRED: "กรุณาเลือกองค์กรก่อนใช้งาน HR",
  PRODUCT_NOT_ENTITLED: "องค์กรนี้ยังไม่มีสิทธิ์ใช้งาน GoldenSoft HR",
  SUBSCRIPTION_INACTIVE: "การสมัครใช้บริการ HR ไม่พร้อมใช้งาน",
  VALIDATION_ERROR: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  DUPLICATE_CODE: "รหัสนี้ถูกใช้งานแล้วในองค์กรนี้",
  DUPLICATE_PLATFORM_USER: "บัญชีผู้ใช้นี้ถูกเชื่อมกับพนักงานคนอื่นแล้ว",
  DUPLICATE_AUTH_USER: "บัญชีเข้าใช้งานนี้ถูกเชื่อมกับพนักงานที่ยังปฏิบัติงานอยู่แล้ว",
  DUPLICATE_PERIOD: "มีงวดจ่ายเงินเดือนช่วงวันที่นี้อยู่แล้ว",
  NOT_FOUND: "ไม่พบข้อมูลที่ต้องการ",
  INACTIVE_MASTER: "ข้อมูลหลักที่เลือกถูกปิดการใช้งานแล้ว",
  INACTIVE_ENTITY: "รายการนี้ถูกปิดการใช้งานแล้ว",
  CROSS_ORG_LINK: "ไม่สามารถเชื่อมข้อมูลข้ามองค์กรได้",
  OVERLAP_COMPENSATION: "ช่วงเวลาค่าจ้างซ้อนทับกับรายการที่มีอยู่",
  NEGATIVE_AMOUNT: "จำนวนเงินต้องไม่ติดลบ",
  INVALID_SHIFT: "ข้อมูลกะการทำงานไม่ถูกต้อง",
  INVALID_STATUS_TRANSITION: "ไม่สามารถเปลี่ยนสถานะไปยังสถานะที่เลือกได้",
  BRANCH_OUT_OF_SCOPE: "สาขานี้อยู่นอกขอบเขตที่คุณได้รับอนุญาต",
  PERIOD_LOCKED: "งวดจ่ายเงินเดือนถูกล็อกแล้ว ไม่สามารถแก้ไขได้",
  LIMIT_EXCEEDED: "เกินจำนวนสูงสุดที่แพ็กเกจอนุญาต",
  INTERNAL_ERROR: "เกิดข้อผิดพลาดภายในระบบ",
};

const HTTP_STATUS: Partial<Record<HrErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  TENANT_CONTEXT_REQUIRED: 403,
  PRODUCT_NOT_ENTITLED: 403,
  SUBSCRIPTION_INACTIVE: 403,
  BRANCH_OUT_OF_SCOPE: 403,
  CROSS_ORG_LINK: 403,
  NOT_FOUND: 404,
  DUPLICATE_CODE: 409,
  DUPLICATE_PLATFORM_USER: 409,
  DUPLICATE_AUTH_USER: 409,
  DUPLICATE_PERIOD: 409,
  OVERLAP_COMPENSATION: 409,
  INVALID_STATUS_TRANSITION: 409,
  PERIOD_LOCKED: 409,
  LIMIT_EXCEEDED: 409,
  INTERNAL_ERROR: 500,
};

export function hrThaiMessage(code: HrErrorCode): string {
  return THAI_MESSAGES[code] ?? THAI_MESSAGES.INTERNAL_ERROR;
}

export function hrHttpStatus(code: HrErrorCode): number {
  return HTTP_STATUS[code] ?? 400;
}

export type HrErrorDetails = Record<string, unknown>;

export class HrError extends Error {
  readonly code: HrErrorCode;
  readonly httpStatus: number;
  readonly details?: HrErrorDetails;

  constructor(
    code: HrErrorCode,
    options?: { message?: string; httpStatus?: number; details?: HrErrorDetails },
  ) {
    super(options?.message ?? hrThaiMessage(code));
    this.name = "HrError";
    this.code = code;
    this.httpStatus = options?.httpStatus ?? hrHttpStatus(code);
    this.details = options?.details;
  }

  toJSON(): { code: HrErrorCode; message: string; details?: HrErrorDetails } {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

export function isHrError(value: unknown): value is HrError {
  return value instanceof HrError;
}

/** Throw a validation error with an optional field hint. */
export function hrValidationError(
  message: string,
  details?: HrErrorDetails,
): HrError {
  return new HrError("VALIDATION_ERROR", { message, details });
}
