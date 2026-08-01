"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import ShiftForm, { type ShiftFormValues } from "@/components/hr/shift-form";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import type { ShiftRow } from "@/lib/hr/data";

type BranchOption = { id: string; label: string };
type ShiftTypeOption = { id: string; label: string };

export default function ShiftsWorkspace({
  shifts,
  shiftTypes,
  branches,
  editing,
  available,
  canManage,
}: {
  shifts: ShiftRow[];
  shiftTypes: ShiftTypeOption[];
  branches: BranchOption[];
  editing: ShiftRow | null;
  available: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [creating, setCreating] = useState(false);

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
    if (editing) {
      router.push("/hr/settings/shifts");
    }
  }

  function openCreate() {
    setCreating(true);
    if (editing) {
      router.push("/hr/settings/shifts");
    }
  }

  function handleDone() {
    setCreating(false);
    router.push("/hr/settings/shifts");
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setCreating(false);
      if (editing) router.push("/hr/settings/shifts");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing, router]);

  const editInitial: Partial<ShiftFormValues> | undefined = editing
    ? {
        name: editing.name,
        shiftTypeId: editing.shiftTypeId,
        branchId: editing.branchId ?? "",
        startTime: editing.startTime,
        endTime: editing.endTime,
        breakMinutes: String(editing.breakMinutes),
        graceLateMinutes: String(editing.graceLateMinutes),
        graceEarlyLeaveMinutes: String(editing.graceEarlyLeaveMinutes),
        overtimeAfterMinutes:
          editing.overtimeAfterMinutes === null
            ? ""
            : String(editing.overtimeAfterMinutes),
        crossesMidnight: editing.crossesMidnight,
      }
    : undefined;

  const branchLabelById = new Map(branches.map((b) => [b.id, b.label]));

  return (
    <>
      {shifts.length === 0 ? (
        <p className="empty">ยังไม่มีกะงานในองค์กรนี้</p>
      ) : (
        <div className="hr-card-grid">
          {shifts.map((row) => {
            const branchLabel = row.branchId
              ? (branchLabelById.get(row.branchId) ?? null)
              : null;
            const timeLabel = `${row.startTime} – ${row.endTime}${
              row.crossesMidnight ? " (ข้ามวัน)" : ""
            }`;
            return (
              <article
                key={row.id}
                className={
                  row.isActive
                    ? "card hr-entity-card"
                    : "card hr-entity-card hr-entity-card--inactive"
                }
              >
                <div className="hr-entity-card-top">
                  <div className="hr-entity-card-title-wrap">
                    <h2 className="hr-entity-card-title">{row.name}</h2>
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
                </div>

                <dl className="hr-entity-card-meta">
                  <div>
                    <dt>ประเภท</dt>
                    <dd>{row.shiftTypeNameTh}</dd>
                  </div>
                  <div>
                    <dt>เวลา</dt>
                    <dd>{timeLabel}</dd>
                  </div>
                  <div>
                    <dt>พัก</dt>
                    <dd>{row.breakMinutes} นาที</dd>
                  </div>
                  <div>
                    <dt>สาขา</dt>
                    <dd>{branchLabel ?? "ทุกสาขา"}</dd>
                  </div>
                </dl>

                {canManage ? (
                  <div className="hr-entity-card-actions">
                    <Link
                      className="btn btn-sm"
                      href={`/hr/settings/shifts?edit=${row.id}`}
                      onClick={() => setCreating(false)}
                    >
                      แก้ไข
                    </Link>
                    <ToggleActiveButton
                      resource="shifts"
                      id={row.id}
                      isActive={row.isActive}
                      disabled={!available}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {canManage && !open ? (
        <button
          type="button"
          className="hr-fab"
          onClick={openCreate}
          disabled={!available}
          aria-label="เพิ่มกะงาน"
          title="เพิ่มกะงาน"
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
                {mode === "create" ? "เพิ่มกะงาน" : "แก้ไขกะงาน"}
              </h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={closeOverlay}
                aria-label="ปิด"
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <ShiftForm
                key={editing?.id ?? "create"}
                mode={mode}
                shiftId={editing?.id}
                shiftTypes={shiftTypes}
                branches={branches}
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
