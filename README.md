# GoldenSoft HR

Product app for GoldenSoft HR. Auth and tenant context come from **GoldenSoft Platform**.

See Platform contract: `../goldensoft-platform/docs/platform-integration-contract-v1.md`

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
