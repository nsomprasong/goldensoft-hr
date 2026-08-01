"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import {
  NAVIGATION_DONE_EVENT,
  NAVIGATION_PENDING_EVENT,
  signalNavigationDone,
} from "@/lib/navigation-pending";

declare global {
  interface Window {
    __gsStartNavPending?: (title?: string) => void;
  }
}

/** Hide flash on fast navigations; show rich UI only when the wait is noticeable. */
const OVERLAY_DELAY_MS = 320;
const SAFETY_CLEAR_MS = 12_000;

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function shouldTrackAnchor(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      url.hash !== window.location.hash
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function NavigationPendingInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [barVisible, setBarVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [title, setTitle] = useState("กำลังเปิดหน้าถัดไป");
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearPending = () => {
    activeRef.current = false;
    if (overlayTimer.current) {
      clearTimeout(overlayTimer.current);
      overlayTimer.current = null;
    }
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
    setBarVisible(false);
    setOverlayVisible(false);
    setTitle("กำลังเปิดหน้าถัดไป");
  };

  const startPending = (nextTitle?: string) => {
    // Embedded Customer App shell owns the waiting UI — avoid double overlays.
    if (typeof window.__gsStartNavPending === "function") {
      window.__gsStartNavPending(nextTitle);
      return;
    }
    if (activeRef.current) return;
    activeRef.current = true;
    setTitle(nextTitle?.trim() || "กำลังเปิดหน้าถัดไป");
    setBarVisible(true);
    setOverlayVisible(false);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    overlayTimer.current = setTimeout(() => {
      if (activeRef.current) setOverlayVisible(true);
    }, OVERLAY_DELAY_MS);
    safetyTimer.current = setTimeout(() => {
      clearPending();
    }, SAFETY_CLEAR_MS);
  };

  useEffect(() => {
    clearPending();
    // Clear customer-shell overlay (compose-product-html) after soft navigation.
    signalNavigationDone();
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event) || event.button !== 0) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!shouldTrackAnchor(anchor)) return;
      startPending();
    };

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.target && form.target !== "_self") return;
      const method = (form.getAttribute("method") ?? "get").toLowerCase();
      if (method !== "get") return;
      // SPA forms often omit method (defaults to GET) then preventDefault.
      // Wait until handlers run — skip overlay when navigation was cancelled.
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        startPending();
      });
    };

    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string }>).detail;
      startPending(detail?.title);
    };
    const onDone = () => clearPending();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearPending();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(NAVIGATION_PENDING_EVENT, onSignal);
    window.addEventListener(NAVIGATION_DONE_EVENT, onDone);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(NAVIGATION_PENDING_EVENT, onSignal);
      window.removeEventListener(NAVIGATION_DONE_EVENT, onDone);
      window.removeEventListener("pageshow", onPageShow);
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  if (!barVisible && !overlayVisible) return null;

  return (
    <div className="gs-nav-pending" aria-live="polite" aria-busy="true">
      <span className="sr-only">กำลังโหลดข้อมูล...</span>

      {barVisible ? (
        <div className="gs-nav-pending-bar" aria-hidden="true">
          <div className="gs-nav-pending-bar-shine" />
        </div>
      ) : null}

      {overlayVisible ? (
        <div className="gs-nav-pending-overlay" role="status">
          <div className="gs-nav-pending-card">
            <div className="gs-nav-pending-mark" aria-hidden="true">
              <span className="gs-nav-pending-orb gs-nav-pending-orb--a" />
              <span className="gs-nav-pending-orb gs-nav-pending-orb--b" />
              <span className="gs-nav-pending-orb gs-nav-pending-orb--c" />
              <span className="gs-nav-pending-core">GS</span>
            </div>
            <p className="gs-nav-pending-title">{title}</p>
            <p className="gs-nav-pending-caption">โปรดรอสักครู่…</p>
            <div className="gs-nav-pending-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function NavigationPending() {
  return (
    <Suspense fallback={null}>
      <NavigationPendingInner />
    </Suspense>
  );
}
