"use client";

import { useEffect } from "react";

/** Scroll to and highlight a deep-linked approval card (`#approval-{id}`). */
export default function ApprovalFocus({ focusId }: { focusId: string | null }) {
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`approval-${focusId}`);
    if (!el) return;
    el.classList.add("hr-approval-focus");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId]);
  return null;
}
