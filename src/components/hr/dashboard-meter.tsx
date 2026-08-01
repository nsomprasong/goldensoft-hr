/** Visual meter for quota / share percentages on the OWNER/ADMIN dashboard. */

export function parseLimitValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "—" || /^unlimit/i.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function meterTone(percent: number): "ok" | "warn" | "hot" {
  if (percent >= 90) return "hot";
  if (percent >= 75) return "warn";
  return "ok";
}

export function DashboardMeter({
  label,
  valueLabel,
  percent,
  tone,
}: {
  label?: string;
  valueLabel: string;
  percent: number;
  tone?: "ok" | "warn" | "hot" | "neutral";
}) {
  const width = clampPercent(percent);
  const resolvedTone = tone ?? meterTone(width);
  return (
    <div className="hr-dash-meter">
      {label ? (
        <div className="hr-dash-meter-row">
          <span className="hr-dash-meter-label">{label}</span>
          <span className="hr-dash-meter-value">{valueLabel}</span>
        </div>
      ) : (
        <div className="hr-dash-meter-row hr-dash-meter-row--end">
          <span className="hr-dash-meter-value">{valueLabel}</span>
        </div>
      )}
      <div
        className="hr-dash-meter-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-label={label ?? valueLabel}
      >
        <span
          className={`hr-dash-meter-fill hr-dash-meter-fill--${resolvedTone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
