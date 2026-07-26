"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import {
  compact,
  submitHrJson,
  validateCode,
  validateDate,
  validateEmail,
  validatePhone,
  validateUuid,
  requireSelect,
  requireText,
  type FieldErrors,
} from "@/components/hr/form-utils";

export type EmployeeFormValues = {
  employeeCode: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string;
  lastNameEn: string;
  displayName: string;
  phone: string;
  email: string;
  branchId: string;
  departmentId: string;
  positionId: string;
  employmentTypeId: string;
  employeeStatusId: string;
  hireDate: string;
  probationEndDate: string;
  notes: string;
};

export type EmployeeFormOption = { id: string; label: string };

const EMPTY_VALUES: EmployeeFormValues = {
  employeeCode: "",
  firstNameTh: "",
  lastNameTh: "",
  firstNameEn: "",
  lastNameEn: "",
  displayName: "",
  phone: "",
  email: "",
  branchId: "",
  departmentId: "",
  positionId: "",
  employmentTypeId: "",
  employeeStatusId: "",
  hireDate: "",
  probationEndDate: "",
  notes: "",
};

function validate(
  values: EmployeeFormValues,
  hasBranchOptions: boolean,
  mode: "create" | "edit",
) {
  const errors: FieldErrors = {
    // The employee code is immutable, so it is only validated on create.
    employeeCode: mode === "create" ? (validateCode(values.employeeCode) ?? "") : "",
    firstNameTh: requireText(values.firstNameTh) ?? "",
    lastNameTh: requireText(values.lastNameTh) ?? "",
    displayName: requireText(values.displayName) ?? "",
    phone: validatePhone(values.phone) ?? "",
    email: validateEmail(values.email) ?? "",
    branchId:
      (hasBranchOptions
        ? requireSelect(values.branchId)
        : validateUuid(values.branchId)) ?? "",
    employmentTypeId: requireSelect(values.employmentTypeId) ?? "",
    employeeStatusId: requireSelect(values.employeeStatusId) ?? "",
    hireDate: validateDate(values.hireDate, true) ?? "",
    probationEndDate: validateDate(values.probationEndDate) ?? "",
  };

  if (
    !errors.probationEndDate &&
    values.probationEndDate &&
    values.hireDate &&
    values.probationEndDate < values.hireDate
  ) {
    errors.probationEndDate = "วันสิ้นสุดทดลองงานต้องไม่ก่อนวันเริ่มงาน";
  }

  return compact(errors);
}

export default function EmployeeForm({
  mode,
  employeeId,
  initialValues,
  departments,
  positions,
  employmentTypes,
  employeeStatuses,
  branches,
  disabled = false,
}: {
  mode: "create" | "edit";
  employeeId?: string;
  initialValues?: Partial<EmployeeFormValues>;
  departments: EmployeeFormOption[];
  positions: EmployeeFormOption[];
  employmentTypes: EmployeeFormOption[];
  employeeStatuses: EmployeeFormOption[];
  branches: EmployeeFormOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<EmployeeFormValues>({
    ...EMPTY_VALUES,
    branchId: branches.length === 1 ? branches[0].id : "",
    ...initialValues,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function set<K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // Keep the display name in sync until the user types their own.
      if (
        (key === "firstNameTh" || key === "lastNameTh") &&
        (!prev.displayName ||
          prev.displayName === `${prev.firstNameTh} ${prev.lastNameTh}`.trim())
      ) {
        next.displayName = `${next.firstNameTh} ${next.lastNameTh}`.trim();
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nextErrors = validate(values, branches.length > 0, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({
        kind: "error",
        text: "กรุณาตรวจสอบข้อมูลที่ยังไม่ถูกต้อง",
      });
      return;
    }

    const payload = {
      firstNameTh: values.firstNameTh.trim(),
      lastNameTh: values.lastNameTh.trim(),
      firstNameEn: values.firstNameEn.trim() || null,
      lastNameEn: values.lastNameEn.trim() || null,
      displayName: values.displayName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim() || null,
      branchId: values.branchId.trim(),
      departmentId: values.departmentId || null,
      positionId: values.positionId || null,
      employmentTypeId: values.employmentTypeId,
      employeeStatusId: values.employeeStatusId,
      hireDate: values.hireDate,
      probationEndDate: values.probationEndDate || null,
      notes: values.notes.trim() || null,
    };

    setSaving(true);
    const result =
      mode === "create"
        ? await submitHrJson(
            "/api/hr/employees",
            "POST",
            { ...payload, employeeCode: values.employeeCode.trim() },
            "สร้างพนักงานเรียบร้อยแล้ว",
          )
        : await submitHrJson(
            `/api/hr/employees/${employeeId}`,
            "PATCH",
            payload,
            "บันทึกการแก้ไขเรียบร้อยแล้ว",
          );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors);
      setFeedback({ kind: "error", text: result.message });
      return;
    }

    setFeedback({ kind: "success", text: result.message });
    const createdId =
      result.data && typeof result.data === "object"
        ? ((result.data as { id?: string; employee?: { id?: string } }).id ??
          (result.data as { employee?: { id?: string } }).employee?.id)
        : undefined;

    router.refresh();
    if (mode === "create") {
      router.push(createdId ? `/employees/${createdId}` : "/employees");
    } else if (employeeId) {
      router.push(`/employees/${employeeId}`);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <div className="form-grid">
        <Field
          id="employeeCode"
          label="รหัสพนักงาน"
          required
          error={errors.employeeCode}
          hint={mode === "edit" ? "รหัสพนักงานแก้ไขไม่ได้" : undefined}
        >
          <input
            {...fieldProps("employeeCode", errors.employeeCode)}
            value={values.employeeCode}
            onChange={(e) => set("employeeCode", e.target.value)}
            placeholder="EMP-001"
            readOnly={mode === "edit"}
          />
        </Field>

        <Field
          id="firstNameTh"
          label="ชื่อ (ไทย)"
          required
          error={errors.firstNameTh}
        >
          <input
            {...fieldProps("firstNameTh", errors.firstNameTh)}
            value={values.firstNameTh}
            onChange={(e) => set("firstNameTh", e.target.value)}
          />
        </Field>

        <Field
          id="lastNameTh"
          label="นามสกุล (ไทย)"
          required
          error={errors.lastNameTh}
        >
          <input
            {...fieldProps("lastNameTh", errors.lastNameTh)}
            value={values.lastNameTh}
            onChange={(e) => set("lastNameTh", e.target.value)}
          />
        </Field>

        <Field id="firstNameEn" label="ชื่อ (อังกฤษ)">
          <input
            {...fieldProps("firstNameEn")}
            value={values.firstNameEn}
            onChange={(e) => set("firstNameEn", e.target.value)}
          />
        </Field>

        <Field id="lastNameEn" label="นามสกุล (อังกฤษ)">
          <input
            {...fieldProps("lastNameEn")}
            value={values.lastNameEn}
            onChange={(e) => set("lastNameEn", e.target.value)}
          />
        </Field>

        <Field
          id="displayName"
          label="ชื่อที่แสดง"
          required
          error={errors.displayName}
        >
          <input
            {...fieldProps("displayName", errors.displayName)}
            value={values.displayName}
            onChange={(e) => set("displayName", e.target.value)}
          />
        </Field>

        <Field id="phone" label="เบอร์โทรศัพท์" required error={errors.phone}>
          <input
            {...fieldProps("phone", errors.phone)}
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            inputMode="tel"
            placeholder="0812345678"
          />
        </Field>

        <Field id="email" label="อีเมล" error={errors.email}>
          <input
            {...fieldProps("email", errors.email)}
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            inputMode="email"
          />
        </Field>

        <Field
          id="branchId"
          label="สาขา"
          required
          error={errors.branchId}
          hint={
            branches.length === 0
              ? "ไม่พบสาขาในบริบทปัจจุบัน กรุณาระบุรหัสสาขา (UUID)"
              : undefined
          }
        >
          {branches.length > 0 ? (
            <select
              {...fieldProps("branchId", errors.branchId)}
              value={values.branchId}
              onChange={(e) => set("branchId", e.target.value)}
            >
              <option value="">— เลือกสาขา —</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...fieldProps("branchId", errors.branchId)}
              value={values.branchId}
              onChange={(e) => set("branchId", e.target.value)}
            />
          )}
        </Field>

        <Field id="departmentId" label="แผนก">
          <select
            {...fieldProps("departmentId")}
            value={values.departmentId}
            onChange={(e) => set("departmentId", e.target.value)}
          >
            <option value="">— ไม่ระบุ —</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="positionId" label="ตำแหน่ง">
          <select
            {...fieldProps("positionId")}
            value={values.positionId}
            onChange={(e) => set("positionId", e.target.value)}
          >
            <option value="">— ไม่ระบุ —</option>
            {positions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="employmentTypeId"
          label="ประเภทการจ้าง"
          required
          error={errors.employmentTypeId}
        >
          <select
            {...fieldProps("employmentTypeId", errors.employmentTypeId)}
            value={values.employmentTypeId}
            onChange={(e) => set("employmentTypeId", e.target.value)}
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
          id="employeeStatusId"
          label="สถานะพนักงาน"
          required
          error={errors.employeeStatusId}
        >
          <select
            {...fieldProps("employeeStatusId", errors.employeeStatusId)}
            value={values.employeeStatusId}
            onChange={(e) => set("employeeStatusId", e.target.value)}
          >
            <option value="">— เลือกสถานะ —</option>
            {employeeStatuses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="hireDate" label="วันเริ่มงาน" required error={errors.hireDate}>
          <input
            {...fieldProps("hireDate", errors.hireDate)}
            type="date"
            value={values.hireDate}
            onChange={(e) => set("hireDate", e.target.value)}
          />
        </Field>

        <Field
          id="probationEndDate"
          label="วันสิ้นสุดทดลองงาน"
          error={errors.probationEndDate}
        >
          <input
            {...fieldProps("probationEndDate", errors.probationEndDate)}
            type="date"
            value={values.probationEndDate}
            onChange={(e) => set("probationEndDate", e.target.value)}
          />
        </Field>

        <Field id="notes" label="หมายเหตุ" full>
          <textarea
            {...fieldProps("notes")}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || disabled}
        >
          {saving
            ? "กำลังบันทึก…"
            : mode === "create"
              ? "สร้างพนักงาน"
              : "บันทึกการแก้ไข"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => router.back()}
          disabled={saving}
        >
          ยกเลิก
        </button>
      </div>

      {disabled ? (
        <p className="field-hint">
          ฐานข้อมูล HR ยังไม่พร้อม — บันทึกได้หลังอนุมัติ migration
        </p>
      ) : null}
    </form>
  );
}
