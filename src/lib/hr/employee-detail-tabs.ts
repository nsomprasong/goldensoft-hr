export const EMPLOYEE_DETAIL_TABS = [
  { key: "general", label: "ข้อมูลทั่วไป" },
  { key: "branches", label: "สาขา" },
  { key: "employment", label: "การจ้าง" },
  { key: "documents", label: "เอกสารประกอบ" },
  { key: "roles", label: "บทบาท" },
] as const;

export type EmployeeDetailTabKey = (typeof EMPLOYEE_DETAIL_TABS)[number]["key"];

export function isEmployeeDetailTabKey(
  value: string,
): value is EmployeeDetailTabKey {
  return EMPLOYEE_DETAIL_TABS.some((tab) => tab.key === value);
}
