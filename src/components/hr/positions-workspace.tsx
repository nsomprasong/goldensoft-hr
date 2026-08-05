"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import HrSettingsViewToggle, {
  useSettingsViewMode,
} from "@/components/hr/hr-settings-view-toggle";
import PositionForm, {
  type PositionFormValues,
} from "@/components/hr/position-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import HrButton from "@/components/ui/hr-button";
import type { PositionRow } from "@/lib/hr/data";

const BASE = "/hr/settings/positions";

export default function PositionsWorkspace({
  positions,
  departments,
  roles,
  editing,
  available,
  canManage,
}: {
  positions: PositionRow[];
  departments: Array<{ id: string; label: string }>;
  roles: Array<{ id: string; name: string; description: string | null; typeLabel: string; permissionCount: number }>;
  editing: PositionRow | null;
  available: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [viewMode, setViewMode] = useSettingsViewMode(
    "hr.settings.positions.viewMode",
  );

  const open = creating || editing != null;
  const mode = editing ? "edit" : "create";
  const visiblePositions = positions.filter((row) => {
    if (filter === "STANDARD") return row.isSystemStandard;
    if (filter === "ORGANIZATION") return !row.isSystemStandard && !row.branchId;
    if (filter === "BRANCH") return Boolean(row.branchId);
    if (filter === "WITH_ROLE") return Boolean(row.defaultRoleId);
    if (filter === "WITHOUT_ROLE") return !row.defaultRoleId;
    return true;
  });

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

  const editInitial: Partial<PositionFormValues> | undefined = editing
    ? {
        code: editing.code,
        nameTh: editing.nameTh,
        departmentId: editing.departmentId ?? "",
        description: editing.description ?? "",
        scope: editing.branchId ? "BRANCH" : "ORGANIZATION",
        defaultRoleId: editing.defaultRoleId ?? "",
      }
    : undefined;

  function renderActions(row: PositionRow) {
    if (!canManage || row.isSystemStandard) return null;
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
          resource="positions"
          id={row.id}
          isActive={row.isActive}
          disabled={!available}
        />
      </div>
    );
  }

  return (
    <>
      {positions.length === 0 ? (
        <p className="empty">ยังไม่มีตำแหน่งในองค์กรนี้</p>
      ) : (
        <section className="hr-settings-panel">
          <HrSettingsViewToggle
            viewMode={viewMode}
            onChange={setViewMode}
            count={positions.length}
          />
          <label className="field">
            <span>ตัวกรองตำแหน่ง</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">ทุกขอบเขต</option>
              <option value="STANDARD">ตำแหน่งมาตรฐาน</option>
              <option value="ORGANIZATION">ใช้ทุกสาขาในองค์กร</option>
              <option value="BRANCH">ใช้เฉพาะสาขา</option>
              <option value="WITH_ROLE">มีบทบาทแล้ว</option>
              <option value="WITHOUT_ROLE">ยังไม่มีบทบาท</option>
            </select>
          </label>
          <div
            className={
              viewMode === "cards"
                ? "hr-settings-list hr-settings-list--cards"
                : "hr-settings-list"
            }
          >
            {visiblePositions.map((row) => {
              const meta = [
                row.isSystemStandard ? "ตำแหน่งมาตรฐาน" : row.branchId ? "ใช้เฉพาะสาขา" : "ใช้ทุกสาขาในองค์กร",
                row.defaultRoleName ? `บทบาทหลัก: ${row.defaultRoleName} (${row.defaultRoleType})` : "ยังไม่ได้กำหนดบทบาท",
                `พนักงาน ${row.employeeCount} คน`,
                row.departmentNameTh ?? "ไม่ระบุแผนก",
                row.description || null,
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
                      {row.nameTh}
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
          aria-label="เพิ่มตำแหน่ง"
          title="เพิ่มตำแหน่ง"
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
                {mode === "create" ? "เพิ่มตำแหน่ง" : "แก้ไขตำแหน่ง"}
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
              <PositionForm
                key={editing?.id ?? "create"}
                mode={mode}
                positionId={editing?.id}
                departments={departments}
                roles={roles}
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
