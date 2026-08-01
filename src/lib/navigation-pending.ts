/** Browser-only signals so soft navigations (refresh, push) can show/hide the pending UI. */
export const NAVIGATION_PENDING_EVENT = "gs:navigation-pending";
export const NAVIGATION_DONE_EVENT = "gs:navigation-done";

export function signalNavigationPending(title?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(NAVIGATION_PENDING_EVENT, {
      detail: title ? { title } : undefined,
    }),
  );
}

export function signalNavigationDone(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAVIGATION_DONE_EVENT));
}
