# RBAC Manual Verification

## Goal

Verify that `admin` and `user` claims resolve to the expected portfolio access, and that denied paths return `403` without leaking cross-portfolio data.

## Preflight

- prepare one `admin` claim and one `user` claim.
- prepare at least two portfolio ids:
  - owner portfolio `me`
  - non-owner portfolio such as `jinliancheng`
- open a fresh browser session or clear auth cookies between role changes.

## Admin Flow

1. Set the `admin` claim.
2. Request each protected portfolio endpoint and UI route for every portfolio.
3. Confirm the admin can read `me` and the non-owner portfolio without fallback errors.
4. Capture evidence:
   - screenshot of successful portfolio load
   - response payload or devtools proof that the expected portfolio id is returned

## User Flow

1. Set the `user` claim for the owner account.
2. Open the owner portfolio and confirm normal read access.
3. Switch to every other portfolio route / endpoint and confirm access is denied.
4. Expected result:
   - owner portfolio loads
   - non-owner portfolio returns `403`
   - no hidden portfolio data appears in the response body or rendered shell

## 403 Checklist

- API response status is `403`.
- error message is generic and does not enumerate private portfolio metadata.
- UI fallback does not hydrate stale cached data from the blocked portfolio.
- retrying with a valid portfolio id restores access without a full page corruption.

## Portfolio Matrix

For each portfolio, record:

- portfolio id:
- role tested:
- expected access:
- actual status:
- evidence link:
- notes:

Minimum matrix:

- `admin` -> `me`
- `admin` -> non-owner portfolio
- `user` -> `me`
- `user` -> non-owner portfolio (`403`)

## Signoff

- verifier:
- date:
- blocked / flaky cases:
- follow-up bug ids:
