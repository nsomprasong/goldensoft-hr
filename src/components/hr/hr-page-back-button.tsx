import Link from "next/link";

import { IconChevronLeft } from "@/components/ui/action-icons";

/** Icon-only back control for the right side of `.hr-page-head`. */
export default function HrPageBackButton({
  href,
  label = "ย้อนกลับ",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="hr-page-back"
      aria-label={label}
      title={label}
    >
      <IconChevronLeft size={20} />
    </Link>
  );
}
