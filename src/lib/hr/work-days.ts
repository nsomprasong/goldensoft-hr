/** Work-day codes: 0=Sun … 6=Sat (aligned with JS `Date#getUTCDay`). */

export const WORK_DAY_OPTIONS = [
  { value: 1, label: "จันทร์" },
  { value: 2, label: "อังคาร" },
  { value: 3, label: "พุธ" },
  { value: 4, label: "พฤหัส" },
  { value: 5, label: "ศุกร์" },
  { value: 6, label: "เสาร์" },
  { value: 0, label: "อาทิตย์" },
] as const;

export function formatWorkDays(workDays: number[]): string {
  if (!workDays.length) return "—";
  const labels = WORK_DAY_OPTIONS.filter((d) => workDays.includes(d.value)).map(
    (d) => d.label,
  );
  return labels.length ? labels.join(" · ") : "—";
}
