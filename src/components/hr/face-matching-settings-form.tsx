"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";
import type { AttendanceFaceSettingsRow } from "@/lib/hr/services/face-matching";
import type { FaceMatchMode } from "@/lib/hr/face-match";

const MODE_OPTIONS: { value: FaceMatchMode; label: string; hint: string }[] = [
  {
    value: "OFF",
    label: "ปิด",
    hint: "ไม่ตรวจใบหน้าตอนลงเวลา (ใช้แค่รูปหลักฐาน + GPS)",
  },
  {
    value: "WARN",
    label: "เตือน",
    hint: "ลงเวลาได้แม้ใบหน้าไม่ตรง แต่บันทึกคำเตือนไว้",
  },
  {
    value: "REQUIRE",
    label: "บังคับ",
    hint: "ต้องลงทะเบียนใบหน้าและจับคู่ผ่านก่อนลงเวลา",
  },
];

export default function FaceMatchingSettingsForm({
  initial,
  canEdit,
}: {
  initial: AttendanceFaceSettingsRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<FaceMatchMode>(initial.mode);
  const [matchThreshold, setMatchThreshold] = useState(
    String(initial.matchThreshold),
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    const threshold = Number(matchThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 2) {
      setFeedback({
        kind: "error",
        message: "เกณฑ์จับคู่ต้องอยู่ระหว่าง 0 ถึง 2 (แนะนำ 0.55)",
      });
      return;
    }

    setSaving(true);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    const result = await submitHrJson(
      "/api/hr/attendance/face-settings",
      "PATCH",
      { mode, matchThreshold: threshold },
      "บันทึกตั้งค่าตรวจใบหน้าเรียบร้อยแล้ว",
    );
    setSaving(false);

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }

    setFeedback({ kind: "success", message: result.message });
    router.refresh();
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <form className="card" onSubmit={handleSubmit} noValidate>
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          พนักงานลงทะเบียนใบหน้าก่อน แล้วระบบจะจับคู่ตอนลงเวลา
        </p>

        <div className="form-grid">
          <Field id="face-mode" label="โหมดตรวจใบหน้า" full required>
            <select
              {...fieldProps("face-mode")}
              value={mode}
              disabled={!canEdit || saving}
              onChange={(e) => setMode(e.target.value as FaceMatchMode)}
            >
              {MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="field-hint">
              {MODE_OPTIONS.find((o) => o.value === mode)?.hint}
            </p>
          </Field>

          <Field id="face-threshold" label="เกณฑ์จับคู่ (ระยะสูงสุด)" required>
            <input
              {...fieldProps("face-threshold")}
              type="number"
              min={0.1}
              max={2}
              step={0.05}
              value={matchThreshold}
              disabled={!canEdit || saving}
              onChange={(e) => setMatchThreshold(e.target.value)}
            />
            <p className="field-hint">
              ค่ายิ่งต่ำยิ่งเข้มงวด — ค่าเริ่มต้น 0.55
            </p>
          </Field>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canEdit || saving}
          >
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </>
  );
}
