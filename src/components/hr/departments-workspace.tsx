"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import DepartmentForm, {
  type DepartmentFormValues,
} from "@/components/hr/department-form";
import HrSettingsViewToggle, {
  useSettingsViewMode,
} from "@/components/hr/hr-settings-view-toggle";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrButton from "@/components/ui/hr-button";
import type { DepartmentRow } from "@/lib/hr/data";

const BASE = "/hr/settings/departments";

export default function DepartmentsWorkspace({
  departments,
  editing,
  available,
  canManage,
}: {
  departments: DepartmentRow[];
  editing: DepartmentRow | null;
  available: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useSettingsViewMode(
    "hr.settings.departments.viewMode",
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

  const editInitial: Partial<DepartmentFormValues> | undefined = editing
    ? {
        code: editing.code,
        nameTh: editing.nameTh,
        description: editing.description ?? "",
      }
    : undefined;

  function renderActions(row: DepartmentRow) {
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
          resource="departments"
          id={row.id}
          isActive={row.isActive}
          disabled={!available}
        />
      </div>
    );
  }

  return (
    <>
      {departments.length === 0 ? (
        <p className="empty">ยังไม่มีแผนกในองค์กรนี้</p>
      ) : (
        <section className="hr-settings-panel">
          <HrSettingsViewToggle
            viewMode={viewMode}
            onChange={setViewMode}
            count={departments.length}
          />
          <div
            className={
              viewMode === "cards"
                ? "hr-settings-list hr-settings-list--cards"
                : "hr-settings-list"
            }
          >
            {departments.map((row) => (
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
                    {row.nameTh}
                  </strong>
                  {row.description ? (
                    <span className="hr-settings-item-meta">
                      {row.description}
                    </span>
                  ) : null}
                </div>
                <span
                  className={
                    row.isActive ? "badge badge-active" : "badge badge-inactive"
                  }
                >
                  {row.isActive ? "ใช้งาน" : "ปิด"}
                </span>
                {renderActions(row)}
              </article>
            ))}
          </div>
        </section>
      )}

      {canManage && !open ? (
        <button
          type="button"
          className="hr-fab"
          onClick={openCreate}
          disabled={!available}
          aria-label="เพิ่มแผนก"
          title="เพิ่มแผนก"
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
                {mode === "create" ? "เพิ่มแผนก" : "แก้ไขแผนก"}
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
              <DepartmentForm
                key={editing?.id ?? "create"}
                mode={mode}
                departmentId={editing?.id}
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
