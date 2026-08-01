"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import { submitHrJson } from "@/components/hr/form-utils";
import ScheduleAssignConflictDialog from "@/components/hr/schedule-assign-conflict-dialog";
import type { ScheduleComposerOption } from "@/components/hr/schedule-composer";
import {
  ALL_WORK_DAYS,
  expandWorkDates,
  WEEKDAY_WORK_DAYS,
} from "@/lib/hr/schedule-dates";
import type { ScheduleConflictPeriodSummary } from "@/lib/hr/schedule-period-overlap";
import { formatThaiDate } from "@/lib/hr/thai-date";
import {
  WORK_DAY_OPTIONS,
  WORK_DAY_SHORT_LABELS,
} from "@/lib/hr/work-days";

type OnShiftPerson = {
  employeeId: string;
  label: string;
  dayCount: number;
  workDates: string[];
  coverNote?: string | null;
  moveNote?: string | null;
  leaveNote?: string | null;
};

type AdjustMode = "changeShift" | "substitute";

type ConflictMode = "skip" | "reassign";

type PendingAssign = {
  employeeIds: string[];
  workDates: string[];
};

const ADJUST_MODES: Array<{ id: AdjustMode; title: string; hint: string }> = [
  { id: "changeShift", title: "ย้ายไปกะอื่น", hint: "เปลี่ยนกะในวันที่เลือก" },
  { id: "substitute", title: "มีคนแทน", hint: "เลือกแล้วระบบย้ายกะให้อัตโนมัติ" },
];

function sameDaySet(a: number[], b: readonly number[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((d) => set.has(d));
}

function parseConflictDetails(details: Record<string, unknown> | null): {
  periods: ScheduleConflictPeriodSummary[];
} | null {
  if (!details || details.conflictCode !== "SCHEDULE_DATE_CONFLICT") return null;
  const periodsRaw = details.periods;
  if (!Array.isArray(periodsRaw)) return { periods: [] };
  const periods: ScheduleConflictPeriodSummary[] = periodsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      if (
        typeof item.id !== "string" ||
        typeof item.name !== "string" ||
        typeof item.periodStart !== "string" ||
        typeof item.periodEnd !== "string"
      ) {
        return null;
      }
      return {
        id: item.id,
        name: item.name,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
        conflictCount: Number(item.conflictCount ?? 0),
      };
    })
    .filter((row): row is ScheduleConflictPeriodSummary => row != null);
  return { periods };
}

export default function ScheduleShiftWorkspace({
  scheduleId,
  shiftId,
  shiftName,
  periodStart,
  periodEnd,
  locked,
  canManage,
  onShift,
  unassignedEmployees,
  otherShifts,
  employeeOptions,
  available,
}: {
  scheduleId: string;
  shiftId: string;
  shiftName: string;
  shiftTimeLabel: string;
  periodStart: string;
  periodEnd: string;
  locked: boolean;
  canManage: boolean;
  onShift: OnShiftPerson[];
  unassignedEmployees: ScheduleComposerOption[];
  otherShifts: ScheduleComposerOption[];
  employeeOptions: ScheduleComposerOption[];
  available: boolean;
}) {
  const router = useRouter();
  const assignTitleId = useId();
  const adjustTitleId = useId();
  const [people, setPeople] = useState(onShift);
  const [availablePool, setAvailablePool] = useState(unassignedEmployees);
  const [adding, setAdding] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [workDays, setWorkDays] = useState<number[]>([...WEEKDAY_WORK_DAYS]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [pendingRemove, setPendingRemove] = useState<{
    employeeId: string;
    label: string;
  } | null>(null);
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null);
  const [conflictPeriods, setConflictPeriods] = useState<
    ScheduleConflictPeriodSummary[]
  >([]);
  const [conflictMessage, setConflictMessage] = useState("");

  const [adjustEmployeeId, setAdjustEmployeeId] = useState("");
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("changeShift");
  const [dayScope, setDayScope] = useState<"all" | "pick">("all");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [toShiftId, setToShiftId] = useState(() => otherShifts[0]?.id ?? "");
  const [substituteId, setSubstituteId] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    setPeople(onShift);
  }, [onShift]);

  useEffect(() => {
    setAvailablePool(unassignedEmployees);
  }, [unassignedEmployees]);

  const workDates = useMemo(
    () => expandWorkDates(periodStart, periodEnd, workDays),
    [periodStart, periodEnd, workDays],
  );

  const workDayPreset = useMemo(() => {
    if (sameDaySet(workDays, WEEKDAY_WORK_DAYS)) return "weekdays";
    if (sameDaySet(workDays, ALL_WORK_DAYS)) return "all";
    return "custom";
  }, [workDays]);

  function toggleWorkDay(day: number) {
    setWorkDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  const adjustPerson = useMemo(
    () => people.find((p) => p.employeeId === adjustEmployeeId) ?? null,
    [people, adjustEmployeeId],
  );

  const personDates = adjustPerson?.workDates ?? [];
  const effectiveDates =
    dayScope === "all" ? personDates : selectedDates;

  useEffect(() => {
    if (!toShiftId && otherShifts[0]) setToShiftId(otherShifts[0].id);
  }, [otherShifts, toShiftId]);

  const overlayOpen = adding || adjustOpen;

  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!overlayOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (adjusting || saving) return;
      setAdding(false);
      setAdjustOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, adjusting, saving]);

  function openAdjust(person: OnShiftPerson) {
    setFeedback(null);
    setPendingRemove(null);
    setAdjustEmployeeId(person.employeeId);
    setAdjustMode("changeShift");
    setDayScope("all");
    setSelectedDates([...person.workDates]);
    setSubstituteId("");
    setAdjustOpen(true);
  }

  function closeAdjust() {
    if (adjusting) return;
    setAdjustOpen(false);
  }

  const substituteOptions = useMemo(
    () => employeeOptions.filter((e) => e.id !== adjustEmployeeId),
    [employeeOptions, adjustEmployeeId],
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.length === availablePool.length
        ? []
        : availablePool.map((e) => e.id),
    );
  }

  function toggleDate(iso: string) {
    setSelectedDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort(),
    );
  }

  async function runAssign(
    employeeIds: string[],
    dates: string[],
    conflictMode?: ConflictMode,
  ) {
    setSaving(true);
    setFeedback({ kind: "info", message: "กำลังจัดพนักงานเข้ากะ…" });
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      {
        action: "assign",
        confirm: true,
        shiftId,
        employeeIds,
        workDates: dates,
        ...(conflictMode ? { conflictMode } : {}),
      },
      "จัดพนักงานเข้ากะแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      const parsed = parseConflictDetails(result.details);
      if (parsed) {
        setPendingAssign({ employeeIds, workDates: dates });
        setConflictPeriods(parsed.periods);
        setConflictMessage(result.message);
        setFeedback(null);
        return;
      }
      setFeedback({ kind: "error", message: result.message });
      return;
    }

    setPendingAssign(null);
    setConflictPeriods([]);
    setConflictMessage("");

    const selectedSet = new Set(employeeIds);
    const payload = result.data as {
      count?: number;
      skipped?: number;
      reassigned?: number;
    } | null;
    const dayCountHint =
      conflictMode === "skip" && typeof payload?.skipped === "number"
        ? Math.max(1, dates.length - Math.ceil(payload.skipped / employeeIds.length))
        : dates.length;
    const added = availablePool
      .filter((e) => selectedSet.has(e.id))
      .map(
        (e): OnShiftPerson => ({
          employeeId: e.id,
          label: e.label,
          dayCount: dayCountHint,
          workDates: [...dates],
          coverNote: null,
          leaveNote: null,
        }),
      );
    setPeople((prev) => {
      const map = new Map(prev.map((p) => [p.employeeId, p]));
      for (const person of added) map.set(person.employeeId, person);
      return [...map.values()].sort((a, b) =>
        a.label.localeCompare(b.label, "th"),
      );
    });
    setAvailablePool((prev) => prev.filter((e) => !selectedSet.has(e.id)));
    setSelected([]);
    setAdding(false);

    let successText = `เพิ่ม ${added.length} คน · ${dates.length} วัน`;
    if (conflictMode === "skip" && payload?.skipped) {
      successText = `จัดแล้ว (ข้าม ${payload.skipped} วันที่ชนช่วงอื่น)`;
    } else if (conflictMode === "reassign" && payload?.reassigned) {
      successText = `ย้ายมาช่วงนี้แล้ว (${payload.reassigned} วัน)`;
    }
    setFeedback({ kind: "success", message: successText });
    router.refresh();
  }

  async function assignSelected(event: React.FormEvent) {
    event.preventDefault();
    if (selected.length === 0) {
      setFeedback({ kind: "error", message: "เลือกพนักงานอย่างน้อย 1 คน" });
      return;
    }
    if (workDates.length === 0) {
      setFeedback({
        kind: "error",
        message: "เลือกวันทำงานอย่างน้อย 1 วันในสัปดาห์",
      });
      return;
    }
    await runAssign(selected, workDates);
  }

  async function resolveConflict(mode: ConflictMode) {
    if (!pendingAssign) return;
    await runAssign(pendingAssign.employeeIds, pendingAssign.workDates, mode);
  }

  function askRemoveEmployee(employeeId: string, label: string) {
    setPendingRemove({ employeeId, label });
    setFeedback({
      kind: "warning",
      title: "ยืนยันการลบ",
      message: `ลบ ${label} ออกจากกะ “${shiftName}” ในช่วงนี้หรือไม่?`,
      confirmLabel: "ลบ",
    });
  }

  async function confirmRemoveEmployee() {
    const pending = pendingRemove;
    setPendingRemove(null);
    if (!pending) return;
    const { employeeId, label } = pending;
    setRemovingId(employeeId);
    setFeedback({ kind: "info", message: "กำลังลบ…" });
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      {
        action: "delete",
        confirm: true,
        shiftId,
        employeeId,
      },
      "ลบพนักงานออกจากกะแล้ว",
    );
    setRemovingId(null);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setPeople((prev) => prev.filter((p) => p.employeeId !== employeeId));
    setAvailablePool((prev) => {
      if (prev.some((e) => e.id === employeeId)) return prev;
      return [...prev, { id: employeeId, label }].sort((a, b) =>
        a.label.localeCompare(b.label, "th"),
      );
    });
    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  async function applyAdjust(event: React.FormEvent) {
    event.preventDefault();
    if (!adjustEmployeeId) {
      setFeedback({ kind: "error", message: "เลือกพนักงาน" });
      return;
    }
    if (effectiveDates.length === 0) {
      setFeedback({ kind: "error", message: "เลือกวันอย่างน้อย 1 วัน" });
      return;
    }

    let body: Record<string, unknown>;
    let successMessage: string;

    if (adjustMode === "changeShift") {
      if (!toShiftId) {
        setFeedback({ kind: "error", message: "เลือกกะปลายทาง" });
        return;
      }
      body = {
        action: "changeShift",
        confirm: true,
        employeeId: adjustEmployeeId,
        fromShiftId: shiftId,
        toShiftId,
        workDates: effectiveDates,
      };
      successMessage = "ย้ายไปกะอื่นแล้ว";
    } else {
      if (!substituteId) {
        setFeedback({ kind: "error", message: "เลือกคนทำงานแทน" });
        return;
      }
      body = {
        action: "substitute",
        confirm: true,
        employeeId: adjustEmployeeId,
        substituteEmployeeId: substituteId,
        shiftId,
        workDates: effectiveDates,
      };
      successMessage = "บันทึกคนแทนแล้ว";
    }

    setAdjusting(true);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      body,
      successMessage,
    );
    setAdjusting(false);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setAdjustOpen(false);
    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  return (
    <>
      <FeedbackPopup
        feedback={feedback}
        onClose={() => {
          setFeedback(null);
          setPendingRemove(null);
        }}
        onConfirm={pendingRemove ? confirmRemoveEmployee : undefined}
      />

      {pendingAssign && conflictMessage ? (
        <ScheduleAssignConflictDialog
          message={conflictMessage}
          periods={conflictPeriods}
          busy={saving}
          onCancel={() => {
            setPendingAssign(null);
            setConflictPeriods([]);
            setConflictMessage("");
          }}
          onSkip={() => resolveConflict("skip")}
          onReassign={() => resolveConflict("reassign")}
        />
      ) : null}

      <section className="hr-shift-board" aria-label="พนักงานในกะ">
        <div className="hr-shift-board-head">
          <h2>
            <span aria-hidden="true">👤</span> พนักงาน
          </h2>
          <span className="hr-shift-board-count">{people.length}</span>
        </div>

        {canManage && !locked && people.length > 0 ? (
          <p className="hr-shift-board-hint">แตะ “ปรับ” เพื่อย้ายกะ หรือมีคนแทน</p>
        ) : null}

        {people.length === 0 ? (
          <div className="hr-shift-empty">
            <p>ยังไม่มีพนักงาน</p>
            {canManage && !locked ? <p>กด + มุมล่างขวาเพื่อเพิ่ม</p> : null}
          </div>
        ) : (
          <ul className="hr-shift-people">
            {people.map((person) => (
              <li key={person.employeeId} className="hr-shift-person">
                <div className="hr-shift-person-main">
                  <span className="hr-shift-person-name">{person.label}</span>
                  <span className="hr-shift-person-meta">
                    {person.dayCount} วัน
                    {person.leaveNote ? ` · ${person.leaveNote}` : ""}
                  </span>
                  {person.moveNote ? (
                    <span className="hr-shift-person-move">
                      {person.moveNote}
                    </span>
                  ) : null}
                  {person.coverNote ? (
                    <span className="hr-shift-person-cover">
                      {person.coverNote}
                    </span>
                  ) : null}
                </div>
                {canManage && !locked ? (
                  <div className="hr-shift-person-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => openAdjust(person)}
                      disabled={!available}
                    >
                      ปรับ
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() =>
                        askRemoveEmployee(person.employeeId, person.label)
                      }
                      disabled={!available || removingId === person.employeeId}
                    >
                      {removingId === person.employeeId ? "…" : "ลบ"}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!canManage || locked ? (
        <p className="muted hr-shift-readonly">
          {locked ? "ตารางถูกล็อกแล้ว" : "ดูอย่างเดียว"}
        </p>
      ) : null}

      {canManage && !locked && !overlayOpen ? (
        <button
          type="button"
          className="hr-fab"
          onClick={() => {
            setFeedback(null);
            setAdding(true);
          }}
          disabled={!available || availablePool.length === 0}
          aria-label="เพิ่มพนักงานเข้ากะ"
          title={
            availablePool.length === 0
              ? "พนักงานถูกจัดครบแล้ว"
              : "เพิ่มพนักงาน"
          }
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}

      {adjustOpen && adjustPerson ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={closeAdjust}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={adjustTitleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">{shiftName}</p>
                <h2 id={adjustTitleId}>ปรับ · {adjustPerson.label}</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={closeAdjust}
                disabled={adjusting}
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form
                className="hr-shift-adjust-form"
                onSubmit={applyAdjust}
                noValidate
              >
                <div className="hr-shift-step">
                  <p className="hr-shift-step-label">1. ต้องการทำอะไร</p>
                  <div
                    className="hr-shift-action-list"
                    role="radiogroup"
                    aria-label="การดำเนินการ"
                  >
                    {ADJUST_MODES.map((mode) => {
                      const active = adjustMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={
                            active
                              ? "hr-shift-action hr-shift-action--on"
                              : "hr-shift-action"
                          }
                          onClick={() => setAdjustMode(mode.id)}
                          disabled={adjusting || !available}
                        >
                          <span className="hr-shift-action-title">
                            {mode.title}
                          </span>
                          <span className="hr-shift-action-hint">
                            {mode.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hr-shift-step">
                  <p className="hr-shift-step-label">
                    2. ใช้กับวันไหน ({effectiveDates.length} วัน)
                  </p>
                  <div className="hr-shift-seg" role="group" aria-label="ขอบเขตวัน">
                    <button
                      type="button"
                      className={
                        dayScope === "all"
                          ? "hr-shift-seg-btn hr-shift-seg-btn--active"
                          : "hr-shift-seg-btn"
                      }
                      aria-pressed={dayScope === "all"}
                      onClick={() => {
                        setDayScope("all");
                        setSelectedDates([...personDates]);
                      }}
                      disabled={adjusting || !available}
                    >
                      ทุกวัน
                    </button>
                    <button
                      type="button"
                      className={
                        dayScope === "pick"
                          ? "hr-shift-seg-btn hr-shift-seg-btn--active"
                          : "hr-shift-seg-btn"
                      }
                      aria-pressed={dayScope === "pick"}
                      onClick={() => {
                        setDayScope("pick");
                        setSelectedDates([]);
                      }}
                      disabled={adjusting || !available}
                    >
                      เลือกบางวัน
                    </button>
                  </div>
                  {dayScope === "all" ? (
                    <p className="hr-shift-step-note">
                      ใช้ทั้ง {personDates.length} วันของคนนี้
                    </p>
                  ) : personDates.length === 0 ? (
                    <p className="empty">ไม่มีวันที่ในกะนี้</p>
                  ) : (
                    <>
                      <p className="hr-shift-step-note">
                        {selectedDates.length === 0
                          ? "แตะวันที่ต้องการ — ยังไม่ได้เลือก"
                          : `เลือกแล้ว ${selectedDates.length} วัน`}
                      </p>
                      <ul className="hr-shift-date-chips">
                        {personDates.map((iso) => {
                          const checked = selectedDates.includes(iso);
                          return (
                            <li key={iso}>
                              <button
                                type="button"
                                className={
                                  checked
                                    ? "hr-shift-date-chip hr-shift-date-chip--on"
                                    : "hr-shift-date-chip"
                                }
                                aria-pressed={checked}
                                onClick={() => toggleDate(iso)}
                                disabled={adjusting || !available}
                              >
                                {formatThaiDate(iso)}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>

                <div className="hr-shift-step">
                  <p className="hr-shift-step-label">3. รายละเอียด</p>
                  {adjustMode === "changeShift" ? (
                    otherShifts.length === 0 ? (
                      <p className="muted">ยังไม่มีกะอื่นในช่วงนี้</p>
                    ) : (
                      <label className="hr-shift-field">
                        <span>ย้ายไปกะ</span>
                        <select
                          value={toShiftId}
                          onChange={(e) => setToShiftId(e.target.value)}
                          disabled={adjusting || !available}
                        >
                          {otherShifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  ) : null}

                  {adjustMode === "substitute" ? (
                    <label className="hr-shift-field">
                      <span>คนที่เข้าแทน</span>
                      <select
                        value={substituteId}
                        onChange={(e) => setSubstituteId(e.target.value)}
                        disabled={adjusting || !available}
                      >
                        <option value="">— เลือก —</option>
                        {substituteOptions.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                      <span className="hr-shift-field-hint">
                        ระบบย้ายกะให้อัตโนมัติ ไม่ต้องลบตารางเดิมก่อน
                      </span>
                    </label>
                  ) : null}
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      adjusting ||
                      !available ||
                      effectiveDates.length === 0 ||
                      (adjustMode === "changeShift" &&
                        otherShifts.length === 0) ||
                      (adjustMode === "substitute" && !substituteId)
                    }
                  >
                    {adjusting ? "กำลังบันทึก…" : "บันทึก"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={closeAdjust}
                    disabled={adjusting}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {adding ? (
        <div className="hr-overlay" role="presentation">
          <button
            type="button"
            className="hr-overlay-backdrop"
            aria-label="ปิด"
            onClick={() => setAdding(false)}
          />
          <div
            className="hr-overlay-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={assignTitleId}
          >
            <div className="hr-overlay-head hr-period-create-overlay-head">
              <div>
                <p className="hr-period-create-overlay-kicker">{shiftName}</p>
                <h2 id={assignTitleId}>เพิ่มพนักงาน</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setAdding(false)}
              >
                ปิด
              </button>
            </div>
            <div className="hr-overlay-body">
              <form className="hr-shift-assign" onSubmit={assignSelected} noValidate>
                <div className="hr-shift-assign-toolbar hr-shift-assign-toolbar--days">
                  <div className="hr-shift-workdays">
                    <div className="hr-shift-workdays-head">
                      <span>วันทำงานต่อสัปดาห์</span>
                      <div className="hr-shift-seg" role="group" aria-label="ชุดวัน">
                        <button
                          type="button"
                          className={
                            workDayPreset === "weekdays"
                              ? "hr-shift-seg-btn hr-shift-seg-btn--active"
                              : "hr-shift-seg-btn"
                          }
                          aria-pressed={workDayPreset === "weekdays"}
                          onClick={() => setWorkDays([...WEEKDAY_WORK_DAYS])}
                          disabled={saving || !available}
                        >
                          จ–ศ
                        </button>
                        <button
                          type="button"
                          className={
                            workDayPreset === "all"
                              ? "hr-shift-seg-btn hr-shift-seg-btn--active"
                              : "hr-shift-seg-btn"
                          }
                          aria-pressed={workDayPreset === "all"}
                          onClick={() => setWorkDays([...ALL_WORK_DAYS])}
                          disabled={saving || !available}
                        >
                          ทุกวัน
                        </button>
                      </div>
                    </div>
                    <div
                      className="workday-chips hr-shift-workday-chips"
                      role="group"
                      aria-label="เลือกวันในสัปดาห์"
                    >
                      {WORK_DAY_OPTIONS.map((day) => {
                        const on = workDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            className={`btn btn-sm${on ? " btn-primary" : ""}`}
                            aria-pressed={on}
                            title={day.label}
                            onClick={() => toggleWorkDay(day.value)}
                            disabled={saving || !available}
                          >
                            {WORK_DAY_SHORT_LABELS[day.value] ?? day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="hr-shift-assign-meta" aria-live="polite">
                    <strong>{selected.length}</strong> คน ·{" "}
                    <strong>{workDates.length}</strong> วันในช่วงนี้
                  </p>
                </div>

                <div className="hr-shift-assign-roster-head">
                  <span>ยังว่าง {availablePool.length}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={toggleAll}
                    disabled={saving || !available || availablePool.length === 0}
                  >
                    {selected.length === availablePool.length &&
                    availablePool.length > 0
                      ? "ยกเลิก"
                      : "ทั้งหมด"}
                  </button>
                </div>

                {availablePool.length === 0 ? (
                  <p className="empty">จัดครบแล้วในช่วงนี้</p>
                ) : (
                  <ul
                    className="hr-shift-assign-list"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label="พนักงานที่ยังว่าง"
                  >
                    {availablePool.map((emp) => {
                      const checked = selected.includes(emp.id);
                      const parts = emp.label.split(" · ");
                      const primary =
                        parts.length > 1 ? parts.slice(1).join(" · ") : emp.label;
                      const secondary =
                        parts.length > 1 ? parts[0] : null;
                      return (
                        <li key={emp.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={checked}
                            className={
                              checked
                                ? "hr-shift-pick hr-shift-pick--on"
                                : "hr-shift-pick"
                            }
                            onClick={() => toggle(emp.id)}
                            disabled={saving || !available}
                          >
                            <span
                              className="hr-shift-pick-mark"
                              aria-hidden="true"
                            >
                              {checked ? "✓" : ""}
                            </span>
                            <span className="hr-shift-pick-text">
                              <span className="hr-shift-pick-name">{primary}</span>
                              {secondary ? (
                                <span className="hr-shift-pick-code">
                                  {secondary}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="form-actions hr-shift-assign-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      saving ||
                      !available ||
                      selected.length === 0 ||
                      workDates.length === 0
                    }
                  >
                    {saving
                      ? "กำลังเพิ่ม…"
                      : selected.length > 0
                        ? `เพิ่ม ${selected.length} คน`
                        : "เพิ่มเข้ากะ"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setAdding(false)}
                    disabled={saving}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
