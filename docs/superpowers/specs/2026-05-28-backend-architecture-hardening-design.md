# Labzy Backend — Architecture Hardening & Expansion Roadmap (Design)

**Date:** 2026-05-28
**Status:** Approved for planning
**Scope of this spec:** Phase 1 (Hardened Core) in full detail + a lightweight Phase 2–5 expansion roadmap.

---

## Goal

Refactor the existing Labzy lab-diagnostics backend into a clean, layered, production-ready architecture (service layer, DRY error handling, race-free booking, hardened scheduler, notification foundation, tests, container deployment) **without changing the external API contract**, and lay out a dependency-ordered roadmap for PharmEasy-style feature expansion.

## Non-Goals (this phase)

- No payment gateway integration (Razorpay) — deferred to Phase 3.
- No new customer-facing feature domains (reviews, wallet, tracking) — Phases 2–5.
- No migration to serverless, GraphQL, microservices, or a different DB.
- No repository/DAO abstraction over Mongoose (YAGNI).
- No Redis/BullMQ yet (documented upgrade path only).

---

## Context: Current State Inventory

**Stack:** Fastify 5, Mongoose 8, AdminJS 7, deployed to Vercel (`vercel.json`).

**Domain:** lab-diagnostics marketplace (PharmEasy-Labs style) with three actors — `CUSTOMER`, `LAB_OWNER`, `LAB_ASSISTANT` (+ `ADMIN`).

**Models** (`models/`): `user`, `lab`, `test`, `booking`, `subscription`, `report`, `transaction`, `labAssistant`, `admin`, and an orphaned `prescription` (CommonJS — broken under `"type":"module"`).

**Controllers** (`controllers/`): `auth`, `booking`, `lab`, `partner`, `profile`, `report`, `subscription`.

**Routes** (`routes/`): mounted under `/api`; use Fastify JSON-schema validation + `verifyJWT` / `requireRoles` preHandlers (`middlewares/`).

**Infra patterns already present:**
- JWT access + refresh (refresh stored hashed), password reset via email.
- RFC7807 errors via `DomainError` + `Errors` factory (`common/errors.js`) and a global `setErrorHandler` in `app.js`.
- `asyncHandler` wrapper that re-throws into the global handler.
- 2dsphere geo indexes (nearby labs), full-text test search, slot availability computation.
- Subscriptions with recurring bookings via in-process `setInterval` (`jobs/subscriptions.js`), idempotency keys, 15-minute slot holds.
- Firebase Storage for report PDFs (`integrations/storage/storage.js`), signed-URL delivery.
- AdminJS panel with Mongo session store (currently disabled for SRV URIs).

**Confirmed problems (the targets of Phase 1):**
1. Controllers repeat `const err = Errors.X(); return reply.code(err.statusCode).send(err.toRFC7807())` ~everywhere, despite the global handler already doing this.
2. `bookingController.createBooking` slot-capacity check is read-then-write (`countDocuments` → `create`) — a concurrency race that can overflow `maxBookingsPerSlot`.
3. `setInterval` scheduler + persistent `app.listen` + `@fastify/websocket` + AdminJS server sessions are incompatible with Vercel serverless.
4. `createSessionStore()` returns `null` (in-memory sessions) for `mongodb+srv://` URIs → AdminJS sessions lost on every restart in prod.
5. No service layer — logic (slot math, `getOwnedLab`, transitions, analytics) lives in controllers and is duplicated across `booking` and `partner` controllers.
6. 15-minute `slotHoldExpiry` is set on PENDING bookings but nothing ever releases the hold.
7. `cors` dependency is the Express package (wrong runtime); CORS is hand-rolled in an `onRequest` hook.
8. `models/prescription.js` is CommonJS and orphaned.
9. No tests (`npm test` is a stub).

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Deployment/runtime | **Long-running container** (Render/Railway); drop `vercel.json` | Existing code depends on a persistent process (cron, websockets, sessions). Serverless would require rewriting all three for benefits not needed at current scale. |
| Refactor scope | **Layered service refactor** (routes → controllers → services → models) | Sets up clean expansion, follows existing folder style, low-risk, incremental. |
| Error handling | Services/controllers **`throw Errors.X()`**; global handler formats | `asyncHandler` re-throws; Fastify 5 forwards async throws natively. Removes boilerplate. |
| Concurrency | **Atomic per-slot counter** (`SlotCapacity`) with guarded `$inc` | Lock-free, correct under concurrency; transactions alone don't prevent the read-then-write race under snapshot isolation. |
| Scheduler | Keep in-process, add **atomic claim + hold-expiry sweep**; module-ize | Adequate for one instance; safe if scaled; documented BullMQ upgrade path. |
| Payments | **Deferred to Phase 3** | User priority. |
| Expansion order | Reviews (P2) → Payments (P3) → Wallet/coupons (P4) → Home tracking (P5) | Dependency-ordered: wallet needs payments; tracking needs notifications (built in P1). |

---

## Target Architecture

```
HTTP request
   │
   ▼
routes/*.js ............ URL + method, JSON-schema validation, preHandlers (verifyJWT, requireRoles)
   │  (validated request)
   ▼
controllers/*.js ....... thin: read request → call service → reply.send(result); throws on error
   │  (plain args)
   ▼
services/*.js .......... ALL business logic + DB orchestration; returns plain data or throws Errors.X()
   │
   ▼
models/*.js ............ Mongoose schemas (data layer)

cross-cutting:
  common/errors.js ..... DomainError + Errors factory          (existing)
  app.js setErrorHandler global RFC7807 formatter              (existing)
  services/notificationService.js  FCM + websocket + (later) SMS   (NEW)
  scheduler/*.js ....... named recurring jobs, atomic claim    (refactor of jobs/)
  config/env.js ........ fail-fast env validation              (extend)
```

**Layer contract:** a controller never touches a Mongoose model directly after this refactor; it only calls services. A service never touches `request`/`reply`; it takes plain arguments and returns plain data or throws.

---

## Phase 1 Detailed Design

### A. Deployment & runtime

- **Remove** `vercel.json`. Add `Dockerfile` (node:20-alpine, `npm ci`, `CMD ["node","app.js"]`) and a `.dockerignore`.
- Add `GET /health` route returning `{ status: 'ok', uptime, db: <connected|disconnected> }` (no auth) for container health checks.
- `package.json`: keep `start` for dev (nodemon); add `start:prod` → `node app.js`. Container uses `start:prod`.
- **Fix AdminJS session store:** `createSessionStore()` must build a working store for `mongodb+srv://` URIs (connect-mongodb-session supports SRV; pass `databaseName` and let the driver resolve). Only fall back to in-memory if the store genuinely fails to construct.

**Acceptance:** app boots via `node app.js` in a container; `GET /health` returns 200; AdminJS login survives a restart against an Atlas SRV URI.

### B. Service layer extraction

Create one service module per domain. Each exports plain async functions; logic moves out of the corresponding controller verbatim (behavior-preserving), then controllers call them.

- `services/authService.js` — register, login, refresh-rotate, logout, forgot/reset password, token issuance.
- `services/bookingService.js` — `createBooking`, `listBookings`, `getBookingForUser`, `cancelBooking`, `getBookingReportUrl`. Owns the slot reservation (see D) and the `VALID_TRANSITIONS` state machine (single source of truth, currently duplicated in `bookingController` and `partnerController`).
- `services/labCatalogService.js` — `searchTests`, `listLabs`, `nearbyLabs`, `getLab`, `getLabTests`, `computeLabSlots`.
- `services/partnerService.js` — `getOwnedLab`, daily/paginated partner bookings, accept/reject (uses shared transitions), assistant CRUD + availability, report upload/link, analytics aggregations.
- `services/subscriptionService.js` — create/pause/resume/cancel subscription, `nextBookingDate` math (shared with scheduler), `runDueSubscriptions`.
- `services/reportService.js` — report creation/linking, signed-URL retrieval, access checks.
- `services/profileService.js` — profile read/update, address management, fcmToken update.
- `services/notificationService.js` — see F.

Shared helpers used by both booking and partner services live in `services/_shared/transitions.js` (`VALID_TRANSITIONS`, `assertTransition(from, to)`) and `services/_shared/slotTime.js` (slot-time math). They are imported by both services, never copy-pasted. `reportService` owns report document creation and signed-URL retrieval; `partnerService.uploadReport` only handles the multipart file stream + storage upload, then delegates document creation/linking to `reportService`.

**Acceptance:** controllers contain no Mongoose queries; `VALID_TRANSITIONS` is defined once; existing endpoint responses are byte-for-byte equivalent (verified by tests).

### C. Error-handling DRY-up

Replace every occurrence of:
```js
const err = Errors.X(...);
return reply.code(err.statusCode).send(err.toRFC7807());
```
with `throw Errors.X(...)` (thrown from the service, where the check now lives). The `asyncHandler`/Fastify pipeline forwards to the global handler. Controllers keep only `reply.code(2xx).send(result)` on the success path.

**Acceptance:** no controller or service calls `.toRFC7807()` directly; all error responses still match the RFC7807 shape (test a 404 and a 409).

### D. Race-free slot booking (`SlotCapacity` counter)

New model `models/slotCapacity.js`:
```
{
  lab:        ObjectId(ref Lab),
  day:        String,   // 'YYYY-MM-DD' (lab-local date key)
  slotStart:  String,   // '10:00'
  count:      Number,   // active reservations (PENDING/CONFIRMED/COLLECTED)
}
unique index: { lab: 1, day: 1, slotStart: 1 }
```

**Reserve (in `bookingService.createBooking`, before creating the Booking):**
1. Ensure the counter exists: `findOneAndUpdate({lab,day,slotStart}, {$setOnInsert:{count:0}}, {upsert:true})`.
2. Guarded increment: `findOneAndUpdate({lab,day,slotStart, count:{$lt:maxPerSlot}}, {$inc:{count:1}}, {new:true})`.
3. If step 2 returns `null` → slot full → `throw Errors.SLOT_UNAVAILABLE(...)`.
4. Create the Booking only after a successful increment.

**Release `$inc:{count:-1}` (guard `count > 0`) when:** booking is cancelled (customer or partner) or its `slotHoldExpiry` lapses while still PENDING (handled by the sweep in E).

Replace the old `countDocuments` check entirely. (`maxPerSlot` from `lab.slotMatrix.maxBookingsPerSlot`, default 5.)

**Acceptance:** a concurrency test firing N+1 simultaneous bookings at a slot of capacity N yields exactly N successes and 1 `SLOT_UNAVAILABLE`; cancelling one then allows one more.

### E. Scheduler hardening (`scheduler/`)

Refactor `jobs/subscriptions.js` into `scheduler/index.js` (registers jobs) + `scheduler/jobs/`:
- `subscriptionsJob` — atomically **claim** due subs before processing: `findOneAndUpdate({_id, lockedAt:{$lt: now-staleWindow} OR null}, {$set:{lockedAt: now}})`; process only claimed docs; clear `lockedAt` on completion. Keeps existing idempotency-key behavior. Calls `subscriptionService.runDueSubscriptions`.
- `slotHoldSweepJob` (NEW) — find PENDING bookings with `slotHoldExpiry < now`, set them `CANCELLED` (reason: hold expired) and release the `SlotCapacity` counter (`$inc:-1`).
- Each job is a named export with its own interval; `scheduler/index.js` wires intervals and logs start/finish. Top-of-file comment documents the "swap to BullMQ + Redis when you outgrow a single instance" path.

**Acceptance:** an expired-hold PENDING booking is auto-cancelled and its slot counter decremented within one sweep interval; subscription double-processing is prevented when two scheduler ticks overlap (claim test).

### F. Notification foundation (`services/notificationService.js`)

Single interface, multiple channels:
```
notify({ userId, event, title, body, data }) →
   - push:      firebase-admin FCM to user.fcmToken (if FCM_ENABLED && token present)
   - realtime:  websocket broadcast to the user's subscribed socket(s)
   - (sms:      twilio — stubbed interface, not wired this phase)
```
Fired from `bookingService` / `partnerService` on transitions: `CONFIRMED`, `COLLECTED`, `COMPLETED`, `CANCELLED`. Failures are logged, never block the request. Websocket connection registry keyed by userId lives here (the `@fastify/websocket` route hands sockets to this service).

**Acceptance:** a status transition triggers a `notificationService.notify` call (asserted via a spy in tests); a missing `fcmToken` or disabled FCM degrades gracefully without throwing.

### G. Config & cleanup

- Add `@fastify/cors`; remove the manual CORS `onRequest` hook and the Express `cors` dependency. Config: `origin` = `*` in dev, `FRONTEND_URL` in prod; methods/headers as today.
- Extend the fail-fast block in `app.js` (currently `JWT_SECRET` only) to also require `MONGO_URI` and `COOKIE_PASSWORD`; centralize the assertions in `config/env.js` as `assertRequiredEnv()`.
- Delete `models/prescription.js` (orphaned, broken CommonJS). A proper ESM `Prescription` model will be introduced if/when an e-pharmacy phase needs it.

**Acceptance:** boot fails fast with a clear message if any required env is missing; CORS preflight (`OPTIONS`) returns 204 with correct headers; no import references `prescription.js`.

### H. Testing harness

- Add dev deps: a test runner (`node:test` built-in, run via `node --test`) + `mongodb-memory-server`. Use Fastify `app.inject()` for HTTP-level tests and direct service calls for unit tests.
- A `tests/helpers/buildApp.js` builds the Fastify app against an in-memory Mongo and seeds fixtures (one lab, tests, a customer, a lab owner).
- `npm test` → `node --test`.
- **Priority coverage:**
  - Slot-capacity concurrency (D) — the headline correctness test.
  - Booking state-machine transitions (valid + invalid) (B/C).
  - Auth: register/login, refresh-token rotation + reuse rejection (B).
  - RBAC: customer-only and partner-only routes reject the wrong role.
  - Error shape: a 404 and a 409 return valid RFC7807 bodies (C).
  - Slot-hold sweep auto-cancels + decrements (E).

**Acceptance:** `npm test` runs green locally and in the container build.

---

## Expansion Roadmap (each becomes its own spec → plan)

### Phase 2 — Reviews & ratings
`models/review.js` `{ user, lab, booking, rating(1–5), comment, createdAt }`, unique `(user, booking)`. A review is allowed only when the user has a `COMPLETED` booking at that lab. On create/update/delete, atomically recompute `lab.rating` and `lab.totalRatings` (aggregate or running update). Endpoints: customer create/edit/delete own review; public list per lab (paginated); partner read-only. Independent of payments → first expansion.

### Phase 3 — Payments (Razorpay)
On booking, create a Razorpay order; expose order details to the client. HMAC-verified webhook drives the `Transaction` lifecycle (`PENDING→AUTHORIZED→CAPTURED`/`FAILED`/`REFUNDED`). Payment success gates `PENDING→CONFIRMED`; cancellation triggers refund. Reuse existing `Transaction` model + `WEBHOOK_SIGNATURE_INVALID`/`PAYMENT_FAILED` errors. Prerequisite for Phase 4.

### Phase 4 — Wallet / coupons / referrals
`Wallet` (balance + append-only ledger), `Coupon` (code, type, value, validity, usage caps), referral credit issuance. Validation + application at checkout, integrated with Phase 3 payment amount computation. Depends on Phase 3.

### Phase 5 — Home-collection tracking
Assistant collection status (`ASSIGNED→EN_ROUTE→ARRIVED→COLLECTED`) on HOME bookings, optional live location pushed over websocket, customer notifications at each step. Builds on Phase 1's `notificationService` + existing assistant-assignment flow.

---

## Risks & Mitigations

- **Behavior drift during refactor (B/C):** mitigate by writing characterization tests (H) for the key endpoints *before* moving logic, so responses are verified unchanged.
- **`SlotCapacity` drift vs. Booking reality (D):** the hold-sweep (E) and cancel paths are the only decrement sources; a periodic reconcile job can be added later if drift is observed (out of scope now).
- **Single-instance scheduler assumption (E):** acceptable for one container; the atomic claim makes a future second instance safe, and the BullMQ path is documented.

## Open Questions

- Render vs. Railway specifically (either works; pick on pricing/ops preference) — does not affect the code.
- Whether to keep AdminJS long-term or move admin to the same layered API later (out of scope; keep AdminJS for now).
