import PayslipsWorkspace from "@/components/hr/payslips-workspace";
import type {
  PayslipListItem,
  PayslipPeriodOption,
} from "@/lib/hr/services/payroll-runs";

export default function MePayslipsWorkspace({
  payslips,
  periods,
  selectedPeriodId,
}: {
  payslips: PayslipListItem[];
  periods: PayslipPeriodOption[];
  selectedPeriodId: string | null;
}) {
  return (
    <PayslipsWorkspace
      payslips={payslips}
      periods={periods}
      selectedPeriodId={selectedPeriodId}
      basePath="/hr/me/payslips"
      detailBasePath="/hr/me/payslips"
    />
  );
}
