# Phase 1 Hardening — Subagent-Driven Execution Ledger

Plan: docs/superpowers/plans/2026-05-28-backend-architecture-hardening-phase1.md
Mode: NO GIT COMMITS this run (user directive) — working tree only, no worktree isolation.
Review method: implementer edits files directly (no commit) -> reviewer reads current file state
  for the files named in the task brief (git diff against HEAD is NOT task-scoped since tasks
  1-23 are also uncommitted; reviewers must read full current file content, not a diff).

## Pre-existing state (audited before this run)
- Tasks 1-23: DONE (implementation-complete). Missing test files for Tasks 6,7,8,9,10 (labCatalog.test.js,
  partner.test.js, auth.test.js, notification.test.js, scheduler.test.js) and 13-16 (bookingAdvance,
  reschedule, report, notifications tests).
- Known regression: tests/customerSignup.test.js:57 "POST /auth/consents ... " expects 200, got 401.
- All other existing tests pass (13/14).

## Standing constraints for every task dispatch
- No `git commit` / `git add` — leave changes in working tree.
- SMS/telephony: any SMS or masked-calling provider integration must remain a non-functional
  stub (never call a real provider). Phone numbers are collected as unverified contact-only data.
  (User memory: feedback_email_password_auth.md)
- Never implement SMS OTP / phone-OTP auth for any role.

## Known systemic issue (flagged, not yet fixed)
`config/env.js` reads `process.env.*` into frozen top-level `export const`s at module-evaluation time.
Any test file whose static (hoisted) imports transitively touch `config/env.js` BEFORE that file's own
`setupTestApp()` call runs (inside a `before`/`beforeEach`) gets `JWT_SECRET` etc. frozen as `undefined`,
causing intermittent `secretOrPrivateKey must have a value` failures. Independently discovered and locally
worked around by both the Task 25 agent (`models/lab.js` -> dynamic `import()` inside the post-save hook
instead of a static top-level import) and the Task 29 agent (deferred import inside `before()` in its new
test file). Both workarounds are correct and scoped to their own files, but the root cause remains
unfixed in `config/env.js` and could bite any future test file that statically imports something touching
it. Recommend a dedicated follow-up task post-plan-completion: make `config/env.js` lazy (getters or a
`getEnv()` accessor) instead of freezing at import time. Not fixed now — too invasive/wide-blast-radius to
risk while multiple implementer agents are concurrently editing overlapping files.

## Task Status
(updated as tasks complete)

- Regression fix (auth/consents 401): DONE (test data bug, name 'A' violated minLength:2; fixed. Full suite 14/14.)
- Task 24 (session cap + account deletion): DONE (spec ✅, quality approved incl. independently-verified bcrypt-72-byte-truncation security fix in refresh-token hashing, 26/26 tests)
- Task 25 (lab discovery v2): DONE (spec ✅, quality approved, 47/47 tests independently verified across
  multiple runs. Reviewer confirmed the $geoNear/aggregation shape change is safe, the lab-watch pre/post-save
  hook fires exactly once per genuine activation and never on unrelated saves, and the env-var-freeze fix in
  models/lab.js is sound. See "Known systemic issue" note above re: config/env.js.)
- Task 26 (lab profile depth): DONE (spec ✅, quality approved, 26/26 tests independently verified by reviewer)
- Task 27 (booking state machine v2 + event log): DONE (spec ✅ 100%, quality approved, 41/41 tests independently
  verified. Reviewer flagged 3 PRE-EXISTING (not regressions) audit-trail gaps out of this task's scope for a
  future follow-up task: scheduler/jobs/slotHoldSweepJob.js, services/reportService.js linkReport (also bypasses
  assertTransition — most serious), services/paymentService.js handleRazorpayWebhook. None call recordEvent.)
- Task 28 (booking policy v2): DONE (spec ✅, quality approved, 63/63 tests independently verified. Reviewer
  approved both judgment calls: CANCELLATION_FEE_APPLICABLE left as a non-blocking cancelReason note pending
  Task 34's charging logic, and the SLA sweep intentionally scoped to lab-response-only per FR-10, distinct
  from the existing slot-hold sweep. One trivial stale comment flagged (booking.js:56 still says "15-min hold"
  in a comment; code is correct) — not worth a fix-loop cycle for.
- Task 29 (subscription v2): DONE (spec ✅ 100%, quality approved, 41/41 tests independently verified,
  lockedAt atomic claim-locking race-safety property explicitly confirmed intact by reviewer. Minor note:
  old runDueSubscriptions() left as unused dead code in subscriptionService.js — acceptable per reviewer,
  optional cleanup later.)
- Task 30 (sample-collection OTP + masked calling + visit notes): DONE (spec ✅, quality approved, 47/47 tests
  independently verified. Reviewer did a byte-for-byte audit of services/maskedCallService.js and explicitly
  confirmed zero network calls under any configuration — the hard non-functional-stub constraint holds.)
- Task 31 (sample issue -> re-collection): NOT STARTED
- Task 32 (reports v2): NOT STARTED
- Task 33 (payments v2): DONE (spec ✅, quality approved, 71/71 tests independently verified. Reviewer traced
  the full graceful-degradation path and explicitly confirmed a Firebase/PDF failure never breaks the payment
  webhook. Double-pay reversal, partial refund validation, and the optional PENDING->CONFIRMED
  assertTransition/recordEvent cleanup all confirmed correct. Two documented non-blocking races (invoice
  number generation, concurrent refund check-then-act) flagged as acceptable for MVP scope.)
- Task 34 (promo codes): NOT STARTED
- Task 35 (notification preferences + SMS fallback): NOT STARTED
- Task 36 (reviews v2): NOT STARTED
- Task 37 (help & support tickets): DONE (spec ✅, quality approved, 7/7 new tests + full suite verified.
  Fully additive — 4 new files + 1-line routes/index.js registration. No new error codes added.)
- Task 38 (lab docs + verification + vacation + branches): NOT STARTED
- Task 39 (master test directory + publish states): NOT STARTED
- Task 40 (staff roles): NOT STARTED
- Task 41 (lab-scoped customer notes): NOT STARTED
- Task 42 (analytics v2): NOT STARTED
- Task 43 (earnings/settlements/disputes): NOT STARTED
- Task 44 (data export + consent center + i18n): NOT STARTED
- Task 45 (partner notifications v2): NOT STARTED
