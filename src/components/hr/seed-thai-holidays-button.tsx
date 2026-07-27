"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import Alert from "@/components/hr/alert";
import { submitHrJson } from "@/components/hr/form-utils";
import {
  currentGregorianYearBangkok,
  hasBuddhistHolidayTable,
  toBuddhistYear,
  fromBuddhistYear,
} from "@/lib/hr/thai-public-holidays";

export default function SeedThaiHolidaysButton({
  calendarId,
  disabled = false,
}: {
  calendarId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const defaultBe = toBuddhistYear(currentGregorianYearBangkok());
  const [buddhistYear, setBuddhistYear] = useState(defaultBe);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const yearOptions = useMemo(() => {
    const base = defaultBe;
    return [base - 1, base, base + 1, base + 2].filter(
      (y) => y >= 2560 && y <= 2600,
    );
  }, [defaultBe]);

  const gregorian = fromBuddhistYear(buddhistYear);
  const hasLunar = hasBuddhistHolidayTable(gregorian);

  async function run() {
    if (
      !window.confirm(
        `เพิ่มวันหยุดราชการไทยปี พ.ศ. ${buddhistYear} ลงในปฏิทินนี้หรือไม่?\nวันหยุดที่มีอยู่แล้วจะถูกข้าม`,
      )
    ) {
      return;
    }

    setFeedback(null);
    setBusy(true);
    const result = await submitHrJson(
      `/api/hr/calendars/${calendarId}/seed-thai-holidays`,
      "POST",
      { buddhistYear },
      "เพิ่มวันหยุดราชการเรียบร้อยแล้ว",
    );
    setBusy(false);

    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    const data = result.data as {
      created?: number;
      skipped?: number;
      total?: number;
      includesBuddhistLunar?: boolean;
    } | null;

    const created = data?.created ?? 0;
    const skipped = data?.skipped ?? 0;
    setFeedback({
      kind: created > 0 ? "success" : "warning",
      text:
        created > 0
          ? `เพิ่มแล้ว ${created} วัน${skipped > 0 ? ` (ข้าม ${skipped} วันที่มีอยู่แล้ว)` : ""}${
              data?.includesBuddhistLunar === false
                ? " — ปีนี้ยังไม่มีตารางวันพระในระบบ จะได้เฉพาะวันหยุดประจำปี"
                : ""
            }`
          : `ไม่มีการเพิ่มใหม่ (ข้าม ${skipped} วันที่มีอยู่แล้ว)`,
    });
    router.refresh();
  }

  return (
    <div className="seed-thai-holidays">
      <div className="seed-thai-holidays-row">
        <label htmlFor="seed-thai-year">
          ปี พ.ศ.
          <select
            id="seed-thai-year"
            value={buddhistYear}
            onChange={(e) => setBuddhistYear(Number(e.target.value))}
            disabled={busy || disabled}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
                {hasBuddhistHolidayTable(fromBuddhistYear(y))
                  ? ""
                  : " (เฉพาะวันประจำปี)"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={run}
          disabled={busy || disabled}
        >
          {busy ? "กำลังเพิ่ม…" : "เพิ่มวันหยุดราชการอัตโนมัติ"}
        </button>
      </div>
      <p className="muted" style={{ margin: "0.35rem 0 0" }}>
        ใส่วันหยุดราชการไทยให้ทั้งปี
        {hasLunar
          ? " รวมวันพระสำคัญ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา)"
          : " (ปีนี้ยังไม่มีตารางวันพระ — จะใส่เฉพาะวันหยุดประจำปี)"}
      </p>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}
    </div>
  );
}
