"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import ToggleActiveButton from "@/components/hr/toggle-active-button";
import WorkLocationForm, {
  type WorkLocationFormValues,
} from "@/components/hr/work-location-form";

export type LocationListRow = {
  id: string;
  code: string;
  name: string;
  branchId: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  isActive: boolean;
};

type BranchOption = { id: string; label: string };

export default function LocationsWorkspace({
  locations,
  branches,
  editing,
  available,
}: {
  locations: LocationListRow[];
  branches: BranchOption[];
  editing: LocationListRow | null;
  available: boolean;
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
      router.push("/hr/locations");
    }
  }

  function openCreate() {
    setCreating(true);
    if (editing) {
      router.push("/hr/locations");
    }
  }

  function handleDone() {
    setCreating(false);
    router.push("/hr/locations");
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setCreating(false);
      if (editing) router.push("/hr/locations");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing, router]);

  const editInitial: Partial<WorkLocationFormValues> | undefined = editing
    ? {
        name: editing.name,
        branchId: editing.branchId,
        latitude: editing.latitude != null ? String(editing.latitude) : "",
        longitude:
          editing.longitude != null ? String(editing.longitude) : "",
        geofenceRadiusMeters: String(editing.geofenceRadiusMeters),
      }
    : undefined;

  const branchLabelById = new Map(branches.map((b) => [b.id, b.label]));

  return (
    <>
      {locations.length === 0 ? (
        <p className="empty">ยังไม่มีสถานที่ทำงาน</p>
      ) : (
        <div className="hr-card-grid">
          {locations.map((row) => {
            const coords =
              row.latitude != null && row.longitude != null
                ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
                : null;
            const branchLabel = branchLabelById.get(row.branchId) ?? null;
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
                  {branchLabel ? (
                    <div>
                      <dt>สาขา</dt>
                      <dd>{branchLabel}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>พิกัด GPS</dt>
                    <dd className="hr-location-card-coords">
                      {coords ?? "ยังไม่ได้ตั้งพิกัด"}
                    </dd>
                  </div>
                  <div>
                    <dt>รัศมีลงเวลา</dt>
                    <dd>{row.geofenceRadiusMeters} เมตร</dd>
                  </div>
                </dl>

                <div className="hr-entity-card-actions">
                  <Link
                    className="btn btn-sm"
                    href={`/hr/locations?edit=${row.id}`}
                    onClick={() => setCreating(false)}
                  >
                    แก้ไข
                  </Link>
                  <ToggleActiveButton
                    resource="work-locations"
                    id={row.id}
                    isActive={row.isActive}
                    disabled={!available}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open ? null : (
        <button
          type="button"
          className="hr-fab"
          onClick={openCreate}
          disabled={!available}
          aria-label="เพิ่มสถานที่ทำงาน"
          title="เพิ่มสถานที่ทำงาน"
        >
          <span aria-hidden="true">+</span>
        </button>
      )}

      {open ? (
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
                {mode === "create"
                  ? "เพิ่มสถานที่ทำงาน"
                  : "แก้ไขสถานที่ทำงาน"}
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
              <WorkLocationForm
                key={editing?.id ?? "create"}
                mode={mode}
                locationId={editing?.id}
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
