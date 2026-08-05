"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DatabaseUnavailableNotice } from "@/components/hr/alert";
import EmployeeDocumentsPanel, {
  type EmployeeDocumentItem,
} from "@/components/hr/employee-documents-panel";
import EmployeeRoleTab from "@/components/hr/employee-role-tab";
import {
  EmployeeBranchTab,
  EmployeeEmploymentTab,
  EmployeeGeneralTab,
  type CompensationRowView,
  type EmployeeOption,
  type EmployeeTabEmployee,
} from "@/components/hr/employee-tab-sections";
import {
  EMPLOYEE_DETAIL_TABS,
  type EmployeeDetailTabKey,
} from "@/lib/hr/employee-detail-tabs";
import type { EmployeeRoleState } from "@/lib/hr/services/employee-roles";

export type { EmployeeDetailTabKey };
export { EMPLOYEE_DETAIL_TABS };

function formatAmount(value: unknown): { display: string; raw: string } {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(num)) {
    const fallback = String(value ?? "");
    return { display: fallback || "—", raw: fallback };
  }
  return {
    display: num.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    raw: String(num),
  };
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10) || null;
}

export default function EmployeeDetailWorkspace({
  employeeId,
  initialTab,
  employee,
  branches,
  branchName,
  departments,
  positions,
  employmentTypes,
  employeeStatuses,
  wageTypes,
  canEdit,
  canReadCompensation,
  canManageCompensation,
  dataAvailable,
}: {
  employeeId: string;
  initialTab: EmployeeDetailTabKey;
  employee: EmployeeTabEmployee;
  branches: EmployeeOption[];
  branchName: string;
  departments: EmployeeOption[];
  positions: Array<EmployeeOption & { defaultRoleId: string | null }>;
  employmentTypes: EmployeeOption[];
  employeeStatuses: EmployeeOption[];
  wageTypes: EmployeeOption[];
  canEdit: boolean;
  canReadCompensation: boolean;
  canManageCompensation: boolean;
  dataAvailable: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<EmployeeDetailTabKey>(initialTab);

  const [compensations, setCompensations] = useState<CompensationRowView[] | null>(
    null,
  );
  const [compensationError, setCompensationError] = useState<string | null>(null);
  const [compensationLoading, setCompensationLoading] = useState(false);

  const [documents, setDocuments] = useState<EmployeeDocumentItem[] | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [roleState, setRoleState] = useState<EmployeeRoleState | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);

  const selectTab = useCallback(
    (next: EmployeeDetailTabKey) => {
      setTab(next);
      // Keep Next.js searchParams in sync so router.refresh() after save
      // does not snap back to a stale tab (e.g. documents).
      router.replace(`/hr/employees/${employeeId}?tab=${next}`, {
        scroll: false,
      });
    },
    [employeeId, router],
  );

  useEffect(() => {
    if (tab !== "employment") return;
    if (!(canReadCompensation || canManageCompensation)) {
      setCompensations((prev) => prev ?? []);
      return;
    }
    if (compensations !== null) return;

    const controller = new AbortController();
    setCompensationLoading(true);
    setCompensationError(null);

    void fetch(`/api/hr/employees/${employeeId}/compensations`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("โหลดค่าจ้างไม่สำเร็จ");
        }
        const json = (await response.json()) as {
          compensations?: Array<{
            id: string;
            wageTypeId: string;
            amount: number | string;
            currency: string;
            effectiveFrom: string | Date;
            effectiveTo?: string | Date | null;
            overtimeEligible: boolean;
            isCurrent: boolean;
          }>;
        };
        const wageLabel = new Map(wageTypes.map((w) => [w.id, w.label]));
        const rows: CompensationRowView[] = (json.compensations ?? []).map(
          (row) => {
            const amount = formatAmount(row.amount);
            return {
              id: row.id,
              wageTypeId: row.wageTypeId,
              wageTypeNameTh: wageLabel.get(row.wageTypeId) ?? "—",
              amount: amount.display,
              amountValue: amount.raw,
              currency: row.currency,
              effectiveFrom: toIsoDate(row.effectiveFrom) ?? "",
              effectiveTo: toIsoDate(row.effectiveTo ?? null),
              overtimeEligible: row.overtimeEligible,
              isCurrent: row.isCurrent,
            };
          },
        );
        setCompensations(rows);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCompensationError(
          error instanceof Error ? error.message : "โหลดค่าจ้างไม่สำเร็จ",
        );
        setCompensations([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCompensationLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [
    tab,
    employeeId,
    canReadCompensation,
    canManageCompensation,
    compensations,
    wageTypes,
  ]);

  useEffect(() => {
    if (tab !== "documents") return;
    if (documents !== null) return;

    const controller = new AbortController();
    setDocumentsLoading(true);
    setDocumentsError(null);

    void fetch(`/api/hr/employees/${employeeId}/documents`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("โหลดเอกสารไม่สำเร็จ");
        }
        const json = (await response.json()) as {
          documents?: EmployeeDocumentItem[];
        };
        setDocuments(json.documents ?? []);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDocumentsError(
          error instanceof Error
            ? error.message
            : "ยังโหลดเอกสารไม่ได้ — ตรวจว่า migration เอกสารพร้อมแล้ว",
        );
        setDocuments([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocumentsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [tab, employeeId, documents]);

  useEffect(() => {
    if (tab !== "roles" && tab !== "employment") return;
    if (roleState !== null) return;

    const controller = new AbortController();
    setRolesLoading(true);
    setRolesError(null);

    void fetch(`/api/hr/employees/${employeeId}/roles`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("โหลดบทบาทไม่สำเร็จ");
        }
        const json = (await response.json()) as EmployeeRoleState;
        setRoleState(json);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRolesError(
          error instanceof Error ? error.message : "โหลดบทบาทไม่สำเร็จ",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRolesLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [tab, employeeId, roleState]);

  return (
    <>
      <nav className="tabs" aria-label="แท็บข้อมูลพนักงาน" role="tablist">
        {EMPLOYEE_DETAIL_TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              className={active ? "is-active" : undefined}
              aria-selected={active}
              onClick={() => selectTab(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <DatabaseUnavailableNotice message={compensationError} />
      <DatabaseUnavailableNotice message={documentsError} />
      <DatabaseUnavailableNotice message={rolesError} />

      {tab === "general" ? (
        <EmployeeGeneralTab
          employee={employee}
          canEdit={canEdit}
          disabled={!dataAvailable}
        />
      ) : null}

      {tab === "branches" ? (
        <EmployeeBranchTab
          employee={employee}
          branches={branches}
          branchName={branchName}
          canEdit={canEdit}
          disabled={!dataAvailable}
        />
      ) : null}

      {tab === "employment" ? (
        compensationLoading &&
        (canReadCompensation || canManageCompensation) &&
        compensations === null ? (
          <p className="muted">กำลังโหลดข้อมูลการจ้าง…</p>
        ) : (
          <EmployeeEmploymentTab
            employee={employee}
            departments={departments}
            positions={positions}
            roleState={roleState}
            employmentTypes={employmentTypes}
            employeeStatuses={employeeStatuses}
            compensations={compensations ?? []}
            wageTypes={wageTypes}
            canEdit={canEdit}
            canReadCompensation={canReadCompensation}
            canManageCompensation={canManageCompensation}
            disabled={!dataAvailable}
          />
        )
      ) : null}

      {tab === "documents" ? (
        documentsLoading && documents === null ? (
          <p className="muted">กำลังโหลดเอกสาร…</p>
        ) : (
          <EmployeeDocumentsPanel
            employeeId={employee.id}
            documents={documents ?? []}
            canEdit={canEdit}
            disabled={!dataAvailable}
          />
        )
      ) : null}

      {tab === "roles" ? (
        rolesLoading && roleState === null ? (
          <p className="muted">กำลังโหลดบทบาท…</p>
        ) : roleState ? (
          <EmployeeRoleTab
            key={`${roleState.membershipId ?? "none"}-${roleState.assigned
              .map((r) => r.membershipRoleId)
              .join(",")}`}
            employeeId={employee.id}
            initial={roleState}
            disabled={!dataAvailable}
          />
        ) : rolesError ? null : (
          <p className="empty">ยังไม่มีข้อมูลบทบาท</p>
        )
      ) : null}
    </>
  );
}
