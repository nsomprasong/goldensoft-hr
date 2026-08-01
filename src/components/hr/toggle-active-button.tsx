"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { submitHrJson } from "@/components/hr/form-utils";

export type HrResource =
  | "employees"
  | "departments"
  | "positions"
  | "shifts"
  | "overtime-rules"
  | "payroll-schedules"
  | "work-locations";

const RESOURCE_LABEL: Record<HrResource, string> = {
  employees: "พนักงาน",
  departments: "แผนก",
  positions: "ตำแหน่ง",
  shifts: "กะงาน",
  "overtime-rules": "กฎ OT",
  "payroll-schedules": "รอบจ่าย",
  "work-locations": "สถานที่ทำงาน",
};

/**
 * Soft-deactivates or re-activates an HR record.
 *
 * Employees have a dedicated endpoint that also records a resignation status;
 * masters deactivate with DELETE and come back with an isActive patch. Payroll
 * schedules only expose PATCH, so both directions go through it.
 */
export default function ToggleActiveButton({
  resource,
  id,
  isActive,
  disabled = false,
}: {
  resource: HrResource;
  id: string;
  isActive: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const label = RESOURCE_LABEL[resource];
    const question = isActive
      ? `ยืนยันปิดการใช้งาน${label}นี้หรือไม่?`
      : `ยืนยันเปิดใช้งาน${label}นี้อีกครั้งหรือไม่?`;
    if (!window.confirm(question)) return;

    setError(null);
    setBusy(true);

    let result;
    if (!isActive) {
      result = await submitHrJson(
        `/api/hr/${resource}/${id}`,
        "PATCH",
        { isActive: true },
        `เปิดใช้งาน${label}เรียบร้อยแล้ว`,
      );
    } else if (resource === "employees") {
      result = await submitHrJson(
        `/api/hr/employees/${id}/deactivate`,
        "POST",
        {},
        "ปิดการใช้งานพนักงานเรียบร้อยแล้ว",
      );
    } else if (resource === "payroll-schedules") {
      result = await submitHrJson(
        `/api/hr/payroll-schedules/${id}`,
        "PATCH",
        { isActive: false },
        "ปิดการใช้งานรอบจ่ายเรียบร้อยแล้ว",
      );
    } else {
      result = await submitHrJson(
        `/api/hr/${resource}/${id}`,
        "DELETE",
        undefined,
        `ปิดการใช้งาน${label}เรียบร้อยแล้ว`,
      );
    }
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  // Re-activating a person means restoring an employment status, which belongs
  // on the edit form rather than a one-click toggle.
  if (resource === "employees" && !isActive) {
    return <span className="muted">แก้ไขสถานะได้ที่หน้าแก้ไขข้อมูล</span>;
  }

  return (
    <span className="inline-actions">
      <button
        type="button"
        className={isActive ? "btn btn-sm btn-danger" : "btn btn-sm"}
        onClick={run}
        disabled={busy || disabled}
      >
        {busy ? "กำลังดำเนินการ…" : isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
