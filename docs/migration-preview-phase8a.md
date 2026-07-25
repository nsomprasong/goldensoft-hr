# HR Migration Preview — Phase 8A

**Status:** Not required for Phase 8A foundation  
**Apply:** **FORBIDDEN** until explicitly approved  

Phase 8A delivers auth/context/entitlement guards **without** an HR Prisma schema.

## When a migration is needed (future)

Additive-only preview rules:

- No PostgreSQL `ENUM` types
- Status/type columns → master/lookup tables with immutable `code`
- No `DROP TABLE` / `DROP COLUMN`
- Soft references: `organization_id`, `branch_id`, `auth_user_id` (UUID, no FK to `platform` / `auth`)
- Schema name recommendation: `hr`

## Preview placeholder

No SQL file is generated in this phase because no HR tables are required yet.

Approval gate: do not run `prisma migrate deploy` / apply SQL until product owners approve an additive migration package.
