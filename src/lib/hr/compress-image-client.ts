/**
 * Browser-side image shrink for camera uploads (attendance / employee photos).
 * Safe for Client Components — no Node APIs.
 */

export const ATTENDANCE_PHOTO_MAX_BYTES = Math.floor(2.5 * 1024 * 1024);

export type CompressedImage = {
  /** `data:image/jpeg;base64,…` for API payloads */
  dataUrl: string;
  /** Object URL for `<img src>` preview (caller must revoke) */
  previewUrl: string;
  byteSize: number;
  file: File;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านรูปไม่สำเร็จ"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("แปลงรูปไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscale + JPEG-encode until the binary size is ≤ maxBytes.
 * Already-small images are returned as JPEG only when needed.
 */
export async function compressImageForUpload(
  file: File,
  options?: { maxBytes?: number; maxEdge?: number },
): Promise<CompressedImage> {
  const maxBytes = options?.maxBytes ?? ATTENDANCE_PHOTO_MAX_BYTES;
  const maxEdgeStart = options?.maxEdge ?? 1600;

  if (!file.type.startsWith("image/")) {
    throw new Error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
  }

  if (file.size <= maxBytes && file.type === "image/jpeg") {
    const dataUrl = await blobToDataUrl(file);
    return {
      dataUrl,
      previewUrl: URL.createObjectURL(file),
      byteSize: file.size,
      file,
    };
  }

  if (file.size <= maxBytes) {
    const dataUrl = await blobToDataUrl(file);
    return {
      dataUrl,
      previewUrl: URL.createObjectURL(file),
      byteSize: file.size,
      file,
    };
  }

  const image = await loadImage(file);
  const edges = [maxEdgeStart, 1280, 1024, 800, 640];
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];

  let best: Blob | null = null;

  for (const edge of edges) {
    const scale = Math.min(1, edge / Math.max(image.width, image.height, 1));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ไม่สามารถย่อขนาดรูปได้");
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!blob) continue;
      best = blob;
      if (blob.size <= maxBytes) {
        const compressed = new File([blob], "attendance.jpg", {
          type: "image/jpeg",
        });
        return {
          dataUrl: await blobToDataUrl(blob),
          previewUrl: URL.createObjectURL(blob),
          byteSize: blob.size,
          file: compressed,
        };
      }
    }
  }

  if (!best || best.size > maxBytes) {
    throw new Error("ย่อขนาดรูปไม่สำเร็จ — ลองถ่ายใหม่ในโหมดความละเอียดต่ำกว่า");
  }

  const compressed = new File([best], "attendance.jpg", {
    type: "image/jpeg",
  });
  return {
    dataUrl: await blobToDataUrl(best),
    previewUrl: URL.createObjectURL(best),
    byteSize: best.size,
    file: compressed,
  };
}
