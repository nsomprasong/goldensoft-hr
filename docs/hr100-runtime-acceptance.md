# HR100 runtime acceptance

Run the final HR release gate with Platform (`3000`), HR (`3001`), and Customer App (`3002`) running:

```bash
npm run accept:hr100
```

The script sets `ALLOW_TEST_AUTH=true` only for its own process, uses an existing `SUPER_ADMIN` fixture, and creates timestamped `ACCEPTANCE-HR100-*` records only in `RESORT-DEMO`. It never sends invites or changes `AUTH_INVITE_MODE`.

Optional environment variables:

- `PLATFORM_BASE_URL` (default `http://127.0.0.1:3000`)
- `ACCEPTANCE_HR_BASE_URL` (default `http://127.0.0.1:3001`)
- `ACCEPTANCE_APP_URL` (default `http://127.0.0.1:3002`)
- `ACCEPTANCE_WARM_DEV_MS` (default `3500`)

Every real API and browser assertion prints `[PASS]` or `[FAIL]`. Results are written to `docs/hr100-runtime-acceptance.results.json`; the command exits with status `1` if any assertion fails.
