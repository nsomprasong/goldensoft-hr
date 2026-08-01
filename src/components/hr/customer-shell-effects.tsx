"use client";

import { useEffect } from "react";

type ShellMenuApi = {
  setOpen: (open: boolean) => void;
  close: () => void;
  toggle: () => void;
};

function getDrawer() {
  return document.getElementById("gs-embed-drawer");
}

function getMenuButton() {
  return document.querySelector<HTMLElement>("[data-gs-menu-toggle]");
}

function setMobileMenuOpen(open: boolean) {
  document.documentElement.classList.toggle("gs-nav-open", open);
  const drawer = getDrawer();
  if (drawer instanceof HTMLElement) {
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
  }
  const menuBtn = getMenuButton();
  if (menuBtn) {
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
}

function closeMobileMenu() {
  setMobileMenuOpen(false);
  // Legacy details-based menu (older composed shells).
  const legacy = document.querySelector("details.gs-embed-mobile");
  if (legacy instanceof HTMLDetailsElement) legacy.open = false;
}

function toggleMobileMenu() {
  const drawer = getDrawer();
  const open = !(drawer instanceof HTMLElement && drawer.classList.contains("is-open"));
  setMobileMenuOpen(open);
}

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

    const menuApi: ShellMenuApi = {
      setOpen: setMobileMenuOpen,
      close: closeMobileMenu,
      toggle: toggleMobileMenu,
    };
    (window as Window & { __gsShellMenu?: ShellMenuApi }).__gsShellMenu = menuApi;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest("[data-gs-menu-toggle]")) {
        event.preventDefault();
        toggleMobileMenu();
        return;
      }

      if (target.closest("[data-gs-drawer-close]")) {
        closeMobileMenu();
        return;
      }

      if (target.closest("#gs-embed-drawer a[href], details.gs-embed-mobile a[href]")) {
        closeMobileMenu();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };

    const onPageShow = () => closeMobileMenu();

    runShellScript();
    closeMobileMenu();

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageshow", onPageShow);

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
      // Only the slot's direct children — opening the drawer must not re-fire.
      observer.observe(slot, { childList: true });
    }

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pageshow", onPageShow);
      observer?.disconnect();
      closeMobileMenu();
      const win = window as Window & { __gsShellMenu?: ShellMenuApi };
      if (win.__gsShellMenu === menuApi) delete win.__gsShellMenu;
    };
  }, []);

  return null;
}
