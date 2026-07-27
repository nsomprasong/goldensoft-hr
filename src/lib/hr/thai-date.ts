/**
 * Thai Buddhist-era date display (พ.ศ.).
 *
 * Storage / API stay on ISO `YYYY-MM-DD`.
 * User-facing copy and date fields use `DD/MM/BBBB`, e.g. 18/06/2569.
 */

export type DateLike = string | Date | null | undefined;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidParts(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Parse a calendar date without shifting across timezones. */
export function parseDateParts(
  value: DateLike,
): { year: number; month: number; day: number } | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const day = value.getUTCDate();
    return isValidParts(year, month, day) ? { year, month, day } : null;
  }

  const trimmed = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return isValidParts(year, month, day) ? { year, month, day } : null;
  }

  const thai = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (thai) {
    const day = Number(thai[1]);
    const month = Number(thai[2]);
    let year = Number(thai[3]);
    if (year > 2400) year -= 543;
    return isValidParts(year, month, day) ? { year, month, day } : null;
  }

  return null;
}

/** `YYYY-MM-DD` for storage / API — empty/invalid → `""`. */
export function toIsoDate(value: DateLike): string {
  const parts = parseDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** `18/06/2569` — empty/invalid → fallback (default "—"). */
export function formatThaiDate(
  value: DateLike,
  fallback = "—",
): string {
  const parts = parseDateParts(value);
  if (!parts) return fallback;
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year + 543}`;
}

/** `01/06/2569 – 30/06/2569` */
export function formatThaiDateRange(
  start: DateLike,
  end: DateLike,
  fallback = "—",
): string {
  const a = formatThaiDate(start, "");
  const b = formatThaiDate(end, "");
  if (!a && !b) return fallback;
  if (!a) return b;
  if (!b) return a;
  return `${a} – ${b}`;
}
