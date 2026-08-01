"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson, type FieldErrors } from "@/components/hr/form-utils";
import ThaiDateInput from "@/components/hr/thai-date-input";

type HolidayTypeOption = {
  id: string;
  code: string;
  name: string;
};

export default function HolidayForm({
  calendarId,
  holidayTypes,
  disabled = false,
  embedded = false,
  onDone,
  onCancel,
}: {
  calendarId: string;
  holidayTypes: HolidayTypeOption[];
  disabled?: boolean;
  embedded?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const defaultType =
    holidayTypes.find((t) => t.code === "PUBLIC")?.id ??
    holidayTypes[0]?.id ??
    "";
  const [holidayDate, setHolidayDate] = useState("");
  const [name, setName] = useState("");
  const [holidayTypeId, setHolidayTypeId] = useState(defaultType);
  const [isPaid, setIsPaid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const next: FieldErrors = {};
    if (!holidayDate) next.holidayDate = "ระบุวันที่หยุด";
    if (!name.trim()) next.name = "ระบุชื่อวันหยุด";
    if (!holidayTypeId) next.holidayTypeId = "เลือกประเภทวันหยุด";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFeedback({ kind: "error", text: "กรุณากรอกข้อมูลให้ครบ" });
      return;
    }

    setSaving(true);
    const result = await submitHrJson(
      "/api/hr/holidays",
      "POST",
      {
        workCalendarId: calendarId,
        holidayDate,
        name: name.trim(),
        holidayTypeId,
        isPaid,
      },
      "เพิ่มวันหยุดเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    if (onDone) {
      onDone();
      return;
    }

    setHolidayDate("");
    setName("");
    setIsPaid(true);
    setFeedback({ kind: "success", text: result.message });
    router.refresh();
  }

  return (
    <form
      className={embedded ? "hr-holiday-form-embedded" : "card"}
      onSubmit={handleSubmit}
      noValidate
    >
      {embedded ? null : <h2>เพิ่มวันหยุด</h2>}
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field
          id="hol-date"
          label="วันที่หยุด"
          required
          error={errors.holidayDate}
        >
          <ThaiDateInput
            {...fieldProps("hol-date", errors.holidayDate)}
            value={holidayDate}
            onChange={setHolidayDate}
            disabled={saving || disabled}
          />
        </Field>
        <Field id="hol-name" label="ชื่อวันหยุด" required error={errors.name}>
          <input
            {...fieldProps("hol-name", errors.name)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น วันสงกรานต์"
            disabled={saving || disabled}
          />
        </Field>
        <Field
          id="hol-type"
          label="ประเภท"
          required
          error={errors.holidayTypeId}
        >
          {holidayTypes.length === 0 ? (
            <p className="field-error">ยังไม่มีประเภทวันหยุดในระบบ</p>
          ) : (
            <select
              {...fieldProps("hol-type", errors.holidayTypeId)}
              value={holidayTypeId}
              onChange={(e) => setHolidayTypeId(e.target.value)}
              disabled={saving || disabled}
            >
              {holidayTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="field">
          <label className="checkbox-row" htmlFor="hol-paid">
            <input
              id="hol-paid"
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              disabled={saving || disabled}
            />
            <span>หยุดมีค่าจ้าง</span>
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled || holidayTypes.length === 0}
        >
          {saving ? "กำลังบันทึก…" : "เพิ่มวันหยุด"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={saving}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </form>
  );
}
