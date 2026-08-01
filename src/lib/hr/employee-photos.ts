/**
 * Filesystem photo helpers — safe for Next route handlers and CLI seed scripts.
 * Do not import from Client Components (uses node:fs).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function employeePhotoPublicPath(employeeId: string): string {
  return `/api/hr/employees/${employeeId}/photo`;
}

function storageRoot(): string {
  return path.join(process.cwd(), "storage", "employee-photos");
}

function photoFilePath(organizationId: string, employeeId: string): string {
  return path.join(storageRoot(), organizationId, `${employeeId}.img`);
}

function metaFilePath(organizationId: string, employeeId: string): string {
  return path.join(storageRoot(), organizationId, `${employeeId}.meta.json`);
}

export function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 6) === "GIF89a") {
    return "image/gif";
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 6) === "GIF87a") {
    return "image/gif";
  }
  return null;
}

export async function saveEmployeePhoto(input: {
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
  const filePath = photoFilePath(input.organizationId, input.employeeId);
  const metaPath = metaFilePath(input.organizationId, input.employeeId);
  await writeFile(filePath, input.buffer);
  await writeFile(
    metaPath,
    JSON.stringify({
      contentType,
      bytes: input.buffer.length,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
      updatedAt: new Date().toISOString(),
    }),
  );

  return {
    photoUrl: employeePhotoPublicPath(input.employeeId),
    bytes: input.buffer.length,
    contentType,
  };
}

export async function readEmployeePhoto(input: {
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
      if (
        meta.contentType &&
        (ALLOWED.has(meta.contentType) || meta.contentType === "image/svg+xml")
      ) {
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

export async function deleteEmployeePhoto(input: {
  organizationId: string;
  employeeId: string;
}): Promise<void> {
  await Promise.allSettled([
    unlink(photoFilePath(input.organizationId, input.employeeId)),
    unlink(metaFilePath(input.organizationId, input.employeeId)),
  ]);
}

/** Tiny SVG avatar for demo seed (stored as UTF-8 bytes with image/svg+xml meta). */
export function buildDemoAvatarSvg(label: string, hue: number): Buffer {
  const safe = label.slice(0, 2).replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hue},70%,55%)"/>
    <stop offset="100%" stop-color="hsl(${hue},70%,35%)"/>
  </linearGradient></defs>
  <circle cx="64" cy="64" r="64" fill="url(#g)"/>
  <text x="64" y="76" text-anchor="middle" font-family="Anuphan,Arial,sans-serif" font-size="42" font-weight="700" fill="#fff">${safe}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

export async function saveDemoAvatarSvg(input: {
  organizationId: string;
  employeeId: string;
  label: string;
  hue: number;
}): Promise<string> {
  const dir = path.join(storageRoot(), input.organizationId);
  await mkdir(dir, { recursive: true });
  const buffer = buildDemoAvatarSvg(input.label, input.hue);
  await writeFile(photoFilePath(input.organizationId, input.employeeId), buffer);
  await writeFile(
    metaFilePath(input.organizationId, input.employeeId),
    JSON.stringify({
      contentType: "image/svg+xml",
      bytes: buffer.length,
      demo: true,
      updatedAt: new Date().toISOString(),
    }),
  );
  return employeePhotoPublicPath(input.employeeId);
}
