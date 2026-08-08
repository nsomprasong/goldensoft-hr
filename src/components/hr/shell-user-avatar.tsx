"use client";

import { useEffect } from "react";

/**
 * Replaces Customer App / embed header initials with the linked employee photo
 * when available. Falls back to initials if no photo or load fails.
 */
export default function ShellUserAvatar({
  employeeId,
}: {
  employeeId: string | null;
}) {
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function apply() {
      const hosts = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".gs-embed-user-avatar, .customer-user-avatar, .hr-debug-user-avatar",
        ),
      );
      if (hosts.length === 0 || !employeeId) return;

      try {
        const photoRes = await fetch(
          `/api/hr/employees/${encodeURIComponent(employeeId)}/photo`,
          { cache: "no-store", credentials: "same-origin" },
        );
        if (!photoRes.ok || cancelled) return;
        const blob = await photoRes.blob();
        if (cancelled || blob.size === 0) return;
        objectUrl = URL.createObjectURL(blob);

        for (const host of hosts) {
          if (host.querySelector("img[data-gs-shell-avatar='1']")) continue;
          const initials = host.textContent?.trim() || "";
          host.textContent = "";
          host.classList.add("gs-user-avatar--photo");
          const img = document.createElement("img");
          img.src = objectUrl;
          img.alt = "";
          img.dataset.gsShellAvatar = "1";
          img.decoding = "async";
          img.addEventListener(
            "error",
            () => {
              host.classList.remove("gs-user-avatar--photo");
              host.textContent = initials;
              img.remove();
            },
            { once: true },
          );
          host.appendChild(img);
        }
      } catch {
        // Keep initials.
      }
    }

    void apply();
    const slot = document.querySelector(".gs-customer-shell-slot");
    const observer =
      slot && typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            if (cancelled) return;
            void apply();
          })
        : null;
    if (slot && observer) observer.observe(slot, { childList: true });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [employeeId]);

  return null;
}
