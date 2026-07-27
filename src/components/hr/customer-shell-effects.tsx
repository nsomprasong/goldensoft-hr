"use client";

import { useEffect } from "react";

/**
 * Wires interactive behavior for the Customer App shell markup that React
 * injects via dangerouslySetInnerHTML (inline <script> tags do not run).
 */
export default function CustomerShellEffects() {
  useEffect(() => {
    const runShellScript = () => {
      const node = document.getElementById("gs-customer-shell-script");
      if (!(node instanceof HTMLScriptElement)) return;
      if (node.dataset.gsRan === "1") return;
      const code = node.textContent?.trim();
      if (!code) return;
      node.dataset.gsRan = "1";
      // Shell markup is trusted (composed by Customer App).
      // eslint-disable-next-line no-new-func
      Function(code)();
    };

    const closeMobileMenu = () => {
      const menu = document.querySelector(".gs-embed-mobile");
      if (menu instanceof HTMLDetailsElement) menu.open = false;
    };

    const onNavClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".gs-embed-mobile a[href]")) return;
      closeMobileMenu();
    };

    const onPointerDown = (event: PointerEvent) => {
      const menu = document.querySelector(".gs-embed-mobile");
      if (!(menu instanceof HTMLDetailsElement) || !menu.open) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menu.contains(target)) return;
      closeMobileMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };

    runShellScript();

    document.addEventListener("click", onNavClick, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    const slot = document.querySelector(".gs-customer-shell-slot");
    const observer =
      slot && typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            const script = document.getElementById("gs-customer-shell-script");
            if (script instanceof HTMLScriptElement) {
              delete script.dataset.gsRan;
            }
            runShellScript();
            closeMobileMenu();
          })
        : null;
    if (slot && observer) {
      // Only the slot's direct children — opening <details> must not re-fire.
      observer.observe(slot, { childList: true });
    }

    return () => {
      document.removeEventListener("click", onNavClick, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      observer?.disconnect();
    };
  }, []);

  return null;
}
