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
}: {
  leaveTypes: LeaveTypeRow[];
  policies: PolicyRow[];
  branches: BranchOption[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackPopupState>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
        map.set(`${policy.leaveTypeId}:${policy.branchId}`, policy.annualEntitlement);
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
      for (const type of leaveTypes) {
        for (const branch of branches) {
          const key = `${type.id}:${branch.id}`;
          const override = branchByType.get(key);
          initial[key] =
            override != null ? String(override) : String(orgByType.get(type.id) ?? 0);
        }
      }
      return initial;
    },
  );

  const [inheritFlags, setInheritFlags] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const type of leaveTypes) {
        for (const branch of branches) {
          const key = `${type.id}:${branch.id}`;
          initial[key] = !branchByType.has(key);
        }
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
    setFeedback({ kind: "info", message: "กำลังบันทึกสิทธิ์องค์กร…" });
    try {
      await save(
        {
          leaveTypeId,
          branchId: null,
          annualEntitlement: Number(orgValues[leaveTypeId] ?? 0),
        },
        "บันทึกจำนวนวันลาขององค์กรแล้ว",
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
    setFeedback({ kind: "info", message: "กำลังบันทึกสิทธิ์สาขา…" });
    try {
      if (inheritFlags[key]) {
        await save(
          {
            leaveTypeId,
            branchId,
            annualEntitlement: 0,
            inheritFromOrg: true,
          },
          "สาขาใช้จำนวนวันลาตามองค์กรแล้ว",
        );
      } else {
        await save(
          {
            leaveTypeId,
            branchId,
            annualEntitlement: Number(branchValues[key] ?? 0),
            inheritFromOrg: false,
          },
          "บันทึกจำนวนวันลาของสาขาแล้ว",
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
    return (
      <section className="card">
        <p className="empty">ยังไม่มีประเภทการลาในองค์กรนี้</p>
      </section>
    );
  }

  return (
    <>
      <FeedbackPopup feedback={feedback} onClose={() => setFeedback(null)} />

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="hr-section-title">สิทธิ์วันลาขององค์กร</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          กำหนดจำนวนวันลาเริ่มต้นต่อปีของแต่ละประเภท — สาขาสามารถดึงค่านี้ไปใช้ได้
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ประเภทการลา</th>
                <th>จำนวนวัน/ปี</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map((type) => {
                const busy = busyKey === `org:${type.id}`;
                return (
                  <tr key={type.id}>
                    <td>
                      <strong>{type.name}</strong>
                    </td>
                    <td style={{ maxWidth: "8rem" }}>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={orgValues[type.id] ?? "0"}
                        disabled={busy}
                        onChange={(event) =>
                          setOrgValues((prev) => ({
                            ...prev,
                            [type.id]: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={busy}
                        onClick={() => void saveOrg(type.id)}
                      >
                        {busy ? "กำลังบันทึก…" : "บันทึก"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="hr-section-title">สิทธิ์วันลาของสาขา</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          เลือกใช้ตามองค์กร หรือกำหนดจำนวนเอง — พนักงานใช้สิทธิ์ตามสาขาหลักของตน
        </p>
        {branches.length === 0 ? (
          <p className="empty">ไม่พบสาขาในองค์กร</p>
        ) : (
          <div className="hr-leave-entitlement-branch-grid">
            {branches.map((branch) => (
              <article key={branch.id} className="card hr-entity-card">
                <div className="hr-entity-card-top">
                  <h3 className="hr-entity-card-title">{branch.label}</h3>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ประเภท</th>
                        <th>ใช้ตามองค์กร</th>
                        <th>วัน/ปี</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {leaveTypes.map((type) => {
                        const key = `${type.id}:${branch.id}`;
                        const inherit = inheritFlags[key] ?? true;
                        const busy = busyKey === key;
                        return (
                          <tr key={key}>
                            <td>{type.name}</td>
                            <td>
                              <label className="hr-inline-check">
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
                                <span>ดึงจากองค์กร</span>
                              </label>
                            </td>
                            <td style={{ maxWidth: "6.5rem" }}>
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={branchValues[key] ?? "0"}
                                disabled={busy || inherit}
                                onChange={(event) =>
                                  setBranchValues((prev) => ({
                                    ...prev,
                                    [key]: event.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={busy}
                                onClick={() =>
                                  void saveBranch(type.id, branch.id)
                                }
                              >
                                {busy ? "…" : "บันทึก"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
