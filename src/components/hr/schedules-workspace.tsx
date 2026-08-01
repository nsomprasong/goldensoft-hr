"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import DeleteSchedulePeriodButton from "@/components/hr/delete-schedule-period-button";
import PublishScheduleButton from "@/components/hr/publish-schedule-button";
import SchedulePeriodCreateForm from "@/components/hr/schedule-period-create-form";
import { formatThaiDateRange } from "@/lib/hr/thai-date";

export type SchedulePeriodCard = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  statusCode: string;
  statusName: string;
  branchId?: string | null;
};

export default function SchedulesWorkspace({
  periods,
  branchId,
  branchLabel,
  canManage,
  canPublish,
  available,
}: {
  periods: SchedulePeriodCard[];
  branchId: string;
  branchLabel: string;
  canManage: boolean;
  canPublish: boolean;
  available: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!creating) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [creating]);

  useEffect(() => {
    if (!creating) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCreating(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating]);

  function handleCreated(scheduleId: string) {
    setCreating(false);
    router.push(`/hr/schedules/${scheduleId}`);
    router.refresh();
  }

  return (
    <>
      {periods.length === 0 ? (
        <p className="empty">
          ยังไม่มีตารางกะงานของ{branchLabel} — กด + เพื่อสร้างช่วงเวลา
        </p>
      ) : (
        <div className="hr-card-grid">
          {periods.map((row) => (
            <article key={row.id} className="card hr-entity-card">
              <div className="hr-entity-card-top">
                <div className="hr-entity-card-title-wrap">
                  <h2 className="hr-entity-card-title">{row.name}</h2>
                  <p className="hr-entity-card-subtitle">
                    {branchLabel} ·{" "}
                    {formatThaiDateRange(row.periodStart, row.periodEnd)}
                  </p>
                </div>
                <span
                  className={
                    row.statusCode === "PUBLISHED"
                      ? "badge badge-active"
                      : row.statusCode === "LOCKED"
                        ? "badge badge-inactive"
                        : "badge"
                  }
                >
                  {row.statusName}
                </span>
              </div>

              <dl className="hr-entity-card-meta">
                <div>
                  <dt>สาขา</dt>
                  <dd>{branchLabel}</dd>
                </div>
                <div>
                  <dt>ช่วงเวลา</dt>
                  <dd>{formatThaiDateRange(row.periodStart, row.periodEnd)}</dd>
                </div>
                <div>
                  <dt>สถานะ</dt>
                  <dd>{row.statusName}</dd>
                </div>
              </dl>

              <div className="hr-entity-card-actions">
                {canPublish ? (
                  <PublishScheduleButton
                    scheduleId={row.id}
                    statusCode={row.statusCode}
                    disabled={!available}
                  />
                ) : null}
                <Link className="btn btn-sm" href={`/hr/schedules/${row.id}`}>
                  เปิด
                </Link>
                {canManage ? (
                  <DeleteSchedulePeriodButton
                    scheduleId={row.id}
                    name={row.name}
                    statusCode={row.statusCode}
                    disabled={!available}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {!canManage ? (
        <p className="muted">คุณมีสิทธิ์ดูตารางเท่านั้น ไม่สามารถจัดตารางได้</p>
      ) : null}

      {canManage && !creating ? (
        <button
          type="button"
          className="hr-fab"
          onClick={() => setCreating(true)}
          disabled={!available}
          aria-label="สร้างช่วงตาราง"
          title="สร้างช่วงตาราง"
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}

      {creating ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={() => setCreating(false)}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">ตารางกะงาน</p>
                <h2 id={titleId}>สร้างช่วงตาราง</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setCreating(false)}
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <SchedulePeriodCreateForm
                branchId={branchId}
                branchLabel={branchLabel}
                disabled={!available}
                onDone={handleCreated}
                onCancel={() => setCreating(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
