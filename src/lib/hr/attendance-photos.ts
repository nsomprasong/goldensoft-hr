/**
 * Punch evidence photos — filesystem helpers for clock-in/out (Phase 2 / 1C).
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

export function attendanceEventPhotoPublicPath(eventId: string): string {
  return `/api/hr/attendance/events/${eventId}/photo`;
}

function storageRoot(): string {
  return path.join(process.cwd(), "storage", "attendance-photos");
}

function photoFilePath(organizationId: string, eventId: string): string {
  return path.join(storageRoot(), organizationId, `${eventId}.img`);
}

function metaFilePath(organizationId: string, eventId: string): string {
  return path.join(storageRoot(), organizationId, `${eventId}.meta.json`);
}

/** Decode `data:image/...;base64,...` or raw base64. */
export function decodePhotoBase64(raw: unknown): Buffer | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const trimmed = raw.trim();
  const dataUrl = /^data:([^;]+);base64,(.+)$/s.exec(trimmed);
  try {
    if (dataUrl) return Buffer.from(dataUrl[2]!, "base64");
    return Buffer.from(trimmed.replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }
}

export async function saveAttendancePhoto(input: {
  organizationId: string;
  eventId: string;
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
  await writeFile(photoFilePath(input.organizationId, input.eventId), input.buffer);
  await writeFile(
    metaFilePath(input.organizationId, input.eventId),
    JSON.stringify({
      contentType,
      bytes: input.buffer.length,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
      updatedAt: new Date().toISOString(),
    }),
  );

  return {
    photoUrl: attendanceEventPhotoPublicPath(input.eventId),
    bytes: input.buffer.length,
    contentType,
  };
}

export async function readAttendancePhoto(input: {
  organizationId: string;
  eventId: string;
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const buffer = await readFile(
      photoFilePath(input.organizationId, input.eventId),
    );
    let contentType = sniffImageMime(buffer) ?? "application/octet-stream";
    try {
      const meta = JSON.parse(
        await readFile(metaFilePath(input.organizationId, input.eventId), "utf8"),
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

export async function deleteAttendancePhoto(input: {
  organizationId: string;
  eventId: string;
}): Promise<void> {
  await Promise.allSettled([
    unlink(photoFilePath(input.organizationId, input.eventId)),
    unlink(metaFilePath(input.organizationId, input.eventId)),
  ]);
}
