# Daily chat quota implementation plan

**Goal:** Complete the existing in-progress feature: guests and accounts each receive 20 replies per UTC day, with server-enforced quotas and registration prompts.
**Architecture:** Signed visitor cookie or verified Supabase account identifies a daily PostgreSQL bucket. Atomic reservations, idempotent settlement, and stale reservation recovery protect concurrency. Failed/cancelled replies refund the original day's bucket. A shared per-network minute limit mitigates cookie rotation.
**Tech stack:** Existing Next.js/React/TypeScript, Supabase PostgreSQL RPC, Node test runner.
**Authorization:** User requested direct implementation in their current development workspace; preserve their uncommitted changes and do not commit or deploy.
**Policy decision:** Guest and account allowances are separate; signing in unlocks the account's daily allowance. UTC reset is displayed in local time. No messages stored in database.

- [x] Add failing handler tests: validated input before reservation, account daily cap, exactly one settlement on success/failure/cancel.
- [x] Add an additive migration for daily buckets, row locking, original-day refunds, lease recovery, and shared network rate limits. Real PostgreSQL 16 assertions and concurrent transactions passed in a disposable cluster.
- [x] Connect store and route for both identities, signed cookie, fail-closed storage errors, and status reset time.
- [x] Complete bilingual remaining counts, native registration dialog, focus/visibility/reset refresh, and waiting timer.
- [x] Update configuration documentation; full suite 71/71, type check and Next production build passed. ESLint has no errors and four pre-existing documentation warnings.

Local development has no Supabase URL/service key, so explicitly enabled CHAT_QUOTA_STORE=memory in the ignored application .env.local. Production ignores this option. A concurrent editor's automatic storage fallback was reconciled into this explicit local-only mode; the old anonymous bypass is disabled. Generated VitePress temp files are ignored by Git and ESLint.

Limitations: production Supabase migration/configuration is not applied; no real paid calls were made. Browser launch was denied by automatic policy review, so no browser interaction validation is claimed. Next 16.4.3 emits an existing security advisory during build; dependency upgrade remains separate work.

HTTP smoke checks passed against separately started local servers: development issues an HttpOnly/SameSite guest cookie, returns 20/20 with UTC reset, preserves repeated status, and rejects invalid input; production renders both languages, rejects cross-origin requests, and refuses quota access without storage even with the local memory flag. Temporary servers were stopped. The disposable PostgreSQL server was stopped; automatic approval review rejected deleting its temporary data directory.

Review focus: UTC rollover during generation; duplicate settlement; stale reservation settling after a new reservation; cleared guest cookies; auth return without losing messages; storage outage.
