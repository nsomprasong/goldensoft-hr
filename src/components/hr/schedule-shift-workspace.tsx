"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import { submitHrJson } from "@/components/hr/form-utils";
import type { ScheduleComposerOption } from "@/components/hr/schedule-composer";
import {
  expandWorkDates,
  type ScheduleDayMode,
} from "@/lib/hr/schedule-dates";
import { formatThaiDate } from "@/lib/hr/thai-date";

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

const DAY_MODES: Array<{ id: ScheduleDayMode; title: string; hint: string }> = [
  { id: "weekdays", title: "จ–ศ", hint: "วันทำงาน" },
  { id: "all", title: "ทุกวัน", hint: "ทั้งช่วง" },
];

const ADJUST_MODES: Array<{ id: AdjustMode; title: string; hint: string }> = [
  { id: "changeShift", title: "ย้ายไปกะอื่น", hint: "เปลี่ยนกะในวันที่เลือก" },
  { id: "substitute", title: "มีคนแทน", hint: "เลือกแล้วระบบย้ายกะให้อัตโนมัติ" },
];

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
  const [dayMode, setDayMode] = useState<ScheduleDayMode>("weekdays");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const [adjustEmployeeId, setAdjustEmployeeId] = useState("");
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("changeShift");
  const [dayScope, setDayScope] = useState<"all" | "pick">("all");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [toShiftId, setToShiftId] = useState(() => otherShifts[0]?.id ?? "");
  const [substituteId, setSubstituteId] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustFeedback, setAdjustFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setPeople(onShift);
  }, [onShift]);

  useEffect(() => {
    setAvailablePool(unassignedEmployees);
  }, [unassignedEmployees]);

  const workDates = useMemo(
    () => expandWorkDates(periodStart, periodEnd, dayMode),
    [periodStart, periodEnd, dayMode],
  );

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
    setAdjustFeedback(null);
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
    setAdjustFeedback(null);
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

  async function assignSelected(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    if (selected.length === 0) {
      setFeedback({ kind: "error", text: "เลือกพนักงานอย่างน้อย 1 คน" });
      return;
    }
    if (workDates.length === 0) {
      setFeedback({ kind: "error", text: "ไม่มีวันที่ตรงเงื่อนไขในช่วงนี้" });
      return;
    }
    setSaving(true);
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      {
        action: "assign",
        confirm: true,
        shiftId,
        employeeIds: selected,
        workDates,
      },
      "จัดพนักงานเข้ากะแล้ว",
    );
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    const selectedSet = new Set(selected);
    const added = availablePool
      .filter((e) => selectedSet.has(e.id))
      .map(
        (e): OnShiftPerson => ({
          employeeId: e.id,
          label: e.label,
          dayCount: workDates.length,
          workDates: [...workDates],
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
    setFeedback({
      kind: "success",
      text: `เพิ่ม ${added.length} คน · ${workDates.length} วัน`,
    });
    router.refresh();
  }

  async function removeEmployee(employeeId: string, label: string) {
    if (
      !window.confirm(
        `ลบ ${label} ออกจากกะ “${shiftName}” ในช่วงนี้หรือไม่?`,
      )
    ) {
      return;
    }
    setRemovingId(employeeId);
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
      window.alert(result.message);
      return;
    }
    setPeople((prev) => prev.filter((p) => p.employeeId !== employeeId));
    setAvailablePool((prev) => {
      if (prev.some((e) => e.id === employeeId)) return prev;
      return [...prev, { id: employeeId, label }].sort((a, b) =>
        a.label.localeCompare(b.label, "th"),
      );
    });
    router.refresh();
  }

  async function applyAdjust(event: React.FormEvent) {
    event.preventDefault();
    setAdjustFeedback(null);
    if (!adjustEmployeeId) {
      setAdjustFeedback({ kind: "error", text: "เลือกพนักงาน" });
      return;
    }
    if (effectiveDates.length === 0) {
      setAdjustFeedback({ kind: "error", text: "เลือกวันอย่างน้อย 1 วัน" });
      return;
    }

    let body: Record<string, unknown>;
    let successMessage: string;

    if (adjustMode === "changeShift") {
      if (!toShiftId) {
        setAdjustFeedback({ kind: "error", text: "เลือกกะปลายทาง" });
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
        setAdjustFeedback({ kind: "error", text: "เลือกคนทำงานแทน" });
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
    const result = await submitHrJson(
      `/api/hr/schedules/${scheduleId}`,
      "POST",
      body,
      successMessage,
    );
    setAdjusting(false);
    if (!result.ok) {
      setAdjustFeedback({ kind: "error", text: result.message });
      return;
    }
    setAdjustOpen(false);
    setFeedback({ kind: "success", text: result.message });
    router.refresh();
  }

  return (
    <>
      {feedback && !overlayOpen ? (
        <Alert kind={feedback.kind}>{feedback.text}</Alert>
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
                        removeEmployee(person.employeeId, person.label)
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
                {adjustFeedback ? (
                  <Alert kind={adjustFeedback.kind}>{adjustFeedback.text}</Alert>
                ) : null}

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
                {feedback ? (
                  <Alert kind={feedback.kind}>{feedback.text}</Alert>
                ) : null}

                <div className="hr-shift-assign-toolbar">
                  <div
                    className="hr-shift-seg"
                    role="group"
                    aria-label="วันที่จัดกะ"
                  >
                    {DAY_MODES.map((mode) => {
                      const active = dayMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          className={
                            active
                              ? "hr-shift-seg-btn hr-shift-seg-btn--active"
                              : "hr-shift-seg-btn"
                          }
                          aria-pressed={active}
                          onClick={() => setDayMode(mode.id)}
                          disabled={saving || !available}
                        >
                          {mode.title}
                        </button>
                      );
                    })}
                  </div>
                  <p className="hr-shift-assign-meta" aria-live="polite">
                    <strong>{selected.length}</strong> คน ·{" "}
                    <strong>{workDates.length}</strong> วัน
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
