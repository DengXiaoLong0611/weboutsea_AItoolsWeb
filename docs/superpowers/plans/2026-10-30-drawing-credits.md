# Drawing Credits Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the tasks in order.

**Goal:** Anonymous first generation, two lifetime free generations including guest usage after login, then purchase gate.
**Architecture:** Supabase transaction RPC for durable counters, signed anonymous cookie, existing image provider and auth.
**Tech Stack:** Next.js, TypeScript, Supabase Postgres, node:test.
**Spec:** docs/superpowers/specs/2026-10-30-drawing-credits-design.md

## Global Constraints

- Preserve existing uncommitted work. No deployment, real paid generation or fake payment.
- Fail closed on missing shared storage. No client-controlled user identity or credit increments.
- No IP quota using untrusted headers. Global daily guest attempt ceiling of 20.

## Review Focus

- Concurrent guest requests and cross-device account requests cannot overspend.
- Guest-to-account binding does not replenish free credits.
- Failed provider calls refund once; missing settlement never grants extra credits.
- Invalid return URLs cannot redirect off-site.
- No database secrets or provider details reach browser errors.

## Task 1: Shared quota store

- [ ] Add failing tests for signed visitor identity, RPC argument validation and unavailable storage.
- [ ] Add migration, locked reserve/settle/status RPC, and server adapter.
- [ ] Verify quota tests; provide transaction SQL acceptance script for actual Postgres.

## Task 2: Generation integration and auth return

- [ ] Add failing generation tests for reserve/settle success, failure refund and rejection before provider.
- [ ] Wire authenticated account and anonymous identity into RPC; report real remaining credits.
- [ ] Preserve validated hand-drawn return URL through login/signup.
- [ ] Run node tests and type checks.

## Task 3: UI and setup

- [ ] Test remaining-credit display, login/purchase gates and controls after failures.
- [ ] Update studio copy and refresh allowance after generation or returning from login.
- [ ] Document SQL execution, server secrets, payment limitation and operational recovery.
- [ ] Run full tests, lint/type checks and local HTTP smoke verification.
