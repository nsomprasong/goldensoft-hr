"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import HrSettingsViewToggle, {
  useSettingsViewMode,
} from "@/components/hr/hr-settings-view-toggle";
import OvertimeRuleForm, {
  type OvertimeRuleFormValues,
} from "@/components/hr/overtime-rule-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrButton from "@/components/ui/hr-button";
import type { OvertimeRuleRow } from "@/lib/hr/data";
import { formatThaiDate } from "@/lib/hr/thai-date";

const BASE = "/hr/settings/overtime-rules";

export default function OvertimeRulesWorkspace({
  rules,
  rateTypes,
  editing,
  available,
  canManage,
}: {
  rules: OvertimeRuleRow[];
  rateTypes: Array<{ id: string; label: string }>;
  editing: OvertimeRuleRow | null;
  available: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useSettingsViewMode(
    "hr.settings.overtime.viewMode",
  );

  const open = creating || editing != null;
  const mode = editing ? "edit" : "create";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function closeOverlay() {
    setCreating(false);
    if (editing) router.push(BASE);
  }

  function openCreate() {
    setCreating(true);
    if (editing) router.push(BASE);
  }

  function handleDone() {
    setCreating(false);
    router.push(BASE);
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setCreating(false);
      if (editing) router.push(BASE);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing, router]);

  const editInitial: Partial<OvertimeRuleFormValues> | undefined = editing
    ? {
        code: editing.code,
        name: editing.name,
        rateTypeId: editing.rateTypeId,
        multiplier: String(editing.multiplier),
        fixedAmount:
          editing.fixedAmount === null ? "" : String(editing.fixedAmount),
        effectiveFrom: editing.effectiveFrom,
        effectiveTo: editing.effectiveTo ?? "",
      }
    : undefined;

  function renderActions(row: OvertimeRuleRow) {
    if (!canManage) return null;
    return (
      <div className="hr-settings-item-actions">
        <Link
          className="btn btn-sm"
          href={`${BASE}?edit=${row.id}`}
          onClick={() => setCreating(false)}
        >
          แก้ไข
        </Link>
        <ToggleActiveButton
          resource="overtime-rules"
          id={row.id}
          isActive={row.isActive}
          disabled={!available}
        />
      </div>
    );
  }

  function fixedLabel(row: OvertimeRuleRow) {
    if (row.fixedAmount === null) return null;
    return row.fixedAmount.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function effectiveLabel(row: OvertimeRuleRow) {
    return `${formatThaiDate(row.effectiveFrom)}${
      row.effectiveTo
        ? ` – ${formatThaiDate(row.effectiveTo)}`
        : " เป็นต้นไป"
    }`;
  }

  return (
    <>
      {rules.length === 0 ? (
        <p className="empty">ยังไม่มีกฎ OT ในองค์กรนี้</p>
      ) : (
        <section className="hr-settings-panel">
          <HrSettingsViewToggle
            viewMode={viewMode}
            onChange={setViewMode}
            count={rules.length}
          />
          <div
            className={
              viewMode === "cards"
                ? "hr-settings-list hr-settings-list--cards"
                : "hr-settings-list"
            }
          >
            {rules.map((row) => {
              const fixed = fixedLabel(row);
              const meta = [
                row.rateTypeNameTh,
                `×${row.multiplier}`,
                fixed ? `${fixed} บาท` : null,
                effectiveLabel(row),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <article
                  key={row.id}
                  className={
                    row.isActive
                      ? "hr-settings-item"
                      : "hr-settings-item hr-settings-item--inactive"
                  }
                >
                  <div className="hr-settings-item-main">
                    <strong className="hr-settings-item-title">
                      {row.name}
                    </strong>
                    <span className="hr-settings-item-meta">{meta}</span>
                  </div>
                  <span
                    className={
                      row.isActive
                        ? "badge badge-active"
                        : "badge badge-inactive"
                    }
                  >
                    {row.isActive ? "ใช้งาน" : "ปิด"}
                  </span>
                  {renderActions(row)}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {canManage && !open ? (
        <button
          type="button"
          className="hr-fab"
          onClick={openCreate}
          disabled={!available}
          aria-label="เพิ่มกฎ OT"
          title="เพิ่มกฎ OT"
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}

      {canManage && open ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={closeOverlay}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head">
              <h2 id={titleId}>
                {mode === "create" ? "เพิ่มกฎ OT" : "แก้ไขกฎ OT"}
              </h2>
              <HrButton
                type="button"
                className="btn btn-sm"
                onClick={closeOverlay}
                aria-label="ปิด"
              >
                ปิด
              </HrButton>
            </div>
            <div className="hr-overlay-body">
              <OvertimeRuleForm
                key={editing?.id ?? "create"}
                mode={mode}
                overtimeRuleId={editing?.id}
                rateTypes={rateTypes}
                disabled={!available}
                initialValues={editInitial}
                embedded
                onDone={handleDone}
                onCancel={closeOverlay}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
