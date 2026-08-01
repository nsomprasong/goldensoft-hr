/**
 * Filesystem helpers for employee supporting documents.
 * Do not import from Client Components (uses node:fs).
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export {
  documentCategoryLabel,
  EMPLOYEE_DOCUMENT_CATEGORIES,
  type EmployeeDocumentCategory,
} from "@/lib/hr/employee-document-types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function storageRoot(): string {
  return path.join(process.cwd(), "storage", "employee-documents");
}

export function documentPublicPath(
  employeeId: string,
  documentId: string,
): string {
  return `/api/hr/employees/${employeeId}/documents/${documentId}`;
}

function filePath(organizationId: string, storageKey: string): string {
  return path.join(storageRoot(), organizationId, storageKey);
}

export function sniffDocumentMime(
  buffer: Buffer,
  declared?: string | null,
): string | null {
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") {
    return "application/pdf";
  }
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
  if (declared && ALLOWED.has(declared)) return declared;
  return null;
}

export async function saveEmployeeDocumentFile(input: {
  organizationId: string;
  employeeId: string;
  buffer: Buffer;
  originalName: string;
  contentType?: string | null;
}): Promise<{
  storageKey: string;
  contentType: string;
  byteSize: number;
  fileName: string;
}> {
  if (input.buffer.length === 0) throw new Error("EMPTY_DOCUMENT");
  if (input.buffer.length > MAX_BYTES) throw new Error("DOCUMENT_TOO_LARGE");

  const contentType = sniffDocumentMime(input.buffer, input.contentType);
  if (!contentType || !ALLOWED.has(contentType)) {
    throw new Error("UNSUPPORTED_DOCUMENT_TYPE");
  }

  const ext =
    contentType === "application/pdf"
      ? ".pdf"
      : contentType === "image/png"
        ? ".png"
        : contentType === "image/webp"
          ? ".webp"
          : contentType.includes("word")
            ? ".docx"
            : ".jpg";

  const storageKey = path.join(input.employeeId, `${randomUUID()}${ext}`);
  const dir = path.join(storageRoot(), input.organizationId, input.employeeId);
  await mkdir(dir, { recursive: true });
  const abs = filePath(input.organizationId, storageKey);
  await writeFile(abs, input.buffer);
  await writeFile(
    `${abs}.meta.json`,
    JSON.stringify({
      contentType,
      bytes: input.buffer.length,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
      originalName: input.originalName,
      updatedAt: new Date().toISOString(),
    }),
  );

  return {
    storageKey: storageKey.replace(/\\/g, "/"),
    contentType,
    byteSize: input.buffer.length,
    fileName: input.originalName.trim() || `document${ext}`,
  };
}

export async function readEmployeeDocumentFile(input: {
  organizationId: string;
  storageKey: string;
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const abs = filePath(input.organizationId, input.storageKey);
    const buffer = await readFile(abs);
    let contentType =
      sniffDocumentMime(buffer) ?? "application/octet-stream";
    try {
      const meta = JSON.parse(await readFile(`${abs}.meta.json`, "utf8")) as {
        contentType?: string;
      };
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

export async function deleteEmployeeDocumentFile(input: {
  organizationId: string;
  storageKey: string;
}): Promise<void> {
  const abs = filePath(input.organizationId, input.storageKey);
  await Promise.allSettled([unlink(abs), unlink(`${abs}.meta.json`)]);
}
