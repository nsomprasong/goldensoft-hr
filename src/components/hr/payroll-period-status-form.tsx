"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";

export default function PayrollPeriodStatusForm({
  periodId,
  currentStatusCode,
  statuses,
  disabled = false,
}: {
  periodId: string;
  currentStatusCode: string;
  statuses: Array<{ code: string; label: string }>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [statusCode, setStatusCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    if (!statusCode) {
      setError("กรุณาเลือกสถานะ");
      return;
    }
    if (statusCode === currentStatusCode) {
      setError("สถานะใหม่ต้องต่างจากสถานะปัจจุบัน");
      return;
    }

    setSaving(true);
    const result = await submitHrJson(
      `/api/hr/payroll-periods/${periodId}`,
      "PATCH",
      { statusCode },
      "เปลี่ยนสถานะงวดเงินเดือนเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setError(result.fieldErrors.statusCode ?? null);
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setFeedback({ kind: "success", text: result.message });
    router.refresh();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h3>เปลี่ยนสถานะงวด</h3>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field id="period-statusCode" label="สถานะใหม่" required error={error}>
          <select
            {...fieldProps("period-statusCode", error)}
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
          >
            <option value="">— เลือกสถานะ —</option>
            {statuses.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled}
        >
          {saving ? "กำลังบันทึก…" : "เปลี่ยนสถานะ"}
        </button>
      </div>
    </form>
  );
}
