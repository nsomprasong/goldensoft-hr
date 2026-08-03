"use client";

import { useEffect, useState } from "react";

import { IconViewCards, IconViewRows } from "@/components/ui/icons";

export type SettingsViewMode = "cards" | "rows";

export function useSettingsViewMode(
  storageKey: string,
  fallback: SettingsViewMode = "cards",
): [SettingsViewMode, (mode: SettingsViewMode) => void] {
  const [viewMode, setViewMode] = useState<SettingsViewMode>(fallback);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "cards" || saved === "rows") setViewMode(saved);
    } catch {
      // ignore
    }
  }, [storageKey]);

  function changeViewMode(mode: SettingsViewMode) {
    setViewMode(mode);
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // ignore
    }
  }

  return [viewMode, changeViewMode];
}

export default function HrSettingsViewToggle({
  viewMode,
  onChange,
  count,
  label = "การแสดงผล",
}: {
  viewMode: SettingsViewMode;
  onChange: (mode: SettingsViewMode) => void;
  count?: number;
  label?: string;
}) {
  return (
    <div className="hr-settings-view-bar">
      <p className="hr-settings-view-label">
        {label}
        {typeof count === "number" ? (
          <span>
            {" "}
            · {count} รายการ
          </span>
        ) : null}
      </p>
      <div className="hr-view-toggle" role="group" aria-label="รูปแบบการแสดงผล">
        <button
          type="button"
          className={
            viewMode === "cards" ? "btn btn-sm btn-primary" : "btn btn-sm"
          }
          aria-pressed={viewMode === "cards"}
          onClick={() => onChange("cards")}
        >
          <span className="btn-icon" aria-hidden="true">
            <IconViewCards size={15} />
          </span>
          <span className="btn-label">การ์ด</span>
        </button>
        <button
          type="button"
          className={
            viewMode === "rows" ? "btn btn-sm btn-primary" : "btn btn-sm"
          }
          aria-pressed={viewMode === "rows"}
          onClick={() => onChange("rows")}
        >
          <span className="btn-icon" aria-hidden="true">
            <IconViewRows size={15} />
          </span>
          <span className="btn-label">แถว</span>
        </button>
      </div>
    </div>
  );
}
