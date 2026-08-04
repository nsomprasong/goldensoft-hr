"use client";

import { useEffect, useState } from "react";

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
  const legacy = document.querySelector("details.gs-embed-mobile");
  if (legacy instanceof HTMLDetailsElement) legacy.open = false;
}

function toggleMobileMenu() {
  const drawer = getDrawer();
  const open = !(
    drawer instanceof HTMLElement && drawer.classList.contains("is-open")
  );
  setMobileMenuOpen(open);
}

function openLogoutConfirm(form: HTMLFormElement) {
  if (document.getElementById("gs-logout-confirm")) return;
  const backdrop = document.createElement("div");
  backdrop.id = "gs-logout-confirm";
  backdrop.className = "gs-embed-confirm-backdrop";
  backdrop.innerHTML =
    '<div class="gs-embed-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="gs-logout-title" aria-describedby="gs-logout-desc">' +
    '<h2 id="gs-logout-title" class="gs-embed-confirm-title">ออกจากระบบ?</h2>' +
    '<p id="gs-logout-desc" class="gs-embed-confirm-body">คุณต้องการออกจากระบบ GoldenSoft ใช่หรือไม่</p>' +
    '<div class="gs-embed-confirm-actions">' +
    '<button type="button" class="gs-embed-confirm-cancel" data-gs-logout-cancel>ยกเลิก</button>' +
    '<button type="button" class="gs-embed-confirm-danger" data-gs-logout-confirm>ออกจากระบบ</button>' +
    "</div></div>";
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop
    .querySelector("[data-gs-logout-cancel]")
    ?.addEventListener("click", close);
  backdrop
    .querySelector("[data-gs-logout-confirm]")
    ?.addEventListener("click", () => {
      const confirmBtn = backdrop.querySelector("[data-gs-logout-confirm]");
      const cancelBtn = backdrop.querySelector("[data-gs-logout-cancel]");
      if (confirmBtn instanceof HTMLButtonElement) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "กำลังออกจากระบบ...";
      }
      if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = true;
      form.dataset.gsLogoutConfirmed = "1";
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.submit();
    });
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") close();
    },
    { once: true },
  );
  document.body.appendChild(backdrop);
  (
    backdrop.querySelector("[data-gs-logout-cancel]") as HTMLButtonElement | null
  )?.focus();
}

/**
 * Wires interactive behavior for the Customer App shell markup that React
 * injects via dangerouslySetInnerHTML (inline <script> tags do not run).
 * Also owns logout confirm so mobile always gets a dialog (not raw form POST).
 */
export default function CustomerShellEffects() {
  const [, setTick] = useState(0);

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
      setTick((n) => n + 1);
    };

    const menuApi: ShellMenuApi = {
      setOpen: setMobileMenuOpen,
      close: closeMobileMenu,
      toggle: toggleMobileMenu,
    };
    (window as Window & { __gsShellMenu?: ShellMenuApi }).__gsShellMenu =
      menuApi;
    // Tell injected shell script not to double-bind logout.
    (
      window as Window & { __gsLogoutConfirmBound?: boolean }
    ).__gsLogoutConfirmBound = true;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const logoutBtn = target.closest(".gs-embed-logout");
      if (logoutBtn instanceof HTMLElement) {
        const form = logoutBtn.closest("form");
        if (
          form instanceof HTMLFormElement &&
          form.getAttribute("data-gs-logout-form") === "1" &&
          form.dataset.gsLogoutConfirmed !== "1"
        ) {
          event.preventDefault();
          event.stopPropagation();
          openLogoutConfirm(form);
          return;
        }
      }

      if (target.closest("[data-gs-menu-toggle]")) {
        event.preventDefault();
        toggleMobileMenu();
        return;
      }

      if (target.closest("[data-gs-drawer-close]")) {
        closeMobileMenu();
        return;
      }

      if (
        target.closest(
          "#gs-embed-drawer a[href], details.gs-embed-mobile a[href]",
        )
      ) {
        closeMobileMenu();
      }
    };

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.getAttribute("data-gs-logout-form") !== "1") return;
      if (form.dataset.gsLogoutConfirmed === "1") return;
      event.preventDefault();
      event.stopPropagation();
      openLogoutConfirm(form);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };

    const onPageShow = () => closeMobileMenu();

    runShellScript();
    closeMobileMenu();

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
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
      observer.observe(slot, { childList: true });
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pageshow", onPageShow);
      observer?.disconnect();
      closeMobileMenu();
      const win = window as Window & {
        __gsShellMenu?: ShellMenuApi;
        __gsLogoutConfirmBound?: boolean;
      };
      if (win.__gsShellMenu === menuApi) delete win.__gsShellMenu;
      delete win.__gsLogoutConfirmBound;
      document.getElementById("gs-logout-confirm")?.remove();
    };
  }, []);

  return null;
}
