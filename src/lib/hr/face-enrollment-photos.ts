/**
 * Filesystem storage for face enrollment reference photos.
 * Do not import from Client Components (uses node:fs).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { sniffImageMime } from "@/lib/hr/employee-photos";

const MAX_BYTES = 2.5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function faceEnrollmentPhotoPublicPath(_employeeId?: string): string {
  return `/api/hr/me/face/photo`;
}

function storageRoot(): string {
  return path.join(process.cwd(), "storage", "face-enrollments");
}

function photoFilePath(organizationId: string, employeeId: string): string {
  return path.join(storageRoot(), organizationId, `${employeeId}.img`);
}

function metaFilePath(organizationId: string, employeeId: string): string {
  return path.join(storageRoot(), organizationId, `${employeeId}.meta.json`);
}

export async function saveFaceEnrollmentPhoto(input: {
  organizationId: string;
  employeeId: string;
  buffer: Buffer;
  contentType?: string | null;
}): Promise<{ photoUrl: string; bytes: number; contentType: string }> {
  if (input.buffer.length === 0) {
    throw new Error("EMPTY_PHOTO");
  }
  if (input.buffer.length > MAX_BYTES) {
    throw new Error("PHOTO_TOO_LARGE");
  }
  const sniffed = sniffImageMime(input.buffer);
  const contentType = sniffed ?? input.contentType ?? "";
  if (!ALLOWED.has(contentType)) {
    throw new Error("UNSUPPORTED_PHOTO_TYPE");
  }

  const dir = path.join(storageRoot(), input.organizationId);
  await mkdir(dir, { recursive: true });
  await writeFile(photoFilePath(input.organizationId, input.employeeId), input.buffer);
  await writeFile(
    metaFilePath(input.organizationId, input.employeeId),
    JSON.stringify({
      contentType,
      bytes: input.buffer.length,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
      updatedAt: new Date().toISOString(),
    }),
  );

  return {
    photoUrl: faceEnrollmentPhotoPublicPath(input.employeeId),
    bytes: input.buffer.length,
    contentType,
  };
}

export async function readFaceEnrollmentPhoto(input: {
  organizationId: string;
  employeeId: string;
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const buffer = await readFile(
      photoFilePath(input.organizationId, input.employeeId),
    );
    let contentType = sniffImageMime(buffer) ?? "application/octet-stream";
    try {
      const meta = JSON.parse(
        await readFile(metaFilePath(input.organizationId, input.employeeId), "utf8"),
      ) as { contentType?: string };
      if (meta.contentType && ALLOWED.has(meta.contentType)) {
        contentType = meta.contentType;
      }
    } catch {
      // meta optional
    }
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function deleteFaceEnrollmentPhoto(input: {
  organizationId: string;
  employeeId: string;
}): Promise<void> {
  await Promise.allSettled([
    unlink(photoFilePath(input.organizationId, input.employeeId)),
    unlink(metaFilePath(input.organizationId, input.employeeId)),
  ]);
}
