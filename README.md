# GoldenSoft HR

Product module for GoldenSoft HR. Auth and tenant context come from **GoldenSoft Platform** / future **Customer App** (`goldensoft-app`).

See Platform contract: `../goldensoft-platform/docs/platform-integration-contract-v1.md`

Unified shell ADR: `docs/adr-unified-customer-shell.md`

## Architecture (Phase 8B)

- Canonical business UI under `/hr/*` (route registry: `src/lib/hr/routes.ts`)
- Embeddable product chrome: `HrProductFrame` (no global Login / Sidebar / org selector)
- Standalone **Debug Shell** only for local development (`HrShell` + `HR_STANDALONE_DEBUG`)
- Shared context cookie only: `gs_platform_ctx`
- APIs remain `/api/hr/*`; schema remains PostgreSQL schema `hr`

## Phase 8A

- Platform client + signed context cookie verification
- Entitlement guards for `GOLDENSOFT_HR` / `hr.access`
- Branch scope + permission checks (server-side)
- No HR database migration in this phase (foundation only)

## Scripts

```bash
npm install
npm test
npm run typecheck
npm run build
```
