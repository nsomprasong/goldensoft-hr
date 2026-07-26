# ADR: Unified Customer Shell compatibility (Phase 8B)

## Status

Accepted (Phase 8B alignment) — 2026-07-26

## Context

Customers must enter **one** GoldenSoft Customer App and see every purchased product (e.g. Resident + HR) in a single Sidebar/Header. Global Login, Organization/Branch selector, and chrome therefore belong to `goldensoft-app`, not to each product repo.

`goldensoft-hr` already owns HR schema (`hr`), APIs (`/api/hr/*`), and domain services. It had also grown a product-local shell that looked like a full app (brand header, org display, primary nav at `/`, `/employees`, …), which would conflict with the unified shell.

## Decision

1. **HR is a product module.** Schema, API, and business logic stay in `goldensoft-hr`.
2. **Canonical UI paths use `/hr` prefix** (registry in `src/lib/hr/routes.ts`), suitable for Customer App menu merge.
3. **`HrProductFrame`** is the embeddable product chrome (HR-local nav only). No Login, no org/branch selector, no claim to own the global sidebar.
4. **`HrShell` in standalone mode** is explicitly a **Debug Shell** (`data-hr-shell="standalone_debug"`, banner copy). Enabled by default only outside production, or via `HR_STANDALONE_DEBUG=true`. Disabled when `HR_EMBEDDED_IN_CUSTOMER_APP=true` or `HR_STANDALONE_DEBUG=false`.
5. **Context cookie remains Platform contract** `gs_platform_ctx` only — HR verifies; it does not issue a parallel cookie.
6. **Migration `0001_hr_core` is UI-shell-independent** (schema/masters/audit only). Compatibility with Unified Shell does not require changing or re-applying DDL. Apply remains a DBA/ops decision separate from shell work.

## Consequences

- Customer App (future) imports `HR_ROUTE_REGISTRY` / menu metadata (permissions + entitlements per entry) and mounts product UI under `/hr/*`.
- Legacy paths without `/hr` redirect to the canonical prefix for local debug continuity.
- `goldensoft-app` is **not** built in this phase; HR must not invent a second global shell that would fight it later.

## Non-goals

- Building `goldensoft-app`
- Reworking Employee / Compensation / Shift / Payroll tables
- Changing Platform cookie format
