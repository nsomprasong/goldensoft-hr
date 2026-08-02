"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import AdjustmentApprovalList from "@/components/hr/adjustment-approval-list";
import AdvanceApprovalList from "@/components/hr/advance-approval-list";
import LeaveApprovalCards from "@/components/hr/leave-approval-cards";
import OvertimeApprovalList from "@/components/hr/overtime-approval-list";
import ShiftMismatchApprovalList from "@/components/hr/shift-mismatch-approval-list";
import { IconBell } from "@/components/ui/icons";
import type {
  AttendanceAdjustmentRow,
  LeaveRequestRow,
  OvertimeRequestRow,
  ShiftMismatchRow,
} from "@/lib/hr/data";
import type { SalaryAdvanceRow } from "@/lib/hr/services/salary-advances";

export type NotificationBellPermissions = {
  leave: boolean;
  overtime: boolean;
  advance: boolean;
  attendance: boolean;
};

type PendingInbox = {
  leave: LeaveRequestRow[];
  overtime: OvertimeRequestRow[];
  advances: SalaryAdvanceRow[];
  attendanceAdjustments: AttendanceAdjustmentRow[];
  shiftMismatches: ShiftMismatchRow[];
};

function MountPortal({
  children,
}: {
  children: (host: HTMLElement | null) => ReactNode;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const resolve = () => {
      const el =
        document.getElementById("gs-hr-notify-mount") ||
        document.getElementById("hr-debug-notify-mount");
      setHost(el);
    };
    resolve();
    const slot = document.querySelector(".gs-customer-shell-slot");
    const observer =
      slot && typeof MutationObserver !== "undefined"
        ? new MutationObserver(resolve)
        : null;
    if (slot && observer) observer.observe(slot, { childList: true });
    return () => observer?.disconnect();
  }, []);

  return <>{children(host)}</>;
}

function pendingOnly(inbox: PendingInbox): PendingInbox {
  return {
    leave: inbox.leave.filter((row) => row.statusCode === "SUBMITTED"),
    overtime: inbox.overtime.filter((row) => row.statusCode === "SUBMITTED"),
    advances: inbox.advances.filter((row) => row.status === "SUBMITTED"),
    attendanceAdjustments: inbox.attendanceAdjustments.filter(
      (row) => row.statusCode === "SUBMITTED",
    ),
    shiftMismatches: inbox.shiftMismatches.filter(
      (row) => row.statusCode === "SUBMITTED",
    ),
  };
}

export default function NotificationBell({
  showBranchLabel = false,
  permissions,
}: {
  showBranchLabel?: boolean;
  permissions: NotificationBellPermissions;
}) {
  const panelId = useId();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inbox, setInbox] = useState<PendingInbox>({
    leave: [],
    overtime: [],
    advances: [],
    attendanceAdjustments: [],
    shiftMismatches: [],
  });
  const canAnyApprove =
    permissions.leave ||
    permissions.overtime ||
    permissions.advance ||
    permissions.attendance;

  const reload = useCallback(async () => {
    if (!canAnyApprove) {
      setInbox({
        leave: [],
        overtime: [],
        advances: [],
        attendanceAdjustments: [],
        shiftMismatches: [],
      });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/hr/approvals", {
        credentials: "include",
      });
      if (response.status === 403 || response.status === 401) {
        setInbox({
          leave: [],
          overtime: [],
          advances: [],
          attendanceAdjustments: [],
          shiftMismatches: [],
        });
        return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body?.error?.message || body?.message || "โหลดคิวอนุมัติไม่สำเร็จ",
        );
      }
      setInbox(
        pendingOnly({
          leave: Array.isArray(body?.leave) ? body.leave : [],
          overtime: Array.isArray(body?.overtime) ? body.overtime : [],
          advances: Array.isArray(body?.advances) ? body.advances : [],
          attendanceAdjustments: Array.isArray(body?.attendanceAdjustments)
            ? body.attendanceAdjustments
            : [],
          shiftMismatches: Array.isArray(body?.shiftMismatches)
            ? body.shiftMismatches
            : [],
        }),
      );
    } catch {
      // Keep last good inbox; badge stays stable on transient errors.
    } finally {
      setLoading(false);
    }
  }, [canAnyApprove]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const leaveRows = permissions.leave ? inbox.leave : [];
  const otRows = permissions.overtime ? inbox.overtime : [];
  const advanceRows = permissions.advance ? inbox.advances : [];
  const adjustRows = permissions.attendance ? inbox.attendanceAdjustments : [];
  const mismatchRows = permissions.attendance ? inbox.shiftMismatches : [];
  const visibleCount =
    leaveRows.length +
    otRows.length +
    advanceRows.length +
    adjustRows.length +
    mismatchRows.length;

  const button = (
    <div className="hr-notify-bell" ref={buttonRef}>
      <button
        type="button"
        className="hr-notify-bell-btn"
        aria-label={
          visibleCount > 0
            ? `รออนุมัติ ${visibleCount} รายการ`
            : "รายการรออนุมัติ"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell size={18} />
        {visibleCount > 0 ? (
          <span className="hr-notify-bell-badge">
            {visibleCount > 99 ? "99+" : visibleCount}
          </span>
        ) : null}
      </button>
    </div>
  );

  const panel =
    open && typeof document !== "undefined" ? (
      createPortal(
        <div
          id={panelId}
          ref={panelRef}
          className="hr-root hr-notify-bell-panel"
          role="dialog"
          aria-label="รายการรออนุมัติ"
        >
            <div className="hr-notify-bell-panel-head">
              <div>
                <strong>รออนุมัติ</strong>
                <p>
                  {visibleCount > 0
                    ? `${visibleCount} รายการ`
                    : "ไม่มีรายการรออนุมัติ"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void reload()}
                disabled={loading}
              >
                รีเฟรช
              </button>
            </div>

            <div className="hr-notify-bell-body">
              {!canAnyApprove ? (
                <p className="hr-notify-bell-empty">ไม่มีสิทธิ์อนุมัติ</p>
              ) : visibleCount === 0 ? (
                <p className="hr-notify-bell-empty">
                  {loading ? "กำลังโหลด…" : "ไม่มีรายการรออนุมัติ"}
                </p>
              ) : (
                <>
                  {leaveRows.length > 0 ? (
                    <section className="hr-notify-bell-section" aria-label="ลา">
                      <h3 className="hr-notify-bell-section-title">
                        ลา ({leaveRows.length})
                      </h3>
                      <LeaveApprovalCards
                        key={leaveRows.map((row) => row.id).join(",")}
                        rows={leaveRows}
                        canApprove={permissions.leave}
                        showBranchLabel={showBranchLabel}
                        onChanged={() => void reload()}
                      />
                    </section>
                  ) : null}
                  {otRows.length > 0 ? (
                    <section className="hr-notify-bell-section" aria-label="OT">
                      <h3 className="hr-notify-bell-section-title">
                        OT ({otRows.length})
                      </h3>
                      <OvertimeApprovalList
                        key={otRows.map((row) => row.id).join(",")}
                        rows={otRows}
                        canApprove={permissions.overtime}
                        showHero={false}
                        showSectionHead={false}
                        showBranchLabel={showBranchLabel}
                        onChanged={() => void reload()}
                      />
                    </section>
                  ) : null}
                  {advanceRows.length > 0 ? (
                    <section className="hr-notify-bell-section" aria-label="เบิก">
                      <h3 className="hr-notify-bell-section-title">
                        เบิก ({advanceRows.length})
                      </h3>
                      <AdvanceApprovalList
                        key={advanceRows.map((row) => row.id).join(",")}
                        rows={advanceRows}
                        canApprove={permissions.advance}
                        showBranchLabel={showBranchLabel}
                        onChanged={() => void reload()}
                      />
                    </section>
                  ) : null}
                  {adjustRows.length > 0 ? (
                    <section
                      className="hr-notify-bell-section"
                      aria-label="ปรับเวลา"
                    >
                      <h3 className="hr-notify-bell-section-title">
                        ปรับเวลา ({adjustRows.length})
                      </h3>
                      <AdjustmentApprovalList
                        key={adjustRows.map((row) => row.id).join(",")}
                        rows={adjustRows}
                        canApprove={permissions.attendance}
                        showHero={false}
                        showSectionHead={false}
                        showBranchLabel={showBranchLabel}
                        onChanged={() => void reload()}
                      />
                    </section>
                  ) : null}
                  {mismatchRows.length > 0 ? (
                    <section
                      className="hr-notify-bell-section"
                      aria-label="ย้ายกะ"
                    >
                      <h3 className="hr-notify-bell-section-title">
                        ย้ายกะ ({mismatchRows.length})
                      </h3>
                      <ShiftMismatchApprovalList
                        key={mismatchRows.map((row) => row.id).join(",")}
                        rows={mismatchRows}
                        canApprove={permissions.attendance}
                        showSectionHead={false}
                        showBranchLabel={showBranchLabel}
                        onChanged={() => void reload()}
                      />
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </div>,
        document.body,
      )
    ) : null;

  return (
    <>
      <MountPortal>
        {(host) =>
          host ? (
            createPortal(button, host)
          ) : (
            <div className="hr-notify-bell-fallback">{button}</div>
          )
        }
      </MountPortal>
      {panel}
    </>
  );
}
