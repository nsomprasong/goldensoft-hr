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

export function parseFaceDescriptor(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== FACE_DESCRIPTOR_LENGTH) return null;
  const out: number[] = [];
  for (const item of raw) {
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
