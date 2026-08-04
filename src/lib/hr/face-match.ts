/**
 * Pure face-descriptor math (no Node/browser APIs).
 * Descriptors are 128-d vectors from face-api faceRecognitionNet.
 */

export const FACE_DESCRIPTOR_LENGTH = 128;
export const FACE_DESCRIPTOR_VERSION = "face-api-128";
/** Default max Euclidean distance for a match (face-api FaceMatcher ≈ 0.6). */
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.55;

export type FaceMatchMode = "OFF" | "WARN" | "REQUIRE";

export function isFaceMatchMode(value: unknown): value is FaceMatchMode {
  return value === "OFF" || value === "WARN" || value === "REQUIRE";
}

/**
 * Accepts a 128-d array, JSON string of that array, or array-like object
 * (some drivers return JSONB as a plain object with numeric keys).
 */
export function parseFaceDescriptor(raw: unknown): number[] | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === FACE_DESCRIPTOR_LENGTH) {
      value = Array.from({ length: FACE_DESCRIPTOR_LENGTH }, (_, i) => obj[String(i)]);
    }
  }
  if (!Array.isArray(value) || value.length !== FACE_DESCRIPTOR_LENGTH) return null;
  const out: number[] = [];
  for (const item of value) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("DESCRIPTOR_LENGTH_MISMATCH");
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isFaceMatch(
  distance: number,
  threshold: number = DEFAULT_FACE_MATCH_THRESHOLD,
): boolean {
  return Number.isFinite(distance) && distance <= threshold;
}

export type FaceEnrollmentCandidate = {
  employeeId: string;
  /** Owning organization of the enrollment row (must already be org-scoped). */
  organizationId: string;
  descriptor: unknown;
  email?: string | null;
  phone?: string | null;
};

/**
 * Find another employee in the *same* organization whose enrolled face matches.
 * Candidates from other organizations are ignored even if passed in.
 * Returns null when no in-org duplicate exists.
 */
export function findDuplicateFaceInOrganization(input: {
  organizationId: string;
  exceptEmployeeId: string;
  descriptor: number[];
  threshold: number;
  candidates: FaceEnrollmentCandidate[];
}): { employeeId: string; distance: number } | null {
  const orgId = input.organizationId;
  for (const row of input.candidates) {
    if (row.organizationId !== orgId) continue;
    if (row.employeeId === input.exceptEmployeeId) continue;
    const other = parseFaceDescriptor(row.descriptor);
    if (!other) continue;
    const distance = euclideanDistance(other, input.descriptor);
    if (isFaceMatch(distance, input.threshold)) {
      return { employeeId: row.employeeId, distance };
    }
  }
  return null;
}
