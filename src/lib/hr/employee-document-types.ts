/** Client-safe document category labels (no Node APIs). */

export const EMPLOYEE_DOCUMENT_CATEGORIES = [
  { value: "ID_CARD", label: "บัตรประชาชน" },
  { value: "CONTRACT", label: "สัญญาจ้าง" },
  { value: "EDUCATION", label: "วุฒิการศึกษา" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

export type EmployeeDocumentCategory =
  (typeof EMPLOYEE_DOCUMENT_CATEGORIES)[number]["value"];

export function documentCategoryLabel(category: string): string {
  return (
    EMPLOYEE_DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ??
    "อื่นๆ"
  );
}
