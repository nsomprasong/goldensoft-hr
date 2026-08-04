"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import { submitHrJson } from "@/components/hr/form-utils";
import type { EmployeeRoleState } from "@/lib/hr/services/employee-roles";

export default function EmployeeRoleTab({
  employeeId,
  initial,
  disabled = false,
}: {
  employeeId: string;
  initial: EmployeeRoleState;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(initial.available[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function assign() {
    if (!roleId) return;
    setBusy(true);
    setFeedback(null);
    const result = await submitHrJson(
      `/api/hr/employees/${employeeId}/roles`,
      "POST",
      { action: "assign", roleId },
      "กำหนดบทบาทเรียบร้อยแล้ว",
    );
    setBusy(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setFeedback({ kind: "success", text: result.message });
    router.refresh();
  }

  async function revoke(membershipRoleId: string, label: string) {
    if (!window.confirm(`ถอดบทบาท「${label}」หรือไม่?`)) return;
    setBusy(true);
    setFeedback(null);
    const result = await submitHrJson(
      `/api/hr/employees/${employeeId}/roles`,
      "POST",
      { action: "revoke", membershipRoleId },
      "ถอดบทบาทเรียบร้อยแล้ว",
    );
    setBusy(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setFeedback({ kind: "success", text: result.message });
    router.refresh();
  }

  return (
    <section className="hr-employee-tab-panel hr-employee-tab-panel--violet">
      <header className="hr-employee-tab-panel-head">
        <div>
          <h2>บทบาท</h2>
          <p>
            บทบาทบนแพลตฟอร์มกำหนดสิทธิ์การใช้งานระบบ เช่น เจ้าขององค์กร หรือพนักงาน
          </p>
        </div>
      </header>

      <div className="hr-settings-inner-card hr-employee-tab-panel-body">
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      {!initial.linked ? (
        <p className="empty">
          พนักงานยังไม่ได้เชื่อมบัญชีผู้ใช้บนแพลตฟอร์ม — ยังกำหนดบทบาทไม่ได้
        </p>
      ) : !initial.membershipId ? (
        <p className="empty">
          พบการเชื่อมบัญชีแล้ว แต่ยังไม่มีสมาชิกภาพในองค์กรนี้
        </p>
      ) : (
        <>
          <div className="hr-employee-tab-subsection">
          <h3>บทบาทปัจจุบัน</h3>
          {initial.assigned.length === 0 ? (
            <p className="empty">ยังไม่มีบทบาท</p>
          ) : (
            <ul className="hr-role-list">
              {initial.assigned.map((role) => (
                <li key={role.membershipRoleId} className="hr-role-item">
                  <span>{role.label}</span>
                  {initial.canAssign &&
                  (initial.canAssignPrivileged ||
                    !["OWNER", "ADMIN"].includes(role.code.toUpperCase())) ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() =>
                        revoke(role.membershipRoleId, role.label)
                      }
                      disabled={busy || disabled}
                    >
                      ถอดบทบาท
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          </div>

          {initial.canAssign ? (
            <div className="hr-role-assign hr-employee-tab-subsection">
              <h3>กำหนดบทบาท</h3>
              {initial.available.length === 0 ? (
                <p className="muted">กำหนดบทบาทที่มีได้ครบแล้ว</p>
              ) : (
                <div className="form-grid">
                  <Field id="roleId" label="บทบาท" required>
                    <select
                      {...fieldProps("roleId")}
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      disabled={busy || disabled}
                    >
                      {initial.available.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void assign()}
                      disabled={busy || disabled || !roleId}
                    >
                      {busy ? "กำลังบันทึก…" : "บันทึกบทบาท"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="field-hint">
              คุณไม่มีสิทธิ์กำหนดหรือถอดบทบาทของพนักงานคนนี้
            </p>
          )}
        </>
      )}
      </div>
    </section>
  );
}
