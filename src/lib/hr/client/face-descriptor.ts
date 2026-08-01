/**
 * Browser-only face descriptor extraction via @vladmandic/face-api (CDN).
 * Safe for Client Components — no Node APIs.
 *
 * Mobile selfies are often 3000px+; TinyFaceDetector misses them unless we
 * downscale first and retry with looser options.
 */

import {
  FACE_DESCRIPTOR_LENGTH,
  parseFaceDescriptor,
} from "@/lib/hr/face-match";

const FACE_API_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const FACE_API_MODELS =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

/** Max edge before detection — large camera photos break TinyFaceDetector. */
const DETECT_MAX_EDGE = 720;

type FaceDetectionResult = {
  descriptor: Float32Array | number[];
};

type FaceApiGlobal = {
  tf?: {
    setBackend?: (name: string) => Promise<boolean> | boolean;
    ready?: () => Promise<void>;
    getBackend?: () => string;
  };
  nets: {
    tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (uri: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (uri: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (opts?: {
    inputSize?: number;
    scoreThreshold?: number;
  }) => unknown;
  detectSingleFace: (
    input: HTMLCanvasElement | HTMLImageElement,
    options?: unknown,
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptor: () => Promise<FaceDetectionResult | undefined>;
    };
  };
  detectAllFaces: (
    input: HTMLCanvasElement | HTMLImageElement,
    options?: unknown,
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptors: () => Promise<
        Array<{ descriptor: Float32Array | number[]; detection?: { score?: number } }>
      >;
    };
  };
};

declare global {
  interface Window {
    faceapi?: FaceApiGlobal;
  }
}

let loadPromise: Promise<FaceApiGlobal> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.faceapi) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-face-api="1"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error("โหลดโมเดลตรวจใบหน้าไม่สำเร็จ — ตรวจเน็ตแล้วลองใหม่"),
          ),
        { once: true },
      );
      // Script already finished before listeners attached
      if (window.faceapi) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.faceApi = "1";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("โหลดโมเดลตรวจใบหน้าไม่สำเร็จ — ตรวจเน็ตแล้วลองใหม่"));
    document.head.appendChild(script);
  });
}

async function ensureFaceApi(): Promise<FaceApiGlobal> {
  if (typeof window === "undefined") {
    throw new Error("ตรวจใบหน้าใช้ได้เฉพาะบนเบราว์เซอร์");
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      await loadScript(FACE_API_SCRIPT);
      const faceapi = window.faceapi;
      if (!faceapi) {
        throw new Error("โหลดไลบรารีตรวจใบหน้าไม่สำเร็จ");
      }
      // WebGL preferred; CPU fallback if WebGL unavailable.
      try {
        if (faceapi.tf?.setBackend) {
          await faceapi.tf.setBackend("webgl");
        }
      } catch {
        try {
          await faceapi.tf?.setBackend?.("cpu");
        } catch {
          // keep default
        }
      }
      await faceapi.tf?.ready?.();

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODELS),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_API_MODELS),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_API_MODELS),
      ]);
      return faceapi;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
    img.src = dataUrl;
  });
}

/** Downscale for detector — keeps aspect ratio. */
function toDetectCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(w, h, 1));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("ไม่สามารถเตรียมรูปสำหรับตรวจใบหน้าได้");
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

const DETECT_ATTEMPTS: { inputSize: number; scoreThreshold: number }[] = [
  { inputSize: 416, scoreThreshold: 0.3 },
  { inputSize: 512, scoreThreshold: 0.25 },
  { inputSize: 320, scoreThreshold: 0.2 },
  { inputSize: 608, scoreThreshold: 0.2 },
  { inputSize: 224, scoreThreshold: 0.15 },
];

async function detectDescriptor(
  faceapi: FaceApiGlobal,
  input: HTMLCanvasElement,
): Promise<number[] | null> {
  for (const opts of DETECT_ATTEMPTS) {
    const options = new faceapi.TinyFaceDetectorOptions(opts);

    // Prefer single-face path
    try {
      const single = await faceapi
        .detectSingleFace(input, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
      const parsed = parseFaceDescriptor(
        single?.descriptor ? Array.from(single.descriptor) : null,
      );
      if (parsed) return parsed;
    } catch {
      // try next / all-faces
    }

    // Fallback: pick highest-score face among all detections
    try {
      const all = await faceapi
        .detectAllFaces(input, options)
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (!Array.isArray(all) || all.length === 0) continue;
      const ranked = [...all].sort(
        (a, b) => (b.detection?.score ?? 0) - (a.detection?.score ?? 0),
      );
      for (const hit of ranked) {
        const parsed = parseFaceDescriptor(
          hit.descriptor ? Array.from(hit.descriptor) : null,
        );
        if (parsed) return parsed;
      }
    } catch {
      // try next options
    }
  }
  return null;
}

export type FaceDescriptorResult =
  | { ok: true; descriptor: number[] }
  | { ok: false; code: "NO_FACE" | "LOAD_FAILED" | "INVALID"; message: string };

/**
 * Extract a 128-d face descriptor from a data-URL image.
 */
export async function extractFaceDescriptor(
  photoDataUrl: string,
): Promise<FaceDescriptorResult> {
  try {
    const faceapi = await ensureFaceApi();
    const img = await loadImageFromDataUrl(photoDataUrl);
    if ((img.naturalWidth || img.width) < 48 || (img.naturalHeight || img.height) < 48) {
      return {
        ok: false,
        code: "NO_FACE",
        message: "รูปเล็กเกินไปสำหรับตรวจใบหน้า — ถ่ายใหม่ให้ชัดขึ้น",
      };
    }

    const canvas = toDetectCanvas(img);
    const descriptor = await detectDescriptor(faceapi, canvas);

    if (!descriptor || descriptor.length !== FACE_DESCRIPTOR_LENGTH) {
      return {
        ok: false,
        code: "NO_FACE",
        message:
          "ไม่พบใบหน้าในรูป — หันหน้าตรงกล้อง ในที่สว่าง ใบหน้าเต็มเฟรมประมาณครึ่งหนึ่ง แล้วถ่ายใหม่",
      };
    }
    return { ok: true, descriptor };
  } catch (err) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "ตรวจใบหน้าไม่สำเร็จ";
    return { ok: false, code: "LOAD_FAILED", message };
  }
}
