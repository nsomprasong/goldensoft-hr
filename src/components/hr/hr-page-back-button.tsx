"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { IconChevronLeft } from "@/components/ui/action-icons";

/** Icon-only back control for the right side of `.hr-page-head`. */
export default function HrPageBackButton({
  href,
  label = "ย้อนกลับ",
}: {
  href: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      className="hr-page-back"
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (window.history.length <= 1) return;
        event.preventDefault();
        router.back();
      }}
    >
      <IconChevronLeft size={20} />
    </Link>
  );
}
