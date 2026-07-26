import { HrError } from "@/lib/hr/errors";

export function assertConfirmed(confirm?: boolean): void {
  if (confirm !== true) {
    throw new HrError("VALIDATION_ERROR", {
      message: "กรุณายืนยันการดำเนินการก่อนบันทึก",
    });
  }
}

export function assertNoSelfApproval(
  requester: string | null | undefined,
  reviewer: string,
  block = true,
): void {
  if (block && requester === reviewer) {
    throw new HrError("FORBIDDEN", { message: "ไม่สามารถอนุมัติรายการของตนเองได้" });
  }
}

export function assertPayrollMutable(status: string): void {
  if (["APPROVED", "PAID", "LOCKED"].includes(status)) {
    throw new HrError("PERIOD_LOCKED", {
      message: "Payroll ที่อนุมัติแล้วแก้ไขไม่ได้",
    });
  }
}
