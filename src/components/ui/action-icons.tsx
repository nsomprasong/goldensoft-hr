import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg(props: IconProps & { children: ReactNode }) {
  const { size = 16, children, className, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconSave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h8V3" />
      <path d="M8 17h8" />
    </Svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20H4v-4z" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconCancel(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function IconReject(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4 12 16-8-6 16-2.5-6.5z" />
    </Svg>
  );
}

export function IconCalculate(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </Svg>
  );
}

export function IconPublish(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 19h14" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconOpen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

/** Enter / เข้างาน */
export function IconClockIn(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </Svg>
  );
}

/** Exit / ออกงาน */
export function IconClockOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  );
}

export type ActionKey =
  | "save"
  | "edit"
  | "close"
  | "cancel"
  | "plus"
  | "trash"
  | "approve"
  | "reject"
  | "search"
  | "send"
  | "calculate"
  | "publish"
  | "prev"
  | "next"
  | "open"
  | "clock"
  | "clockIn"
  | "clockOut";

export const ACTION_ICON: Record<
  ActionKey,
  (props: IconProps) => ReactNode
> = {
  save: IconSave,
  edit: IconEdit,
  close: IconClose,
  cancel: IconCancel,
  plus: IconPlus,
  trash: IconTrash,
  approve: IconCheck,
  reject: IconReject,
  search: IconSearch,
  send: IconSend,
  calculate: IconCalculate,
  publish: IconPublish,
  prev: IconChevronLeft,
  next: IconChevronRight,
  open: IconOpen,
  clock: IconClock,
  clockIn: IconClockIn,
  clockOut: IconClockOut,
};

/** Infer action icon from Thai (or busy) button label text. */
export function inferActionFromLabel(label: string): ActionKey | null {
  const t = label.trim();
  if (!t) return null;
  if (/ก่อนหน้า|ย้อนกลับ/.test(t)) return "prev";
  if (/ถัดไป|ต่อไป/.test(t)) return "next";
  if (/ค้นหา/.test(t)) return "search";
  if (/คำนวณ/.test(t)) return "calculate";
  if (/เผยแพร่|เปิดใช้|เปิดใช้งาน/.test(t)) return "publish";
  if (/ยื่น|ส่งคำขอ|ส่ง/.test(t)) return "send";
  if (/ลบ/.test(t)) return "trash";
  if (/เพิ่ม|สร้าง/.test(t)) return "plus";
  if (/ไม่อนุมัติ|ปฏิเสธ|ไม่ยืนยัน/.test(t)) return "reject";
  if (/อนุมัติ|ยืนยัน/.test(t)) return "approve";
  if (/ยกเลิก/.test(t)) return "cancel";
  if (/ปิด/.test(t)) return "close";
  if (/แก้ไข/.test(t)) return "edit";
  if (/บันทึก|กำลังบันทึก/.test(t)) return "save";
  if (/เปิดดู|เปิด\b/.test(t)) return "open";
  if (/ออกงาน/.test(t)) return "clockOut";
  if (/เข้างาน/.test(t)) return "clockIn";
  if (/ลงเวลา|เวลา/.test(t)) return "clock";
  return null;
}
