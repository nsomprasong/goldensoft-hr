"use client";

/** Shared client helpers for HR forms: real fetch + Thai feedback. */

export type FieldErrors = Record<string, string>;

export type HrSubmitResult = {
  ok: boolean;
  message: string;
  fieldErrors: FieldErrors;
  data: unknown;
};

const DEFAULT_ERROR_BY_STATUS: Record<number, string> = {
  400: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  401: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
  403: "คุณไม่มีสิทธิ์ดำเนินการนี้",
  404: "ไม่พบข้อมูลที่ต้องการ",
  409: "ข้อมูลซ้ำกับที่มีอยู่แล้ว",
  422: "ข้อมูลไม่ผ่านการตรวจสอบ",
  500: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์ กรุณาลองใหม่",
  503: "ระบบไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่",
};

/** The HR API answers with `{ error: { code, message, details } }`. */
function errorBody(body: unknown): {
  code?: string;
  message?: string;
  details?: { issues?: unknown; fieldErrors?: unknown };
} | null {
  if (!body || typeof body !== "object") return null;
  const wrapper = (body as { error?: unknown }).error;
  const candidate = wrapper && typeof wrapper === "object" ? wrapper : body;
  return candidate as {
    code?: string;
    message?: string;
    details?: { issues?: unknown; fieldErrors?: unknown };
  };
}

function extractFieldErrors(body: unknown): FieldErrors {
  const error = errorBody(body);
  if (!error) return {};

  const out: FieldErrors = {};
  const details = error.details ?? {};

  const flat = (details as { fieldErrors?: unknown }).fieldErrors;
  if (flat && typeof flat === "object") {
    for (const [key, value] of Object.entries(flat as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
      else if (Array.isArray(value) && typeof value[0] === "string") {
        out[key] = value[0];
      }
    }
  }

  // Zod issues arrive as [{ path: "field.child", message: "..." }].
  const issues = (details as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (!issue || typeof issue !== "object") continue;
      const { path, message } = issue as { path?: unknown; message?: unknown };
      if (typeof message !== "string") continue;
      const key = Array.isArray(path) ? String(path[0] ?? "") : String(path ?? "");
      const field = key.split(".")[0];
      if (field) out[field] = message;
    }
  }

  return out;
}

/** POST/PATCH JSON to an HR API route and normalise the response for the UI. */
export async function submitHrJson(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  successMessage = "บันทึกข้อมูลเรียบร้อยแล้ว",
): Promise<HrSubmitResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return {
      ok: false,
      message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต",
      fieldErrors: {},
      data: null,
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const messageFromBody = errorBody(payload)?.message;

  if (!response.ok) {
    return {
      ok: false,
      message:
        typeof messageFromBody === "string" && messageFromBody
          ? messageFromBody
          : (DEFAULT_ERROR_BY_STATUS[response.status] ??
            "ดำเนินการไม่สำเร็จ กรุณาลองใหม่"),
      fieldErrors: extractFieldErrors(payload),
      data: payload,
    };
  }

  return {
    ok: true,
    message:
      typeof messageFromBody === "string" && messageFromBody
        ? messageFromBody
        : successMessage,
    fieldErrors: {},
    data: payload,
  };
}

// ── Client-side validation (Thai messages) ────────────────────────────────

export const REQUIRED_MESSAGE = "กรุณากรอกข้อมูลนี้";

export function requireText(value: string, message = REQUIRED_MESSAGE) {
  return value.trim() ? null : message;
}

export function requireSelect(value: string): string | null {
  return value.trim() ? null : "กรุณาเลือกข้อมูล";
}

/** Mirrors the server rule: digits, spaces and + - ( ), 6–20 characters. */
export function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return REQUIRED_MESSAGE;
  return /^[0-9+\-() ]{6,20}$/.test(trimmed)
    ? null
    : "เบอร์โทรต้องเป็นตัวเลข 6–20 ตัว (ใช้ + - ( ) ได้)";
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? null
    : "รูปแบบอีเมลไม่ถูกต้อง";
}

/** Mirrors normalizeCode on the server (uppercased, 1–50 chars). */
export function validateCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  if (!code) return REQUIRED_MESSAGE;
  if (!/^[A-Z0-9][A-Z0-9_.-]{0,49}$/.test(code)) {
    return "รหัสต้องเป็นตัวอักษรอังกฤษ ตัวเลข หรือ _ . - ความยาว 1–50 ตัว";
  }
  return null;
}

export function validateDate(value: string, required = false): string | null {
  if (!value) return required ? "กรุณาเลือกวันที่" : null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : "รูปแบบวันที่ไม่ถูกต้อง";
}

export function validatePositiveNumber(
  value: string,
  { required = true, allowZero = true } = {},
): string | null {
  if (!value.trim()) return required ? REQUIRED_MESSAGE : null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "กรุณากรอกตัวเลข";
  if (parsed < 0) return "ต้องไม่ติดลบ";
  if (!allowZero && parsed === 0) return "ต้องมากกว่า 0";
  return null;
}

export function validateTime(value: string): string | null {
  if (!value) return "กรุณาระบุเวลา";
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value.trim())
    ? null
    : "รูปแบบเวลาไม่ถูกต้อง (HH:MM)";
}

/** Normalize browser time inputs (sometimes HH:mm:ss) to HH:mm. */
export function normalizeTime(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{2}:\d{2})(?::\d{2})?$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

export function validateUuid(value: string, required = true): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? REQUIRED_MESSAGE : null;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    trimmed,
  )
    ? null
    : "รูปแบบ UUID ไม่ถูกต้อง";
}

export function firstError(errors: FieldErrors): string | null {
  const keys = Object.keys(errors);
  return keys.length ? errors[keys[0]] : null;
}

export function compact(errors: FieldErrors): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    if (value) out[key] = value;
  }
  return out;
}
