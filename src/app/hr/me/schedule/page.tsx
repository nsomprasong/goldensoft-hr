import MyScheduleWorkspace from "@/components/hr/my-schedule-workspace";
import HrShell from "@/components/hr-shell";
import { requireHrPage } from "@/lib/hr/guards";
import { HR_PERMISSIONS } from "@/lib/hr/permissions";
import { listMySchedule } from "@/lib/hr/services/operations";
import { toHrServiceContext } from "@/lib/hr/services/shared";

export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
  const ctx = await requireHrPage({ permission: HR_PERMISSIONS.scheduleRead });
  const service = toHrServiceContext(ctx);
  const schedule = await listMySchedule(service);

  return (
    <HrShell ctx={ctx}>
      <div className="hr-page-head">
        <div>
          <h1>ตารางงานของฉัน</h1>
          <p>กะงาน วันหยุด และวันทำงานแทนที่ได้รับมอบหมาย</p>
        </div>
      </div>
      <MyScheduleWorkspace
        assignments={schedule.assignments}
        pendingPublish={schedule.pendingPublish}
      />
    </HrShell>
  );
}
