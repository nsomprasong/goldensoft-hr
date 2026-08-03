"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import HrSettingsViewToggle, {
  useSettingsViewMode,
} from "@/components/hr/hr-settings-view-toggle";
import ToggleActiveButton from "@/components/hr/toggle-active-button";
import WorkLocationForm, {
  type WorkLocationFormValues,
} from "@/components/hr/work-location-form";
import HrButton from "@/components/ui/hr-button";
import { IconMapPin } from "@/components/ui/icons";

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

function staticMapUrl(latitude: number, longitude: number): string {
  const center = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const params = new URLSearchParams({
    center,
    zoom: "16",
    size: "640x280",
    maptype: "mapnik",
    markers: `${center},red-pushpin`,
  });
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`;
}

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
  const [viewMode, setViewMode] = useSettingsViewMode(
    "hr.settings.locations.viewMode",
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

  function locationTitle(row: LocationListRow): string {
    const branchLabel = branchLabelById.get(row.branchId) ?? null;
    if (branchLabel && branchLabel !== row.name) return row.name;
    return branchLabel ?? row.name;
  }

  return (
    <>
      {locations.length === 0 ? (
        <section className="hr-settings-panel">
          <div className="hr-location-empty">
            <span className="hr-location-empty-icon" aria-hidden="true">
              <IconMapPin size={22} />
            </span>
            <div>
              <strong>ยังไม่ได้ตั้งพิกัดสาขา</strong>
              <p>กด + เพื่อปักหมุดและกำหนดรัศมีลงเวลา</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="hr-location-toolbar">
            <HrSettingsViewToggle
              viewMode={viewMode}
              onChange={setViewMode}
              count={locations.length}
            />
          </div>

          {viewMode === "cards" ? (
            <div className="hr-location-card-grid">
              {locations.map((row) => {
                const hasPin =
                  row.latitude != null && row.longitude != null;
                const coords = hasPin
                  ? `${row.latitude!.toFixed(5)}, ${row.longitude!.toFixed(5)}`
                  : "—";
                const title = locationTitle(row);
                return (
                  <article
                    key={row.id}
                    className={
                      row.isActive
                        ? "hr-settings-panel hr-location-shell"
                        : "hr-settings-panel hr-location-shell is-inactive"
                    }
                  >
                    <header className="hr-leave-panel-head">
                      <h2>{title}</h2>
                      <p>พิกัดลงเวลา</p>
                    </header>
                    <div className="hr-settings-inner-card hr-location-shell-body">
                      <div className="hr-location-map-preview">
                        {hasPin ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={staticMapUrl(row.latitude!, row.longitude!)}
                            alt={`แผนที่ ${title}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              const target = event.currentTarget;
                              target.style.display = "none";
                              const fallback = target.nextElementSibling;
                              if (fallback instanceof HTMLElement) {
                                fallback.hidden = false;
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="hr-location-map-preview-empty"
                          hidden={hasPin}
                        >
                          <IconMapPin size={22} />
                          <span>
                            {hasPin ? "โหลดแผนที่ไม่สำเร็จ" : "ยังไม่มีหมุดบนแผนที่"}
                          </span>
                        </div>
                      </div>
                      <dl className="hr-location-card-facts">
                        <div className="hr-location-card-facts-full">
                          <dt>พิกัด</dt>
                          <dd className="hr-location-coords">{coords}</dd>
                        </div>
                        <div className="hr-location-card-facts-full">
                          <dt>รัศมี</dt>
                          <dd>{row.geofenceRadiusMeters} ม.</dd>
                        </div>
                      </dl>
                      <div className="hr-location-card-actions">
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
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="hr-settings-panel">
              <div className="hr-settings-list">
                {locations.map((row) => {
                  const hasPin =
                    row.latitude != null && row.longitude != null;
                  const coords = hasPin
                    ? `${row.latitude!.toFixed(5)}, ${row.longitude!.toFixed(5)}`
                    : null;
                  const title = locationTitle(row);
                  return (
                    <article
                      key={row.id}
                      className={
                        row.isActive
                          ? "hr-location-item"
                          : "hr-location-item is-inactive"
                      }
                    >
                      <span
                        className={
                          hasPin
                            ? "hr-location-item-icon"
                            : "hr-location-item-icon hr-location-item-icon--muted"
                        }
                        aria-hidden="true"
                      >
                        <IconMapPin size={16} />
                      </span>
                      <div className="hr-location-item-main">
                        <strong className="hr-location-item-title">
                          {title}
                        </strong>
                        <span className="hr-location-item-meta-line">
                          พิกัด {coords ?? "—"}
                          {" · "}
                          รัศมี {row.geofenceRadiusMeters} ม.
                        </span>
                      </div>
                      <div className="hr-settings-item-actions">
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
            </section>
          )}
        </>
      )}

      {open ? null : (
        <button
          type="button"
          className="hr-fab"
          onClick={openCreate}
          disabled={!available}
          aria-label="ตั้งพิกัดสาขา"
          title="ตั้งพิกัดสาขา"
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
            className="hr-overlay-panel hr-overlay-panel--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head">
              <h2 id={titleId}>
                {mode === "create" ? "ตั้งพิกัดสาขา" : "แก้ไขพิกัดสาขา"}
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
