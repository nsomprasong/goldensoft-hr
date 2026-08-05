"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import Alert from "@/components/hr/alert";
import CompensationForm from "@/components/hr/compensation-form";
import EmployeePhotoPicker, {
  clearEmployeePhoto,
  uploadEmployeePhoto,
} from "@/components/hr/employee-photo-picker";
import Field, { fieldProps } from "@/components/hr/field";
import ThaiDateInput from "@/components/hr/thai-date-input";
import {
  compact,
  requireSelect,
  requireText,
  submitHrJson,
  validateDate,
  validateEmail,
  validatePhone,
  type FieldErrors,
} from "@/components/hr/form-utils";
import { formatThaiDate } from "@/lib/hr/thai-date";
import type { EmployeeRoleState } from "@/lib/hr/services/employee-roles";

export type EmployeeOption = { id: string; label: string };

export type EmployeeTabEmployee = {
  id: string;
  displayName: string;
  firstNameTh: string;
  lastNameTh: string;
  photoUrl: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  branchId: string;
  departmentId: string | null;
  positionId: string | null;
  employmentTypeId: string;
  employeeStatusId: string;
  hireDate: string;
  probationEndDate: string | null;
  resignationDate: string | null;
  departmentNameTh: string | null;
  positionNameTh: string | null;
  employmentTypeNameTh: string;
  statusNameTh: string;
  isActive: boolean;
};

export type CompensationRowView = {
  id: string;
  wageTypeId: string;
  wageTypeNameTh: string;
  amount: string;
  amountValue: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  overtimeEligible: boolean;
  isCurrent: boolean;
};

function SectionChrome({
  title,
  description,
  tone = "amber",
  editing,
  canEdit,
  onEdit,
  onCancel,
  children,
}: {
  title: string;
  description?: string;
  tone?: "amber" | "blue" | "green" | "violet" | "rose";
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`hr-employee-tab-panel hr-employee-tab-panel--${tone}`}>
      <header className="hr-employee-tab-panel-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {canEdit ? (
          editing ? (
            <button type="button" className="btn btn-sm" onClick={onCancel}>
              ยกเลิก
            </button>
          ) : (
            <button type="button" className="btn btn-sm" onClick={onEdit}>
              แก้ไข
            </button>
          )
        ) : null}
      </header>
      <div className="hr-settings-inner-card hr-employee-tab-panel-body">
        {children}
      </div>
    </section>
  );
}

export function EmployeeGeneralTab({
  employee,
  canEdit,
  disabled = false,
}: {
  employee: EmployeeTabEmployee;
  canEdit: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    firstNameTh: employee.firstNameTh,
    lastNameTh: employee.lastNameTh,
    displayName: employee.displayName,
    phone: employee.phone,
    email: employee.email ?? "",
    notes: employee.notes ?? "",
    photoUrl: employee.photoUrl ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function reset() {
    setValues({
      firstNameTh: employee.firstNameTh,
      lastNameTh: employee.lastNameTh,
      displayName: employee.displayName,
      phone: employee.phone,
      email: employee.email ?? "",
      notes: employee.notes ?? "",
      photoUrl: employee.photoUrl ?? "",
    });
    setPhotoFile(null);
    setPhotoCleared(false);
    setErrors({});
    setFeedback(null);
    setEditing(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    const nextErrors = compact({
      firstNameTh: requireText(values.firstNameTh) ?? "",
      lastNameTh: requireText(values.lastNameTh) ?? "",
      displayName: requireText(values.displayName) ?? "",
      phone: validatePhone(values.phone) ?? "",
      email: validateEmail(values.email) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    setSaving(true);
    try {
      const result = await submitHrJson(
        `/api/hr/employees/${employee.id}`,
        "PATCH",
        {
          firstNameTh: values.firstNameTh.trim(),
          lastNameTh: values.lastNameTh.trim(),
          displayName: values.displayName.trim(),
          phone: values.phone.trim(),
          email: values.email.trim() || null,
          notes: values.notes.trim() || null,
        },
        "บันทึกข้อมูลทั่วไปเรียบร้อยแล้ว",
      );

      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFeedback({ kind: "error", text: result.message });
        return;
      }

      if (photoFile) {
        const upload = await uploadEmployeePhoto(employee.id, photoFile);
        if (!upload.ok) {
          setFeedback({ kind: "error", text: upload.message });
          return;
        }
        if (upload.photoUrl) {
          setValues((v) => ({ ...v, photoUrl: upload.photoUrl ?? "" }));
        }
      } else if (photoCleared) {
        const cleared = await clearEmployeePhoto(employee.id);
        if (!cleared.ok) {
          setFeedback({ kind: "error", text: cleared.message });
          return;
        }
        setValues((v) => ({ ...v, photoUrl: "" }));
      }

      setFeedback({ kind: "success", text: result.message });
      setEditing(false);
      setPhotoFile(null);
      setPhotoCleared(false);
      router.refresh();
    } catch (err) {
      setFeedback({
        kind: "error",
        text:
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : "บันทึกไม่สำเร็จ กรุณาลองใหม่",
      });
    } finally {
      setSaving(false);
    }
  }

  const shownPhoto =
    photoCleared && !photoFile ? null : values.photoUrl || null;

  return (
    <SectionChrome
      title="ข้อมูลทั่วไป"
      description="ชื่อ ช่องทางติดต่อ และรูปโปรไฟล์พนักงาน"
      tone="amber"
      editing={editing}
      canEdit={canEdit}
      onEdit={() => setEditing(true)}
      onCancel={reset}
    >
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      {!editing ? (
        <dl className="dl">
          <dt>ชื่อ-นามสกุล</dt>
          <dd>
            {employee.firstNameTh} {employee.lastNameTh}
          </dd>
          <dt>ชื่อที่แสดง</dt>
          <dd>{employee.displayName}</dd>
          <dt>เบอร์โทรศัพท์</dt>
          <dd>{employee.phone}</dd>
          <dt>อีเมล</dt>
          <dd>{employee.email ?? "—"}</dd>
          <dt>หมายเหตุ</dt>
          <dd>{employee.notes ?? "—"}</dd>
        </dl>
      ) : (
        <form method="post" onSubmit={save} noValidate>
          <EmployeePhotoPicker
            displayName={values.displayName || "พนักงาน"}
            savedPhotoUrl={shownPhoto}
            disabled={disabled || saving}
            onFileChange={(file) => {
              setPhotoFile(file);
              setPhotoCleared(!file);
            }}
          />
          <div className="form-grid">
            <Field
              id="g-firstNameTh"
              label="ชื่อ"
              required
              error={errors.firstNameTh}
            >
              <input
                {...fieldProps("g-firstNameTh", errors.firstNameTh)}
                value={values.firstNameTh}
                onChange={(e) =>
                  setValues((v) => ({ ...v, firstNameTh: e.target.value }))
                }
              />
            </Field>
            <Field
              id="g-lastNameTh"
              label="นามสกุล"
              required
              error={errors.lastNameTh}
            >
              <input
                {...fieldProps("g-lastNameTh", errors.lastNameTh)}
                value={values.lastNameTh}
                onChange={(e) =>
                  setValues((v) => ({ ...v, lastNameTh: e.target.value }))
                }
              />
            </Field>
            <Field
              id="g-displayName"
              label="ชื่อที่แสดง"
              required
              error={errors.displayName}
            >
              <input
                {...fieldProps("g-displayName", errors.displayName)}
                value={values.displayName}
                onChange={(e) =>
                  setValues((v) => ({ ...v, displayName: e.target.value }))
                }
              />
            </Field>
            <Field id="g-phone" label="เบอร์โทรศัพท์" required error={errors.phone}>
              <input
                {...fieldProps("g-phone", errors.phone)}
                value={values.phone}
                onChange={(e) =>
                  setValues((v) => ({ ...v, phone: e.target.value }))
                }
              />
            </Field>
            <Field id="g-email" label="อีเมล" error={errors.email}>
              <input
                {...fieldProps("g-email", errors.email)}
                value={values.email}
                onChange={(e) =>
                  setValues((v) => ({ ...v, email: e.target.value }))
                }
              />
            </Field>
            <Field id="g-notes" label="หมายเหตุ" full>
              <textarea
                {...fieldProps("g-notes")}
                value={values.notes}
                onChange={(e) =>
                  setValues((v) => ({ ...v, notes: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || disabled}
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      )}
    </SectionChrome>
  );
}

export function EmployeeBranchTab({
  employee,
  branches,
  branchName,
  canEdit,
  disabled = false,
}: {
  employee: EmployeeTabEmployee;
  branches: EmployeeOption[];
  branchName: string;
  canEdit: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [branchId, setBranchId] = useState(employee.branchId);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function reset() {
    setBranchId(employee.branchId);
    setErrors({});
    setFeedback(null);
    setEditing(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    const nextErrors = compact({
      branchId: requireSelect(branchId) ?? "",
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาเลือกสาขา" });
      return;
    }
    setSaving(true);
    const result = await submitHrJson(
      `/api/hr/employees/${employee.id}`,
      "PATCH",
      { branchId },
      "ย้ายสาขาเรียบร้อยแล้ว — login ครั้งถัดไปจะเข้าสาขาใหม่ทันที",
    );
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setFeedback({ kind: "success", text: result.message });
    setEditing(false);
    router.refresh();
  }

  return (
    <SectionChrome
      title="สาขา"
      description="สาขาที่พนักงานสังกัดในองค์กรนี้"
      tone="blue"
      editing={editing}
      canEdit={canEdit}
      onEdit={() => setEditing(true)}
      onCancel={reset}
    >
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}
      {!editing ? (
        <dl className="dl">
          <dt>สาขาที่สังกัด</dt>
          <dd>{branchName}</dd>
        </dl>
      ) : (
        <form onSubmit={save} noValidate>
          <div className="form-grid">
            <Field
              id="b-branchId"
              label="สาขา"
              required
              error={errors.branchId}
            >
              <select
                {...fieldProps("b-branchId", errors.branchId)}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={branches.length === 0}
              >
                <option value="">— เลือกสาขา —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
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
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      )}
    </SectionChrome>
  );
}

export function EmployeeEmploymentTab({
  employee,
  departments,
  positions,
  roleState,
  employmentTypes,
  employeeStatuses,
  compensations,
  wageTypes,
  canEdit,
  canReadCompensation,
  canManageCompensation,
  disabled = false,
}: {
  employee: EmployeeTabEmployee;
  departments: EmployeeOption[];
  positions: Array<EmployeeOption & { defaultRoleId: string | null }>;
  roleState: EmployeeRoleState | null;
  employmentTypes: EmployeeOption[];
  employeeStatuses: EmployeeOption[];
  compensations: CompensationRowView[];
  wageTypes: EmployeeOption[];
  canEdit: boolean;
  canReadCompensation: boolean;
  canManageCompensation: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const employmentFormRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    departmentId: employee.departmentId ?? "",
    positionId: employee.positionId ?? "",
    employmentTypeId: employee.employmentTypeId,
    employeeStatusId: employee.employeeStatusId,
    hireDate: employee.hireDate,
    probationEndDate: employee.probationEndDate ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [roleChoice, setRoleChoice] = useState<"KEEP_EXISTING" | "POSITION_RECOMMENDATION" | "MANUAL_ASSIGNMENT">("KEEP_EXISTING");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function reset() {
    setValues({
      departmentId: employee.departmentId ?? "",
      positionId: employee.positionId ?? "",
      employmentTypeId: employee.employmentTypeId,
      employeeStatusId: employee.employeeStatusId,
      hireDate: employee.hireDate,
      probationEndDate: employee.probationEndDate ?? "",
    });
    setErrors({});
    setFeedback(null);
    setEditing(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    const nextErrors = compact({
      employmentTypeId: requireSelect(values.employmentTypeId) ?? "",
      employeeStatusId: requireSelect(values.employeeStatusId) ?? "",
      hireDate: validateDate(values.hireDate, true) ?? "",
      probationEndDate: validateDate(values.probationEndDate) ?? "",
    });
    if (
      !nextErrors.probationEndDate &&
      values.probationEndDate &&
      values.hireDate &&
      values.probationEndDate < values.hireDate
    ) {
      nextErrors.probationEndDate = "วันสิ้นสุดทดลองงานต้องไม่ก่อนวันเริ่มงาน";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ kind: "error", text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง" });
      return;
    }

    setSaving(true);
    const recommendedRoleId = positions.find((position) => position.id === values.positionId)?.defaultRoleId ?? "";
    const nextRoleId = roleChoice === "KEEP_EXISTING" ? "" : roleChoice === "POSITION_RECOMMENDATION" ? recommendedRoleId : selectedRoleId;
    if (nextRoleId && !confirmRoleChange) { setSaving(false); setConfirmRoleChange(true); return; }
    const result = await submitHrJson(
      `/api/hr/employees/${employee.id}`,
      "PATCH",
      {
        departmentId: values.departmentId || null,
        positionId: values.positionId || null,
        employmentTypeId: values.employmentTypeId,
        employeeStatusId: values.employeeStatusId,
        hireDate: values.hireDate,
        probationEndDate: values.probationEndDate || null,
        roleId: nextRoleId || null,
        roleAssignmentSource: roleChoice,
      },
      "บันทึกการจ้างเรียบร้อยแล้ว",
    );
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }
    setFeedback({ kind: "success", text: result.message });
    setEditing(false);
    router.refresh();
  }

  return (
    <>
      <SectionChrome
        title="การจ้าง"
        description="ประเภทการจ้าง แผนก ตำแหน่ง และสถานะ"
        tone="green"
        editing={editing}
        canEdit={canEdit}
        onEdit={() => setEditing(true)}
        onCancel={reset}
      >
        {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

        {!editing ? (
          <dl className="dl">
            <dt>ประเภทการจ้าง</dt>
            <dd>{employee.employmentTypeNameTh}</dd>
            <dt>แผนก</dt>
            <dd>{employee.departmentNameTh ?? "—"}</dd>
            <dt>ตำแหน่ง</dt>
            <dd>{employee.positionNameTh ?? "—"}</dd>
            <dt>วันเริ่มงาน</dt>
            <dd>{formatThaiDate(employee.hireDate)}</dd>
            <dt>วันสิ้นสุดทดลองงาน</dt>
            <dd>{formatThaiDate(employee.probationEndDate)}</dd>
            <dt>วันลาออก</dt>
            <dd>{formatThaiDate(employee.resignationDate)}</dd>
            <dt>สถานะ</dt>
            <dd>
              <span
                className={
                  employee.isActive ? "badge badge-active" : "badge badge-inactive"
                }
              >
                {employee.statusNameTh}
              </span>
            </dd>
          </dl>
        ) : (
          <form ref={employmentFormRef} onSubmit={save} noValidate>
            <div className="form-grid">
              <Field
                id="e-employmentTypeId"
                label="ประเภทการจ้าง"
                required
                error={errors.employmentTypeId}
              >
                <select
                  {...fieldProps("e-employmentTypeId", errors.employmentTypeId)}
                  value={values.employmentTypeId}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      employmentTypeId: e.target.value,
                    }))
                  }
                >
                  <option value="">— เลือกประเภท —</option>
                  {employmentTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="e-employeeStatusId"
                label="สถานะพนักงาน"
                required
                error={errors.employeeStatusId}
              >
                <select
                  {...fieldProps("e-employeeStatusId", errors.employeeStatusId)}
                  value={values.employeeStatusId}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      employeeStatusId: e.target.value,
                    }))
                  }
                >
                  <option value="">— เลือกสถานะ —</option>
                  {employeeStatuses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="e-departmentId" label="แผนก">
                <select
                  {...fieldProps("e-departmentId")}
                  value={values.departmentId}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, departmentId: e.target.value }))
                  }
                >
                  <option value="">— ไม่ระบุ —</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="e-positionId" label="ตำแหน่ง">
                <select
                  {...fieldProps("e-positionId")}
                  value={values.positionId}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, positionId: e.target.value }))
                  }
                >
                  <option value="">— ไม่ระบุ —</option>
                  {positions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              {values.positionId !== (employee.positionId ?? "") ? (
                <Field id="e-roleChoice" label="บทบาทหลังเปลี่ยนตำแหน่ง" full hint="ค่าเริ่มต้นคือใช้บทบาทเดิม ระบบจะไม่เปลี่ยนบทบาทโดยอัตโนมัติ">
                  <select value={roleChoice} onChange={(event) => setRoleChoice(event.target.value as typeof roleChoice)}>
                    <option value="KEEP_EXISTING">ใช้บทบาทเดิม</option>
                    <option value="POSITION_RECOMMENDATION" disabled={!positions.find((position) => position.id === values.positionId)?.defaultRoleId}>เปลี่ยนเป็นบทบาทที่แนะนำ</option>
                    <option value="MANUAL_ASSIGNMENT">เลือกบทบาทอื่น</option>
                  </select>
                  <p className="field-hint">บทบาทปัจจุบัน: {roleState?.assigned.map((role) => role.label).join(", ") || "ยังไม่มีบทบาท"}</p>
                  <p className="field-hint">บทบาทที่ตำแหน่งใหม่แนะนำ: {roleState?.available.find((role) => role.id === positions.find((position) => position.id === values.positionId)?.defaultRoleId)?.label ?? "ยังไม่ได้กำหนดบทบาทหลัก"}</p>
                  {roleChoice === "MANUAL_ASSIGNMENT" ? <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}><option value="">— เลือกบทบาทอื่น —</option>{(roleState?.assigned ?? []).map((role) => <option key={role.roleId} value={role.roleId}>{role.label}</option>)}{(roleState?.available ?? []).map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select> : null}
                </Field>
              ) : null}
              <Field
                id="e-hireDate"
                label="วันเริ่มงาน"
                required
                error={errors.hireDate}
              >
                <ThaiDateInput
                  id="e-hireDate"
                  value={values.hireDate}
                  onChange={(value) =>
                    setValues((v) => ({ ...v, hireDate: value }))
                  }
                  required
                  aria-invalid={Boolean(errors.hireDate)}
                />
              </Field>
              <Field
                id="e-probationEndDate"
                label="วันสิ้นสุดทดลองงาน"
                error={errors.probationEndDate}
              >
                <ThaiDateInput
                  id="e-probationEndDate"
                  value={values.probationEndDate}
                  onChange={(value) =>
                    setValues((v) => ({ ...v, probationEndDate: value }))
                  }
                  aria-invalid={Boolean(errors.probationEndDate)}
                />
              </Field>
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || disabled}
              >
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </form>
        )}
        {confirmRoleChange ? <div className="hr-overlay" role="dialog" aria-modal="true"><div className="hr-overlay-backdrop" /><div className="hr-overlay-panel"><div className="hr-overlay-body"><h3>ยืนยันการเปลี่ยนบทบาทพนักงาน</h3><p>สิทธิ์การใช้งานของพนักงานจะเปลี่ยนทันทีหลังบันทึก</p><div className="form-actions"><button className="btn btn-primary" type="button" onClick={() => requestAnimationFrame(() => employmentFormRef.current?.requestSubmit())}>ยืนยันการเปลี่ยนบทบาท</button><button className="btn" type="button" onClick={() => setConfirmRoleChange(false)}>ยกเลิก</button></div></div></div></div> : null}
      </SectionChrome>

      {canReadCompensation || canManageCompensation ? (
        <>
          {canManageCompensation ? (
            <CompensationForm
              employeeId={employee.id}
              wageTypes={wageTypes}
              current={(() => {
                const current =
                  compensations.find((row) => row.isCurrent) ??
                  compensations[0] ??
                  null;
                if (!current) return null;
                return {
                  wageTypeId: current.wageTypeId,
                  amount: current.amountValue,
                  currency: current.currency,
                  effectiveFrom: current.effectiveFrom,
                  overtimeEligible: current.overtimeEligible,
                };
              })()}
              disabled={disabled}
            />
          ) : null}

          {canReadCompensation && compensations.length > 1 ? (
            <section className="hr-employee-tab-panel hr-employee-tab-panel--green">
              <header className="hr-employee-tab-panel-head">
                <div>
                  <h2>ประวัติค่าจ้าง</h2>
                  <p>รายการค่าจ้างที่เคยมีผลกับพนักงานคนนี้</p>
                </div>
              </header>
              <div className="hr-settings-inner-card hr-employee-tab-panel-body">
              <div className="table-wrap table-wrap--fit">
                <table>
                  <thead>
                    <tr>
                      <th>ประเภท</th>
                      <th>จำนวน</th>
                      <th>มีผลตั้งแต่</th>
                      <th>สิ้นสุด</th>
                      <th>OT</th>
                      <th>ปัจจุบัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensations.map((row) => (
                      <tr key={row.id}>
                        <td>{row.wageTypeNameTh}</td>
                        <td>
                          {row.amount} {row.currency}
                        </td>
                        <td className="nowrap">
                          {formatThaiDate(row.effectiveFrom)}
                        </td>
                        <td className="nowrap">
                          {formatThaiDate(row.effectiveTo)}
                        </td>
                        <td>{row.overtimeEligible ? "ได้" : "ไม่ได้"}</td>
                        <td>{row.isCurrent ? "ใช่" : "ไม่ใช่"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </section>
          ) : null}

          {!canManageCompensation &&
          canReadCompensation &&
          compensations.length === 0 ? (
            <section className="hr-employee-tab-panel hr-employee-tab-panel--green">
              <header className="hr-employee-tab-panel-head">
                <div>
                  <h2>ค่าตอบแทน</h2>
                </div>
              </header>
              <div className="hr-settings-inner-card hr-employee-tab-panel-body">
                <p className="empty">ยังไม่มีประวัติค่าจ้าง</p>
              </div>
            </section>
          ) : null}

          {!canManageCompensation &&
          canReadCompensation &&
          compensations.length === 1 ? (
            <section className="hr-employee-tab-panel hr-employee-tab-panel--green">
              <header className="hr-employee-tab-panel-head">
                <div>
                  <h2>ค่าตอบแทน</h2>
                </div>
              </header>
              <div className="hr-settings-inner-card hr-employee-tab-panel-body">
              <dl className="dl">
                <dt>ประเภท</dt>
                <dd>{compensations[0].wageTypeNameTh}</dd>
                <dt>จำนวน</dt>
                <dd>
                  {compensations[0].amount} {compensations[0].currency}
                </dd>
                <dt>มีผลตั้งแต่</dt>
                <dd>{formatThaiDate(compensations[0].effectiveFrom)}</dd>
              </dl>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
