"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FeedbackPopup, {
  type FeedbackPopupState,
} from "@/components/hr/feedback-popup";

type LeaveTypeRow = {
  id: string;
  code: string;
  name: string;
  unitName: string;
};

type PolicyRow = {
  id: string;
  leaveTypeId: string;
  branchId: string | null;
  annualEntitlement: number;
};

type BranchOption = { id: string; label: string };

export default function LeaveEntitlementsWorkspace({
  leaveTypes,
  policies,
  branches,
  selectedBranchId = null,
}: {
  leaveTypes: LeaveTypeRow[];
  policies: PolicyRow[];
  branches: BranchOption[];
  /** Header branch scope — when set, edit that branch only. */
  selectedBranchId?: string | null;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const scopedBranch =
    selectedBranchId != null && selectedBranchId !== ""
      ? (branches.find((b) => b.id === selectedBranchId) ?? {
          id: selectedBranchId,
          label: "สาขาที่เลือก",
        })
      : null;
  const mode: "org" | "branch" = scopedBranch ? "branch" : "org";

  const orgByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const policy of policies) {
      if (policy.branchId == null) {
        map.set(policy.leaveTypeId, policy.annualEntitlement);
      }
    }
    return map;
  }, [policies]);

  const branchByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const policy of policies) {
      if (policy.branchId) {
        map.set(
          `${policy.leaveTypeId}:${policy.branchId}`,
          policy.annualEntitlement,
        );
      }
    }
    return map;
  }, [policies]);

  const [orgValues, setOrgValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const type of leaveTypes) {
      initial[type.id] = String(orgByType.get(type.id) ?? 0);
    }
    return initial;
  });

  const [branchValues, setBranchValues] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      if (!scopedBranch) return initial;
      for (const type of leaveTypes) {
        const key = `${type.id}:${scopedBranch.id}`;
        const override = branchByType.get(key);
        initial[key] =
          override != null
            ? String(override)
            : String(orgByType.get(type.id) ?? 0);
      }
      return initial;
    },
  );

  const [inheritFlags, setInheritFlags] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      if (!scopedBranch) return initial;
      for (const type of leaveTypes) {
        const key = `${type.id}:${scopedBranch.id}`;
        initial[key] = !branchByType.has(key);
      }
      return initial;
    },
  );

  async function save(body: Record<string, unknown>, success: string) {
    const response = await fetch("/api/hr/leave/entitlements", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let detail = "บันทึกไม่สำเร็จ";
      try {
        const payload = (await response.json()) as {
          error?: { message?: string };
        };
        if (payload.error?.message?.trim()) detail = payload.error.message.trim();
      } catch {
        // keep fallback
      }
      throw new Error(detail);
    }
    setFeedback({ kind: "success", message: success });
    router.refresh();
  }

  async function saveOrg(leaveTypeId: string) {
    const key = `org:${leaveTypeId}`;
    setBusyKey(key);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    try {
      await save(
        {
          leaveTypeId,
          branchId: null,
          annualEntitlement: Number(orgValues[leaveTypeId] ?? 0),
        },
        "บันทึกแล้ว",
      );
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function saveBranch(leaveTypeId: string, branchId: string) {
    const key = `${leaveTypeId}:${branchId}`;
    setBusyKey(key);
    setFeedback({ kind: "info", message: "กำลังบันทึก…" });
    try {
      if (inheritFlags[key]) {
        await save(
          {
            leaveTypeId,
            branchId,
            annualEntitlement: 0,
            inheritFromOrg: true,
          },
          "ใช้ตามองค์กรแล้ว",
        );
      } else {
        await save(
          {
            leaveTypeId,
            branchId,
            annualEntitlement: Number(branchValues[key] ?? 0),
            inheritFromOrg: false,
          },
          "บันทึกแล้ว",
        );
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
      });
    } finally {
      setBusyKey(null);
    }
  }

  if (leaveTypes.length === 0) {
    return <p className="empty">ยังไม่มีประเภทการลา</p>;
  }

  if (mode === "branch" && !scopedBranch) {
    return <p className="empty">ไม่พบสาขาที่เลือก</p>;
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <section className="hr-leave-panel">
        <header className="hr-leave-panel-head">
          <h2>
            {mode === "org"
              ? "องค์กร"
              : scopedBranch?.label ?? "สาขา"}
          </h2>
          <p>
            {mode === "org"
              ? "ค่าเริ่มต้นของทุกสาขา"
              : "กำหนดเอง หรือใช้ตามองค์กร"}
          </p>
        </header>

        <div className="hr-leave-type-list">
          {leaveTypes.map((type) => {
            if (mode === "org") {
              const busy = busyKey === `org:${type.id}`;
              return (
                <div key={type.id} className="hr-leave-type-row">
                  <strong className="hr-leave-type-name">{type.name}</strong>
                  <label className="hr-leave-days-field">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={orgValues[type.id] ?? "0"}
                      disabled={busy}
                      aria-label={`${type.name} วันต่อปี`}
                      onChange={(event) =>
                        setOrgValues((prev) => ({
                          ...prev,
                          [type.id]: event.target.value,
                        }))
                      }
                    />
                    <span>วัน</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() => void saveOrg(type.id)}
                  >
                    {busy ? "…" : "บันทึก"}
                  </button>
                </div>
              );
            }

            const branchId = scopedBranch!.id;
            const key = `${type.id}:${branchId}`;
            const inherit = inheritFlags[key] ?? true;
            const busy = busyKey === key;
            return (
              <div key={key} className="hr-leave-type-row">
                <strong className="hr-leave-type-name">{type.name}</strong>
                <label className="hr-inline-check hr-leave-inherit">
                  <input
                    type="checkbox"
                    checked={inherit}
                    disabled={busy}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setInheritFlags((prev) => ({
                        ...prev,
                        [key]: checked,
                      }));
                      if (checked) {
                        setBranchValues((prev) => ({
                          ...prev,
                          [key]: String(
                            orgValues[type.id] ??
                              orgByType.get(type.id) ??
                              0,
                          ),
                        }));
                      }
                    }}
                  />
                  <span>ตามองค์กร</span>
                </label>
                <label className="hr-leave-days-field">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={branchValues[key] ?? "0"}
                    disabled={busy || inherit}
                    aria-label={`${type.name} วันต่อปี`}
                    onChange={(event) =>
                      setBranchValues((prev) => ({
                        ...prev,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  <span>วัน</span>
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={busy}
                  onClick={() => void saveBranch(type.id, branchId)}
                >
                  {busy ? "…" : "บันทึก"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
