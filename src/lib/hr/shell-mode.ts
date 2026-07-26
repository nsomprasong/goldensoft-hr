/**
 * HR UI shell mode.
 *
 * Production Customer App (`goldensoft-app`) owns Global Login, Sidebar,
 * Header, and Organization/Branch selector. HR must not present itself as
 * that shell outside an explicit debug mode.
 */

export type HrShellMode = "product" | "standalone_debug";

/**
 * Returns true when this process may render the Debug Standalone Shell.
 *
 * - `x-gs-customer-shell: 1` request header → product only (Customer App proxy)
 * - `HR_STANDALONE_DEBUG=true` → force debug shell
 * - `HR_STANDALONE_DEBUG=false` or `HR_EMBEDDED_IN_CUSTOMER_APP=true` → product only
 * - default: debug shell only when `NODE_ENV !== "production"`
 */
export function isHrStandaloneDebugShell(
  env: NodeJS.ProcessEnv = process.env,
  requestHeaders?: Headers | null,
): boolean {
  if (requestHeaders?.get("x-gs-customer-shell") === "1") return false;
  if (env.HR_EMBEDDED_IN_CUSTOMER_APP === "true") return false;
  if (env.HR_STANDALONE_DEBUG === "true") return true;
  if (env.HR_STANDALONE_DEBUG === "false") return false;
  return env.NODE_ENV !== "production";
}

export function resolveHrShellMode(
  env: NodeJS.ProcessEnv = process.env,
  requestHeaders?: Headers | null,
): HrShellMode {
  return isHrStandaloneDebugShell(env, requestHeaders)
    ? "standalone_debug"
    : "product";
}
