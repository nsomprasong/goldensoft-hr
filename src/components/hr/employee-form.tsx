"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@/components/hr/alert";
import EmployeePhotoPicker, {
  clearEmployeePhoto,
  uploadEmployeePhoto,
} from "@/components/hr/employee-photo-picker";
import Field, { fieldProps } from "@/components/hr/field";
import ThaiDateInput from "@/components/hr/thai-date-input";
import {
  compact,
  submitHrJson,
  validateDate,
  validateEmail,
  validatePhone,
  validatePositiveNumber,
  requireSelect,
  requireText,
  type FieldErrors,
} from "@/components/hr/form-utils";

export type EmployeeFormValues = {
  firstNameTh: string;
  lastNameTh: string;
  displayName: string;
  /** Saved API path only — never typed as a public URL by the user. */
  photoUrl: string;
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
  firstNameTh: "",
  lastNameTh: "",
  displayName: "",
  photoUrl: "",
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
  compensation: {
    enabled: boolean;
    wageTypeId: string;
    amount: string;
    effectiveFrom: string;
  },
) {
  const errors: FieldErrors = {
    firstNameTh: requireText(values.firstNameTh) ?? "",
    lastNameTh: requireText(values.lastNameTh) ?? "",
    displayName: requireText(values.displayName) ?? "",
    phone: validatePhone(values.phone) ?? "",
    email: validateEmail(values.email) ?? "",
    branchId: requireSelect(values.branchId) ?? "",
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

  if (compensation.enabled) {
    errors.wageTypeId = requireSelect(compensation.wageTypeId) ?? "";
    errors.amount =
      validatePositiveNumber(compensation.amount, { allowZero: false }) ?? "";
    errors.effectiveFrom =
      validateDate(compensation.effectiveFrom, true) ?? "";
  }

  return compact(errors);
}

function extractEmployeeId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const root = data as { id?: string; employee?: { id?: string } };
  return root.employee?.id ?? root.id;
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
  wageTypes = [],
  includeCompensation = false,
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
  wageTypes?: EmployeeFormOption[];
  includeCompensation?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<EmployeeFormValues>({
    ...EMPTY_VALUES,
    branchId: branches.length === 1 ? branches[0].id : "",
    ...initialValues,
  });
  const [comp, setComp] = useState({
    wageTypeId: "",
    amount: "",
    currency: "THB",
    effectiveFrom: "",
    overtimeEligible: true,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCleared, setPhotoCleared] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const showCompensation = mode === "create" && includeCompensation;

  function set<K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (
        (key === "firstNameTh" || key === "lastNameTh") &&
        (!prev.displayName ||
          prev.displayName === `${prev.firstNameTh} ${prev.lastNameTh}`.trim())
      ) {
        next.displayName = `${next.firstNameTh} ${next.lastNameTh}`.trim();
      }
      if (key === "hireDate" && !comp.effectiveFrom) {
        setComp((c) => ({ ...c, effectiveFrom: String(value) }));
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nextErrors = validate(values, {
      enabled: showCompensation,
      wageTypeId: comp.wageTypeId,
      amount: comp.amount,
      effectiveFrom: comp.effectiveFrom || values.hireDate,
    });
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
      firstNameEn: null,
      lastNameEn: null,
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
    try {
      const result =
        mode === "create"
          ? await submitHrJson(
              "/api/hr/employees",
              "POST",
              payload,
              "สร้างพนักงานเรียบร้อยแล้ว",
            )
          : await submitHrJson(
              `/api/hr/employees/${employeeId}`,
              "PATCH",
              payload,
              "บันทึกการแก้ไขเรียบร้อยแล้ว",
            );

      if (!result.ok) {
        setErrors(result.fieldErrors);
        setFeedback({ kind: "error", text: result.message });
        return;
      }

      const savedId =
        mode === "create" ? extractEmployeeId(result.data) : employeeId;

      if (savedId && photoFile) {
        const upload = await uploadEmployeePhoto(savedId, photoFile);
        if (!upload.ok) {
          setFeedback({
            kind: "error",
            text: `${result.message} แต่${upload.message}`,
          });
          router.refresh();
          if (mode === "create") {
            router.push(`/hr/employees/${savedId}`);
          }
          return;
        }
        if (upload.photoUrl) {
          setValues((prev) => ({ ...prev, photoUrl: upload.photoUrl ?? "" }));
        }
        setPhotoFile(null);
        setPhotoCleared(false);
      } else if (savedId && photoCleared && mode === "edit") {
        const cleared = await clearEmployeePhoto(savedId);
        if (!cleared.ok) {
          setFeedback({
            kind: "error",
            text: `${result.message} แต่${cleared.message}`,
          });
          router.refresh();
          return;
        }
        setValues((prev) => ({ ...prev, photoUrl: "" }));
        setPhotoCleared(false);
      }

      if (savedId && showCompensation) {
        const compResult = await submitHrJson(
          `/api/hr/employees/${savedId}/compensations`,
          "POST",
          {
            wageTypeId: comp.wageTypeId,
            amount: Number(comp.amount),
            currency: comp.currency.trim().toUpperCase() || "THB",
            effectiveFrom: comp.effectiveFrom || values.hireDate,
            overtimeEligible: comp.overtimeEligible,
          },
          "บันทึกค่าจ้างเรียบร้อยแล้ว",
        );
        if (!compResult.ok) {
          setFeedback({
            kind: "error",
            text: `${result.message} แต่บันทึกค่าตอบแทนไม่สำเร็จ: ${compResult.message}`,
          });
          router.push(`/hr/employees/${savedId}?tab=employment`);
          return;
        }
      }

      setFeedback({ kind: "success", text: result.message });
      router.refresh();
      if (mode === "create") {
        router.push(savedId ? `/hr/employees/${savedId}` : "/hr/employees");
      }
      // Edit stays on the same page — avoid push+refresh which can freeze the shell.
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

  const shownPhotoUrl =
    photoCleared && !photoFile ? null : values.photoUrl || null;

  return (
    <form className="card" method="post" onSubmit={handleSubmit} noValidate>
      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      <EmployeePhotoPicker
        displayName={values.displayName || "พนักงาน"}
        savedPhotoUrl={shownPhotoUrl}
        disabled={disabled || saving}
        onFileChange={(file) => {
          setPhotoFile(file);
          if (file) {
            setPhotoCleared(false);
          } else {
            setPhotoCleared(true);
          }
        }}
      />

      <div className="form-grid">
        <Field
          id="firstNameTh"
          label="ชื่อ"
          required
          error={errors.firstNameTh}
        >
          <input
            {...fieldProps("firstNameTh", errors.firstNameTh)}
            value={values.firstNameTh}
            onChange={(e) => set("firstNameTh", e.target.value)}
            placeholder="พิมพ์ได้ทั้งไทยและอังกฤษ"
          />
        </Field>

        <Field
          id="lastNameTh"
          label="นามสกุล"
          required
          error={errors.lastNameTh}
        >
          <input
            {...fieldProps("lastNameTh", errors.lastNameTh)}
            value={values.lastNameTh}
            onChange={(e) => set("lastNameTh", e.target.value)}
            placeholder="พิมพ์ได้ทั้งไทยและอังกฤษ"
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
              ? "ไม่พบสาขาในองค์กร — ตั้งค่าสาขาบนแพลตฟอร์มก่อน"
              : undefined
          }
        >
          <select
            {...fieldProps("branchId", errors.branchId)}
            value={values.branchId}
            onChange={(e) => set("branchId", e.target.value)}
            disabled={branches.length === 0}
          >
            <option value="">— เลือกสาขา —</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.label}
              </option>
            ))}
          </select>
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
          <ThaiDateInput
            id="hireDate"
            value={values.hireDate}
            onChange={(value) => set("hireDate", value)}
            required
            aria-invalid={Boolean(errors.hireDate)}
          />
        </Field>

        <Field
          id="probationEndDate"
          label="วันสิ้นสุดทดลองงาน"
          error={errors.probationEndDate}
        >
          <ThaiDateInput
            id="probationEndDate"
            value={values.probationEndDate}
            onChange={(value) => set("probationEndDate", value)}
            aria-invalid={Boolean(errors.probationEndDate)}
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

      {showCompensation ? (
        <>
          <h3 style={{ marginTop: "1.25rem" }}>ค่าตอบแทนเริ่มต้น</h3>
          <p className="muted">
            กำหนดค่าจ้างพร้อมกับการสร้างพนักงาน — มีผลตั้งแต่วันที่ระบุ
          </p>
          <div className="form-grid">
            <Field
              id="wageTypeId"
              label="ประเภทค่าจ้าง"
              required
              error={errors.wageTypeId}
            >
              <select
                {...fieldProps("wageTypeId", errors.wageTypeId)}
                value={comp.wageTypeId}
                onChange={(e) =>
                  setComp((c) => ({ ...c, wageTypeId: e.target.value }))
                }
              >
                <option value="">— เลือกประเภท —</option>
                {wageTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="amount" label="จำนวนเงิน" required error={errors.amount}>
              <input
                {...fieldProps("amount", errors.amount)}
                type="number"
                min={0}
                step="0.01"
                value={comp.amount}
                onChange={(e) =>
                  setComp((c) => ({ ...c, amount: e.target.value }))
                }
              />
            </Field>
            <Field
              id="effectiveFrom"
              label="มีผลตั้งแต่"
              required
              error={errors.effectiveFrom}
            >
              <ThaiDateInput
                id="effectiveFrom"
                value={comp.effectiveFrom || values.hireDate}
                onChange={(value) =>
                  setComp((c) => ({ ...c, effectiveFrom: value }))
                }
                required
                aria-invalid={Boolean(errors.effectiveFrom)}
              />
            </Field>
            <div className="field">
              <div className="checkbox-row">
                <input
                  id="overtimeEligible"
                  type="checkbox"
                  checked={comp.overtimeEligible}
                  onChange={(e) =>
                    setComp((c) => ({
                      ...c,
                      overtimeEligible: e.target.checked,
                    }))
                  }
                />
                <label htmlFor="overtimeEligible">มีสิทธิ์รับค่าล่วงเวลา</label>
              </div>
            </div>
          </div>
        </>
      ) : null}

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
