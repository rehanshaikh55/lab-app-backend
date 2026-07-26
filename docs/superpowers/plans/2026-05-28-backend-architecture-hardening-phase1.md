# Labzy Backend — Phase 1 (Hardened Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Git note:** The user controls version control. This plan does **not** run `git commit`/`push`. Each task ends at a clean, self-contained checkpoint — commit yourself when ready.

**Goal:** Refactor the existing Labzy lab-diagnostics backend into a layered architecture (routes → controllers → services → models) with DRY error handling, a race-free slot-booking path, a hardened scheduler, a notification foundation, container deployment, and a test harness — without changing the external API contract.

**Architecture:** Fastify 5 controllers become thin (parse validated input → call a service → `reply.send`; they `throw Errors.X()`). All business logic + Mongoose access lives in `services/`. A new `SlotCapacity` collection makes slot reservation atomic. The in-process scheduler gains an atomic claim + a slot-hold-expiry sweep. A `notificationService` wraps FCM + websocket. Deploy as a long-running container (drop Vercel).

**Tech Stack:** Node 20 (ESM), Fastify 5, Mongoose 8, `@fastify/cors`, `@fastify/websocket`, `firebase-admin`, `node:test` + `mongodb-memory-server` for tests.

**Source design:** `docs/superpowers/specs/2026-05-28-backend-architecture-hardening-design.md`

**Reference — current behavior the refactor must preserve (verified in source):**
- `common/errors.js` exports `DomainError` + `Errors` factory; `app.js` `setErrorHandler` renders any thrown `DomainError` as RFC7807. `utils/asyncHandler.js` re-throws into that handler; Fastify 5 also forwards async throws from handlers and preHandlers natively.
- `verifyJWT` sets `request.user` to the User doc (minus `passwordHash`/`refreshToken`). `requireRoles(...roles)` checks `request.user.roles`.
- Booking state machine: `PENDING→{CONFIRMED,CANCELLED}`, `CONFIRMED→{COLLECTED,CANCELLED}`, `COLLECTED→{COMPLETED}`.
- `storage` adapter exposes `getSignedUrl(path)`, `uploadBuffer(buffer, path, contentType)`, `deleteFile(path)`.

---

## File Structure (created / modified across the plan)

**Create:**
- `services/_shared/transitions.js` — booking state machine (single source of truth)
- `services/_shared/slotTime.js` — slot/day time helpers
- `models/slotCapacity.js` — atomic per-slot counter
- `services/slotCapacityService.js` — reserve/release
- `services/bookingService.js`, `services/labCatalogService.js`, `services/partnerService.js`, `services/reportService.js`, `services/profileService.js`, `services/subscriptionService.js`, `services/authService.js`
- `services/notificationService.js` — FCM + websocket
- `scheduler/index.js`, `scheduler/jobs/subscriptionsJob.js`, `scheduler/jobs/slotHoldSweepJob.js`
- `tests/helpers/buildApp.js` + test files per task
- `Dockerfile`, `.dockerignore`

**Modify:** `app.js`, `config/env.js`, all 7 controllers, `middlewares/authMiddleware.js`, `middlewares/rbacMiddleware.js`, `package.json`, `controllers/profileController.js` (dedupe), `config/config.js` (session store)

**Delete:** `models/prescription.js`, `jobs/subscriptions.js` (replaced by `scheduler/`), `vercel.json`

---

## Task 1: Testable app factory + `/health` + test harness

**Files:**
- Modify: `app.js`
- Modify: `package.json`
- Create: `tests/helpers/buildApp.js`
- Create: `tests/health.test.js`

- [ ] **Step 1: Install test + cors deps**

Run:
```bash
npm install @fastify/cors
npm install -D mongodb-memory-server
```
Expected: both added to `package.json`.

- [ ] **Step 2: Refactor `app.js` to export a `buildApp()` factory**

Replace the entire contents of `app.js`:

```js
import "dotenv/config";
import Fastify from 'fastify';
import mongoose from 'mongoose';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { connectDB } from "./config/connect.js";
import { PORT, NODE_ENV, FRONTEND_URL } from "./config/env.js";
import { assertRequiredEnv } from "./config/env.js";
import { admin, buildAdminRouter } from "./config/setup.js";
import { registerRoutes } from "./routes/index.js";
import { initScheduler } from "./scheduler/index.js";
import { DomainError } from "./common/errors.js";

export const buildApp = async ({ withAdmin = true } = {}) => {
  const app = Fastify({
    logger: { level: NODE_ENV === 'production' ? 'info' : 'debug' },
  });

  await app.register(cors, {
    origin: NODE_ENV === 'production' ? FRONTEND_URL : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.register(websocket);

  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }));

  await registerRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled error");
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send(error.toRFC7807());
    }
    if (error.validation) {
      return reply.code(400).send({
        type: 'https://labzy.in/errors/VALIDATION_ERROR',
        title: 'Validation Error',
        status: 400,
        detail: error.message,
      });
    }
    const status = error.statusCode || 500;
    reply.code(status).send({
      type: 'https://labzy.in/errors/INTERNAL_ERROR',
      title: 'Internal Server Error',
      status,
      detail: NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    });
  });

  if (withAdmin) {
    await buildAdminRouter(app);
  }

  return app;
};

export const start = async () => {
  assertRequiredEnv();
  await connectDB(process.env.MONGO_URI);
  const app = await buildApp();
  initScheduler(app);
  app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    } else {
      app.log.info(`Lab app started on Port: ${PORT}${admin.options.rootPath}`);
    }
  });
};

// Run only when executed directly (not when imported by tests)
if (process.argv[1] && process.argv[1].endsWith('app.js')) {
  start();
}
```

> Note: `assertRequiredEnv`, `initScheduler`, and the `FRONTEND_URL` export are introduced in Tasks 2/10/2 respectively. Until those tasks land, this file will not boot via `start()`, but `buildApp({withAdmin:false})` (used by tests) works once Task 2 adds the env exports. Implement Task 2 immediately after this step.

- [ ] **Step 3: Add the test harness helper**

Create `tests/helpers/buildApp.js`:

```js
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

export const setupTestApp = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.MONGO_URI = uri;
  process.env.COOKIE_PASSWORD = 'test-cookie-password-at-least-32-chars';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);
  const { buildApp } = await import('../../app.js');
  const app = await buildApp({ withAdmin: false });
  await app.ready();
  return app;
};

export const teardownTestApp = async (app) => {
  if (app) await app.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};
```

- [ ] **Step 4: Write the failing `/health` test**

Create `tests/health.test.js`:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';

let app;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

test('GET /health returns ok + connected db', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'connected');
});
```

- [ ] **Step 5: Wire `npm test` and run**

In `package.json` `scripts`, set (glob limits discovery to `tests/` so `node --test` does not pick up `models/test.js`, a Mongoose model named `test.js`; the quoted glob is expanded by Node, not the shell, so it works on Windows cmd and bash). Note: a bare directory arg (`node --test tests/`) is NOT supported in Node 22 — use the glob:
```json
"test": "node --test \"tests/**/*.test.js\"",
"start": "nodemon app.js",
"start:prod": "node app.js"
```
Run: `npm test`
Expected: this test FAILS to import until Task 2 adds the missing `config/env.js` exports (`assertRequiredEnv`, `FRONTEND_URL`, `NODE_ENV`, `PORT`) and Task 10 adds `scheduler/index.js`. Because `app.js` imports `./scheduler/index.js` at module load, add a temporary stub now to unblock: create `scheduler/index.js` with `export const initScheduler = () => {};` (replaced fully in Task 10).

**Checkpoint:** `buildApp` is importable and `app.inject` works. Commit when ready.

---

## Task 2: Env hardening + CORS finalize + delete dead files

**Files:**
- Modify: `config/env.js`
- Create: `tests/env.test.js`
- Delete: `models/prescription.js`
- Modify: `package.json` (optional: drop unused `cors` express package)

- [ ] **Step 1: Write the failing env-assertion test**

Create `tests/env.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRequiredEnv } from '../config/env.js';

test('assertRequiredEnv throws when a required var is missing', () => {
  const saved = process.env.MONGO_URI;
  delete process.env.MONGO_URI;
  process.env.JWT_SECRET = 'x';
  process.env.COOKIE_PASSWORD = 'y';
  assert.throws(() => assertRequiredEnv(), /MONGO_URI/);
  process.env.MONGO_URI = saved;
});

test('assertRequiredEnv passes when all present', () => {
  process.env.JWT_SECRET = 'x';
  process.env.MONGO_URI = 'mongodb://localhost/x';
  process.env.COOKIE_PASSWORD = 'y';
  assert.doesNotThrow(() => assertRequiredEnv());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/env.test.js`
Expected: FAIL — `assertRequiredEnv` is not exported.

- [ ] **Step 3: Add `assertRequiredEnv` to `config/env.js`**

Append to `config/env.js` (keep all existing exports):

```js
const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI', 'COOKIE_PASSWORD'];

export const assertRequiredEnv = () => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`FATAL: missing required env vars: ${missing.join(', ')}`);
  }
};
```

- [ ] **Step 4: Run env test + health test**

Run: `node --test tests/env.test.js tests/health.test.js`
Expected: PASS.

- [ ] **Step 5: Delete dead code**

Delete `models/prescription.js` (orphaned CommonJS; nothing imports it — verify with a search for `prescription` before deleting). The hand-rolled CORS hook was already removed in Task 1 (replaced by `@fastify/cors`).

Run: `npm test`
Expected: PASS (health + env).

**Checkpoint:** boot fails fast on missing env; CORS handled by `@fastify/cors`. Commit when ready.

---

## Task 3: Shared transitions + slot-time modules

**Files:**
- Create: `services/_shared/transitions.js`
- Create: `services/_shared/slotTime.js`
- Create: `tests/shared.test.js`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/shared.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertTransition, VALID_TRANSITIONS } from '../services/_shared/transitions.js';
import { dayKey, weekdayName, addMinutes } from '../services/_shared/slotTime.js';

test('valid transitions', () => {
  assert.equal(canTransition('PENDING', 'CONFIRMED'), true);
  assert.equal(canTransition('CONFIRMED', 'COLLECTED'), true);
  assert.equal(canTransition('COMPLETED', 'CANCELLED'), false);
});

test('assertTransition throws DomainError on invalid', () => {
  assert.throws(() => assertTransition('COMPLETED', 'CANCELLED'), /INVALID_BOOKING_TRANSITION|Cannot move/);
});

test('slot time helpers', () => {
  assert.equal(addMinutes('10:00', 30), '10:30');
  assert.equal(addMinutes('09:45', 30), '10:15');
  assert.equal(dayKey('2026-05-28T10:00:00.000Z'), '2026-05-28');
  // Construct via local Y/M/D so weekday is TZ-independent (May 28 2026 is a Thursday).
  assert.equal(weekdayName(new Date(2026, 4, 28)), 'thursday');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/shared.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `services/_shared/transitions.js`**

```js
import { Errors } from '../../common/errors.js';

export const VALID_TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const canTransition = (from, to) =>
  VALID_TRANSITIONS[from]?.includes(to) ?? false;

export const assertTransition = (from, to, detail) => {
  if (!canTransition(from, to)) {
    throw Errors.INVALID_BOOKING_TRANSITION(detail || `Cannot move booking from ${from} to ${to}`);
  }
};
```

- [ ] **Step 4: Implement `services/_shared/slotTime.js`**

```js
// Day key in UTC; reserve and release must both use this so they agree.
export const dayKey = (date) => new Date(date).toISOString().slice(0, 10); // 'YYYY-MM-DD'

// Matches existing controllers' weekday derivation (server-local long weekday).
export const weekdayName = (date) =>
  new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

// 'HH:MM' + minutes -> 'HH:MM'
export const addMinutes = (hhmm, minutes) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/shared.test.js`
Expected: PASS.

**Checkpoint:** state machine + time math have one home. Commit when ready.

---

## Task 4: `SlotCapacity` model + atomic reserve/release (the race fix)

**Files:**
- Create: `models/slotCapacity.js`
- Create: `services/slotCapacityService.js`
- Create: `tests/slotCapacity.test.js`

- [ ] **Step 1: Write the failing concurrency test**

Create `tests/slotCapacity.test.js`:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod, reserveSlot, releaseSlot;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  ({ reserveSlot, releaseSlot } = await import('../services/slotCapacityService.js'));
});
after(async () => { await mongoose.disconnect(); await mongod.stop(); });

test('reserve allows exactly maxPerSlot concurrent reservations', async () => {
  const labId = new mongoose.Types.ObjectId();
  const args = { labId, scheduledDate: '2026-06-01', slotStart: '10:00', maxPerSlot: 3 };
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => reserveSlot(args)),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  assert.equal(ok, 3);
  assert.equal(failed, 2);
});

test('release frees a slot so one more can reserve', async () => {
  const labId = new mongoose.Types.ObjectId();
  const args = { labId, scheduledDate: '2026-06-02', slotStart: '11:00', maxPerSlot: 1 };
  await reserveSlot(args);
  await assert.rejects(() => reserveSlot(args), /fully booked|SLOT_UNAVAILABLE/);
  await releaseSlot(args);
  await assert.doesNotReject(() => reserveSlot(args));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/slotCapacity.test.js`
Expected: FAIL — service not found.

- [ ] **Step 3: Implement `models/slotCapacity.js`**

```js
import mongoose from 'mongoose';

const slotCapacitySchema = new mongoose.Schema({
  lab:       { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  day:       { type: String, required: true }, // 'YYYY-MM-DD'
  slotStart: { type: String, required: true }, // '10:00'
  count:     { type: Number, default: 0 },
}, { timestamps: true });

slotCapacitySchema.index({ lab: 1, day: 1, slotStart: 1 }, { unique: true });

export default mongoose.model('SlotCapacity', slotCapacitySchema);
```

- [ ] **Step 4: Implement `services/slotCapacityService.js`**

```js
import SlotCapacity from '../models/slotCapacity.js';
import { Errors } from '../common/errors.js';
import { dayKey } from './_shared/slotTime.js';

export const reserveSlot = async ({ labId, scheduledDate, slotStart, maxPerSlot }) => {
  const day = dayKey(scheduledDate);
  const key = { lab: labId, day, slotStart };

  // Ensure the counter document exists (idempotent; ignore concurrent-insert dup-key).
  try {
    await SlotCapacity.updateOne(key, { $setOnInsert: { count: 0 } }, { upsert: true });
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  // Atomic guarded increment: only succeeds if count < max.
  const updated = await SlotCapacity.findOneAndUpdate(
    { ...key, count: { $lt: maxPerSlot } },
    { $inc: { count: 1 } },
    { new: true },
  );

  if (!updated) {
    throw Errors.SLOT_UNAVAILABLE(`The ${slotStart} slot on ${day} is fully booked`, '/bookings');
  }
  return updated;
};

export const releaseSlot = async ({ labId, scheduledDate, slotStart }) => {
  const day = dayKey(scheduledDate);
  await SlotCapacity.findOneAndUpdate(
    { lab: labId, day, slotStart, count: { $gt: 0 } },
    { $inc: { count: -1 } },
  );
};
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/slotCapacity.test.js`
Expected: PASS (3 reserved, 2 rejected; release frees one).

**Checkpoint:** booking concurrency is provably bounded. Commit when ready.

---

## Task 5: `bookingService` + thin `bookingController`

**Files:**
- Create: `services/bookingService.js`
- Modify: `controllers/bookingController.js`
- Create: `tests/booking.test.js`

> Behavior change vs. today: the old `countDocuments` capacity check is replaced by `reserveSlot`; cancellation now calls `releaseSlot`. All subscription-created bookings will also reserve (Task 10), so every booking is counted and every cancel/expiry releases — keeping `SlotCapacity` consistent.

- [ ] **Step 1: Write the failing booking tests**

Create `tests/booking.test.js`:

```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import bcrypt from 'bcryptjs';

let app, token, lab, testDoc;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({})]);
  const owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'] });
  lab = await Lab.create({
    owner: owner._id, name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:1 },
    isActive:true, isVerified:true,
  });
  testDoc = await Test.create({ lab: lab._id, name:'CBC', price:300, isActive:true });
  await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  token = login.json().accessToken;
});

const futureThursday = '2026-06-04'; // a Thursday

test('creates a booking (201) and rejects a second at a capacity-1 slot (409)', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'10:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(a.statusCode, 201);
  const b = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(b.statusCode, 409);
  assert.equal(b.json().type, 'https://labzy.in/errors/SLOT_UNAVAILABLE');
});

test('cancel releases the slot', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'12:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = a.json().booking._id;
  const cancel = await app.inject({ method:'POST', url:`/api/bookings/${id}/cancel`, headers:{ authorization:`Bearer ${token}` }, payload:{} });
  assert.equal(cancel.statusCode, 200);
  const again = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(again.statusCode, 201);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/booking.test.js`
Expected: FAIL — `bookingService` not found / old controller logic differs.

- [ ] **Step 3: Implement `services/bookingService.js`**

```js
import Booking from '../models/booking.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { assertTransition } from './_shared/transitions.js';
import { addMinutes, weekdayName } from './_shared/slotTime.js';
import { reserveSlot, releaseSlot } from './slotCapacityService.js';
import { notifyBookingStatus } from './notificationService.js';

export const createBooking = async ({ user, labId, testIds, scheduledDate, slot, collectionType, userAddressId }) => {
  const lab = await Lab.findById(labId);
  if (!lab || !lab.isActive) throw Errors.NOT_FOUND('Lab', '/bookings');

  const dayHours = lab.openingHours?.[weekdayName(scheduledDate)];
  if (!dayHours || dayHours.isClosed) throw Errors.LAB_CLOSED('Lab is closed on that day');

  const tests = await Test.find({ _id: { $in: testIds }, lab: labId, isActive: true });
  if (tests.length !== testIds.length) throw Errors.VALIDATION_ERROR('One or more tests not found or inactive for this lab');
  const totalAmount = tests.reduce((sum, t) => sum + t.price, 0);

  let userAddress = null;
  if (collectionType === 'HOME' && userAddressId) {
    const addr = user.addresses?.find((a) => a._id.toString() === userAddressId);
    if (addr) userAddress = addr.toObject();
  }

  const duration = lab.slotMatrix?.duration || 30;
  const maxPerSlot = lab.slotMatrix?.maxBookingsPerSlot || 5;
  const slotEnd = addMinutes(slot.start, duration);

  await reserveSlot({ labId, scheduledDate, slotStart: slot.start, maxPerSlot });
  try {
    return await Booking.create({
      user: user._id,
      lab: labId,
      tests: testIds,
      scheduledDate: new Date(scheduledDate),
      slot: { start: slot.start, end: slotEnd },
      collectionType,
      userAddress,
      totalAmount,
      slotHoldExpiry: new Date(Date.now() + 15 * 60 * 1000),
      status: 'PENDING',
    });
  } catch (err) {
    await releaseSlot({ labId, scheduledDate, slotStart: slot.start });
    throw err;
  }
};

export const listBookings = async ({ userId, status, page = 1, limit = 20 }) => {
  const query = { user: userId };
  if (status) query.status = status;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('lab', 'name address')
      .populate('tests', 'name price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Booking.countDocuments(query),
  ]);
  return { bookings, total, page: parseInt(page), limit: parseInt(limit) };
};

export const getBookingForUser = async ({ userId, bookingId }) => {
  const booking = await Booking.findById(bookingId)
    .populate('lab', 'name address phone')
    .populate('tests', 'name price sampleRequirements')
    .populate('report')
    .populate('labAssistant', 'name phone');
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  }
  return booking;
};

export const cancelBooking = async ({ user, bookingId, reason }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== user._id.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  }
  assertTransition(booking.status, 'CANCELLED', `Cannot cancel a ${booking.status} booking`);
  booking.status = 'CANCELLED';
  booking.cancelReason = reason || 'Cancelled by customer';
  await booking.save();
  await releaseSlot({ labId: booking.lab, scheduledDate: booking.scheduledDate, slotStart: booking.slot.start });
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};

export const getBookingReportUrl = async ({ userId, bookingId }) => {
  const booking = await Booking.findById(bookingId).populate('report');
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  }
  if (!booking.report) throw Errors.NOT_FOUND('Report', `/bookings/${bookingId}/report`);
  const signedUrl = await storage.getSignedUrl(booking.report.file.uri);
  return { signedUrl, issuedAt: booking.report.issuedAt };
};
```

> Note: `notifyBookingStatus` is added in Task 9. To keep this task runnable in isolation, add a temporary stub to `services/notificationService.js` now: `export const notifyBookingStatus = async () => {};` (fully implemented in Task 9). If executing strictly in order, create the stub file first.

- [ ] **Step 4: Rewrite `controllers/bookingController.js` (thin)**

```js
import * as bookingService from '../services/bookingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createBooking = asyncHandler(async (request, reply) => {
  const { labId, testIds, scheduledDate, slot, collectionType, userAddressId } = request.body;
  const booking = await bookingService.createBooking({
    user: request.user, labId, testIds, scheduledDate, slot, collectionType, userAddressId,
  });
  return reply.code(201).send({ booking });
});

export const listBookings = asyncHandler(async (request, reply) => {
  const { status, page, limit } = request.query;
  const result = await bookingService.listBookings({ userId: request.user._id, status, page, limit });
  return reply.code(200).send(result);
});

export const getBookingById = asyncHandler(async (request, reply) => {
  const booking = await bookingService.getBookingForUser({ userId: request.user._id, bookingId: request.params.id });
  return reply.code(200).send({ booking });
});

export const cancelBooking = asyncHandler(async (request, reply) => {
  const booking = await bookingService.cancelBooking({ user: request.user, bookingId: request.params.id, reason: request.body?.reason });
  return reply.code(200).send({ booking });
});

export const getBookingReport = asyncHandler(async (request, reply) => {
  const result = await bookingService.getBookingReportUrl({ userId: request.user._id, bookingId: request.params.id });
  return reply.code(200).send(result);
});
```

- [ ] **Step 5: Run booking tests**

Run: `node --test tests/booking.test.js`
Expected: PASS (201 then 409; cancel frees the slot).

**Checkpoint:** booking domain is layered, race-free, and DRY. Commit when ready.

---

## Task 6: `labCatalogService` + thin `labController`

**Files:**
- Create: `services/labCatalogService.js`
- Modify: `controllers/labController.js`
- Create: `tests/labCatalog.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/labCatalog.test.js`:

```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';

let app, lab;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({})]);
  const owner = await User.create({ name:'O', email:'o2@x.com', roles:['LAB_OWNER'] });
  const allDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const openHours = Object.fromEntries(allDays.map((d) => [d, { open:'09:00', close:'18:00' }]));
  lab = await Lab.create({ owner: owner._id, name:'Lab Z', location:{ type:'Point', coordinates:[77.5,12.9] }, isActive:true,
    openingHours: openHours, slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:2 } });
  await Test.create({ lab: lab._id, name:'Lipid Profile', category:'Blood', price:500, isActive:true });
});

test('GET /api/tests filters by price and paginates', async () => {
  const res = await app.inject({ method:'GET', url:'/api/tests?minPrice=100&maxPrice=600&limit=10' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().tests.length, 1);
});

test('GET /api/labs/:id/slots returns computed slots for an open day', async () => {
  const res = await app.inject({ method:'GET', url:`/api/labs/${lab._id}/slots?date=2026-06-04` });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().slots.length >= 1);
  assert.equal(res.json().slots[0].capacity, 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/labCatalog.test.js`
Expected: FAIL — service not found.

- [ ] **Step 3: Implement `services/labCatalogService.js`**

```js
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import { Errors } from '../common/errors.js';
import { weekdayName } from './_shared/slotTime.js';

export const searchTests = async (q) => {
  const filter = { isActive: true };
  if (q.q) filter.$text = { $search: q.q };
  else if (q.category) filter.category = { $regex: new RegExp(`^${q.category}$`, 'i') };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = parseFloat(q.minPrice);
    if (q.maxPrice !== undefined) filter.price.$lte = parseFloat(q.maxPrice);
  }
  const allowedSort = ['price', 'name', 'turnaroundHours', 'createdAt'];
  const sortField = allowedSort.includes(q.sortBy) ? q.sortBy : 'price';
  const sortOrder = q.order === 'desc' ? -1 : 1;
  const page = parseInt(q.page) || 1;
  const lim = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * lim;
  const [tests, total] = await Promise.all([
    Test.find(filter).populate('lab', 'name address rating certifications isActive').select('-__v')
      .sort({ [sortField]: sortOrder }).skip(skip).limit(lim),
    Test.countDocuments(filter),
  ]);
  return { tests, total, page, limit: lim, pages: Math.ceil(total / lim) };
};

export const listLabs = async (q) => {
  const filter = {};
  if (q.isActive !== undefined) filter.isActive = q.isActive === 'true' || q.isActive === true;
  if (q.isVerified !== undefined) filter.isVerified = q.isVerified === 'true' || q.isVerified === true;
  if (q.city) filter['address.city'] = { $regex: new RegExp(q.city, 'i') };
  if (q.search) filter.name = { $regex: new RegExp(q.search, 'i') };
  const allowedSort = ['name', 'rating', 'createdAt'];
  const sortField = allowedSort.includes(q.sortBy) ? q.sortBy : 'createdAt';
  const sortOrder = q.order === 'asc' ? 1 : -1;
  const page = parseInt(q.page) || 1;
  const lim = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * lim;
  const [labs, total] = await Promise.all([
    Lab.find(filter).populate('owner', 'name email phone').select('-__v')
      .sort({ [sortField]: sortOrder }).skip(skip).limit(lim),
    Lab.countDocuments(filter),
  ]);
  return { labs, total, page, limit: lim, pages: Math.ceil(total / lim) };
};

export const nearbyLabs = async ({ lat, lng, radius = 5000, minRating, page = 1, limit = 20 }) => {
  const query = {
    location: { $near: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: parseInt(radius) } },
    isActive: true,
  };
  if (minRating) query.rating = { $gte: parseFloat(minRating) };
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const labs = await Lab.find(query).skip(skip).limit(parseInt(limit)).select('-__v');
  return { labs, count: labs.length };
};

export const getLab = async (id) => {
  const lab = await Lab.findById(id).populate('owner', 'name email phone').select('-__v');
  if (!lab) throw Errors.NOT_FOUND('Lab', `/labs/${id}`);
  return lab;
};

export const getLabTests = async (id) =>
  Test.find({ lab: id, isActive: true }).select('-__v');

export const computeLabSlots = async ({ labId, date }) => {
  const lab = await Lab.findById(labId);
  if (!lab) throw Errors.NOT_FOUND('Lab');
  const dayHours = lab.openingHours?.[weekdayName(date)];
  if (!dayHours || dayHours.isClosed) throw Errors.LAB_CLOSED(`Lab is closed on ${weekdayName(date)}`);

  const { duration = 30, intervalMinutes = 30, maxBookingsPerSlot = 5 } = lab.slotMatrix || {};
  const [openH, openM] = (dayHours.open || '09:00').split(':').map(Number);
  const [closeH, closeM] = (dayHours.close || '18:00').split(':').map(Number);
  let current = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const existing = await Booking.find({
    lab: lab._id,
    scheduledDate: { $gte: startOfDay, $lt: endOfDay },
    status: { $in: ['PENDING', 'CONFIRMED', 'COLLECTED'] },
  });

  const slots = [];
  while (current + duration <= closeTotal) {
    const pad = (n) => String(n).padStart(2, '0');
    const slotStart = `${pad(Math.floor(current / 60))}:${pad(current % 60)}`;
    const endMin = current + duration;
    const slotEnd = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
    const booked = existing.filter((b) => b.slot?.start === slotStart).length;
    slots.push({ start: slotStart, end: slotEnd, available: booked < maxBookingsPerSlot, booked, capacity: maxBookingsPerSlot });
    current += intervalMinutes;
  }
  return { date, slots };
};
```

- [ ] **Step 4: Rewrite `controllers/labController.js` (thin)**

```js
import * as labCatalogService from '../services/labCatalogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getTests = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.searchTests(request.query)));

export const getAllLabs = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.listLabs(request.query)));

export const getNearbyLabs = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.nearbyLabs(request.query)));

export const getLabById = asyncHandler(async (request, reply) =>
  reply.code(200).send({ lab: await labCatalogService.getLab(request.params.id) }));

export const getLabTests = asyncHandler(async (request, reply) =>
  reply.code(200).send({ tests: await labCatalogService.getLabTests(request.params.id) }));

export const getLabSlots = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.computeLabSlots({ labId: request.params.id, date: request.query.date })));
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/labCatalog.test.js`
Expected: PASS.

**Checkpoint:** catalog/search/slots layered. Commit when ready.

---

## Task 7: `partnerService` + `reportService` + thin controllers

**Files:**
- Create: `services/partnerService.js`
- Create: `services/reportService.js`
- Modify: `controllers/partnerController.js`
- Modify: `controllers/reportController.js`
- Create: `tests/partner.test.js`

> Preserves current behavior exactly, including that `linkReport` sets status to `COMPLETED` directly (the API has no separate `COLLECTED` step). Accept (`PENDING→CONFIRMED`) and reject (`→CANCELLED`) now go through `assertTransition`; reject releases the slot.

- [ ] **Step 1: Write the failing partner test**

Create `tests/partner.test.js`:

```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';

let app, ownerToken, lab, booking;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}), Booking.deleteMany({})]);
  const owner = await User.create({ name:'Own', email:'own@x.com', roles:['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123',12) });
  lab = await Lab.create({ owner: owner._id, name:'L', location:{ type:'Point', coordinates:[77,12] }, isActive:true });
  const t = await Test.create({ lab: lab._id, name:'X', price:100, isActive:true });
  const cust = await User.create({ name:'C', email:'c3@x.com', roles:['CUSTOMER'] });
  booking = await Booking.create({ user: cust._id, lab: lab._id, tests:[t._id], scheduledDate:new Date('2026-06-04'), slot:{start:'10:00',end:'10:30'}, collectionType:'IN_LAB', totalAmount:100, status:'PENDING' });
  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'own@x.com', password:'pass123' } });
  ownerToken = login.json().accessToken;
});

test('partner accepts a PENDING booking -> CONFIRMED', async () => {
  const res = await app.inject({ method:'POST', url:`/api/partner/bookings/${booking._id}/accept`, headers:{ authorization:`Bearer ${ownerToken}` } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().booking.status, 'CONFIRMED');
});

test('partner cannot accept an already CONFIRMED booking (409)', async () => {
  await app.inject({ method:'POST', url:`/api/partner/bookings/${booking._id}/accept`, headers:{ authorization:`Bearer ${ownerToken}` } });
  const res = await app.inject({ method:'POST', url:`/api/partner/bookings/${booking._id}/accept`, headers:{ authorization:`Bearer ${ownerToken}` } });
  assert.equal(res.statusCode, 409);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/partner.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `services/reportService.js`**

```js
import Report from '../models/report.js';
import Booking from '../models/booking.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';

export const linkReport = async ({ booking, uri, checksum, testId }) => {
  const report = await Report.create({
    booking: booking._id,
    test: testId || booking.tests[0],
    file: { uri, storageProvider: 'FIREBASE', checksum },
    issuedAt: new Date(),
    isAccessible: true,
  });
  booking.report = report._id;
  booking.status = 'COMPLETED';
  await booking.save();
  return report;
};

export const getReportForUser = async ({ userId, reportId }) => {
  const report = await Report.findById(reportId).populate('booking');
  if (!report || !report.isAccessible) throw Errors.REPORT_ACCESS_DENIED();
  if (report.booking.user.toString() !== userId.toString()) throw Errors.REPORT_ACCESS_DENIED();
  const signedUrl = await storage.getSignedUrl(report.file.uri);
  return { signedUrl, issuedAt: report.issuedAt };
};
```

- [ ] **Step 4: Implement `services/partnerService.js`**

```js
import Booking from '../models/booking.js';
import Lab from '../models/lab.js';
import LabAssistant from '../models/labAssistant.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { assertTransition } from './_shared/transitions.js';
import { releaseSlot } from './slotCapacityService.js';
import { linkReport as linkReportDoc } from './reportService.js';
import { notifyBookingStatus } from './notificationService.js';
import crypto from 'crypto';

const MAX_REPORT_SIZE = 10 * 1024 * 1024;

export const getOwnedLab = async (userId) => {
  const lab = await Lab.findOne({ owner: userId, isActive: true });
  if (!lab) throw Errors.NOT_FOUND('Lab');
  return lab;
};

export const getDailyBookings = async (userId) => {
  const lab = await getOwnedLab(userId);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const bookings = await Booking.find({ lab: lab._id, scheduledDate: { $gte: today, $lt: tomorrow } })
    .populate('user', 'name phone email').populate('tests', 'name price').populate('labAssistant', 'name phone')
    .sort({ 'slot.start': 1 });
  return { bookings, date: today.toISOString().split('T')[0] };
};

export const getPartnerBookings = async ({ userId, status, page = 1, limit = 20 }) => {
  const lab = await getOwnedLab(userId);
  const query = { lab: lab._id };
  if (status) query.status = status;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(query).populate('user', 'name phone email').populate('tests', 'name price')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Booking.countDocuments(query),
  ]);
  return { bookings, total, page: parseInt(page), limit: parseInt(limit) };
};

const findOwnedBooking = async (userId, bookingId, instance) => {
  const lab = await getOwnedLab(userId);
  const booking = await Booking.findOne({ _id: bookingId, lab: lab._id });
  if (!booking) throw Errors.BOOKING_NOT_FOUND(instance);
  return { lab, booking };
};

export const acceptBooking = async ({ userId, bookingId }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  assertTransition(booking.status, 'CONFIRMED', `Cannot confirm a ${booking.status} booking`);
  booking.status = 'CONFIRMED';
  await booking.save();
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};

export const rejectBooking = async ({ userId, bookingId, reason }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  assertTransition(booking.status, 'CANCELLED', `Cannot reject a ${booking.status} booking`);
  booking.status = 'CANCELLED';
  booking.cancelReason = reason || 'Rejected by lab';
  await booking.save();
  await releaseSlot({ labId: booking.lab, scheduledDate: booking.scheduledDate, slotStart: booking.slot.start });
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};

export const reassignAssistant = async ({ userId, bookingId, assistantId }) => {
  const { lab, booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  const assistant = await LabAssistant.findOne({ _id: assistantId, lab: lab._id, isActive: true });
  if (!assistant) throw Errors.ASSISTANT_UNAVAILABLE();
  booking.labAssistant = assistantId;
  await booking.save();
  return booking;
};

export const uploadReportFile = async ({ userId, fileData }) => {
  await getOwnedLab(userId);
  if (!fileData) throw Errors.VALIDATION_ERROR('No file uploaded');
  if (fileData.mimetype !== 'application/pdf') throw Errors.INVALID_FILE_TYPE();
  const chunks = [];
  let total = 0;
  for await (const chunk of fileData.file) {
    total += chunk.length;
    if (total > MAX_REPORT_SIZE) throw Errors.FILE_TOO_LARGE();
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const bookingId = fileData.fields?.bookingId?.value || 'tmp';
  const filePath = `reports/${bookingId}/${Date.now()}.pdf`;
  await storage.uploadBuffer(buffer, filePath, 'application/pdf');
  return { uri: filePath, checksum };
};

export const linkReport = async ({ userId, bookingId, uri, checksum, testId }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}/report`);
  const report = await linkReportDoc({ booking, uri, checksum, testId });
  notifyBookingStatus(booking).catch(() => {});
  return report;
};

export const listAssistants = async (userId) => {
  const lab = await getOwnedLab(userId);
  return LabAssistant.find({ lab: lab._id, isActive: true });
};

export const createAssistant = async ({ userId, name, phone, assistantUserId }) => {
  const lab = await getOwnedLab(userId);
  return LabAssistant.create({ lab: lab._id, user: assistantUserId || userId, name, phone });
};

export const updateAssistant = async ({ userId, assistantId, update }) => {
  const lab = await getOwnedLab(userId);
  const assistant = await LabAssistant.findOneAndUpdate({ _id: assistantId, lab: lab._id }, update, { new: true });
  if (!assistant) throw Errors.NOT_FOUND('Assistant');
  return assistant;
};

export const setAssistantAvailability = async ({ userId, assistantId, availability }) => {
  const lab = await getOwnedLab(userId);
  const assistant = await LabAssistant.findOneAndUpdate({ _id: assistantId, lab: lab._id }, { availability }, { new: true });
  if (!assistant) throw Errors.NOT_FOUND('Assistant');
  return assistant;
};

export const getAnalyticsOverview = async (userId) => {
  const lab = await getOwnedLab(userId);
  const [totalBookings, completedBookings, cancelledBookings, revenueResult] = await Promise.all([
    Booking.countDocuments({ lab: lab._id }),
    Booking.countDocuments({ lab: lab._id, status: 'COMPLETED' }),
    Booking.countDocuments({ lab: lab._id, status: 'CANCELLED' }),
    Booking.aggregate([{ $match: { lab: lab._id, status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
  ]);
  const topTests = await Booking.aggregate([
    { $match: { lab: lab._id, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    { $unwind: '$tests' },
    { $group: { _id: '$tests', count: { $sum: 1 } } },
    { $sort: { count: -1 } }, { $limit: 5 },
    { $lookup: { from: 'tests', localField: '_id', foreignField: '_id', as: 'test' } },
    { $unwind: '$test' },
    { $project: { name: '$test.name', count: 1 } },
  ]);
  return { totalBookings, completedBookings, cancelledBookings, totalRevenue: revenueResult[0]?.total || 0, topTests };
};

export const getRevenueAnalytics = async ({ userId, from, to }) => {
  const lab = await getOwnedLab(userId);
  const match = { lab: lab._id, status: 'COMPLETED' };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }
  const revenue = await Booking.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return { revenue };
};

export const getSlotsAnalytics = async (userId) => {
  const lab = await getOwnedLab(userId);
  const peakSlots = await Booking.aggregate([
    { $match: { lab: lab._id, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    { $group: { _id: '$slot.start', count: { $sum: 1 } } },
    { $sort: { count: -1 } }, { $limit: 10 },
  ]);
  return { peakSlots };
};

export const getCustomerHistory = async ({ userId, customerId }) => {
  const lab = await getOwnedLab(userId);
  const bookings = await Booking.find({ lab: lab._id, user: customerId })
    .populate('tests', 'name price').populate('report').sort({ createdAt: -1 });
  return { bookings };
};
```

- [ ] **Step 5: Rewrite `controllers/partnerController.js` and `controllers/reportController.js` (thin)**

`controllers/partnerController.js`:
```js
import * as partnerService from '../services/partnerService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDailyBookings = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getDailyBookings(req.user._id)));
export const getPartnerBookings = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getPartnerBookings({ userId: req.user._id, ...req.query })));
export const acceptBooking = asyncHandler(async (req, reply) =>
  reply.code(200).send({ booking: await partnerService.acceptBooking({ userId: req.user._id, bookingId: req.params.id }) }));
export const rejectBooking = asyncHandler(async (req, reply) =>
  reply.code(200).send({ booking: await partnerService.rejectBooking({ userId: req.user._id, bookingId: req.params.id, reason: req.body?.reason }) }));
export const reassignAssistant = asyncHandler(async (req, reply) =>
  reply.code(200).send({ booking: await partnerService.reassignAssistant({ userId: req.user._id, bookingId: req.params.id, assistantId: req.body.assistantId }) }));
export const uploadReport = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.uploadReportFile({ userId: req.user._id, fileData: await req.file() })));
export const linkReport = asyncHandler(async (req, reply) =>
  reply.code(201).send({ report: await partnerService.linkReport({ userId: req.user._id, bookingId: req.params.id, ...req.body }) }));
export const listAssistants = asyncHandler(async (req, reply) =>
  reply.code(200).send({ assistants: await partnerService.listAssistants(req.user._id) }));
export const createAssistant = asyncHandler(async (req, reply) =>
  reply.code(201).send({ assistant: await partnerService.createAssistant({ userId: req.user._id, name: req.body.name, phone: req.body.phone, assistantUserId: req.body.userId }) }));
export const updateAssistant = asyncHandler(async (req, reply) =>
  reply.code(200).send({ assistant: await partnerService.updateAssistant({ userId: req.user._id, assistantId: req.params.id, update: req.body }) }));
export const setAssistantAvailability = asyncHandler(async (req, reply) =>
  reply.code(200).send({ assistant: await partnerService.setAssistantAvailability({ userId: req.user._id, assistantId: req.params.id, availability: req.body }) }));
export const getAnalyticsOverview = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getAnalyticsOverview(req.user._id)));
export const getRevenueAnalytics = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getRevenueAnalytics({ userId: req.user._id, ...req.query })));
export const getSlotsAnalytics = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getSlotsAnalytics(req.user._id)));
export const getCustomerHistory = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getCustomerHistory({ userId: req.user._id, customerId: req.params.customerId })));
```

`controllers/reportController.js`:
```js
import * as reportService from '../services/reportService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getReport = asyncHandler(async (request, reply) =>
  reply.code(200).send(await reportService.getReportForUser({ userId: request.user._id, reportId: request.params.id })));
```

- [ ] **Step 6: Run partner + full suite**

Run: `node --test tests/partner.test.js`
Expected: PASS (accept → CONFIRMED; re-accept → 409).
Run: `npm test`
Expected: all green so far.

**Checkpoint:** lab-side fully layered; report logic shared. Commit when ready.

---

## Task 8: `authService`, `profileService`, `subscriptionService` + thin controllers + throw-in-middleware

**Files:**
- Create: `services/authService.js`, `services/profileService.js`, `services/subscriptionService.js`
- Modify: `controllers/authController.js`, `controllers/profileController.js`, `controllers/subscriptionController.js`
- Modify: `middlewares/authMiddleware.js`, `middlewares/rbacMiddleware.js`
- Create: `tests/auth.test.js`

> Two correctness fixes folded in here (both currently broken): (1) remove the duplicate `getNearbyLabs` from `profileController` — it duplicates `labController`; the profile route should point at the catalog one (handled in route cleanup if a profile route references it; otherwise drop the export). (2) `updateLocation` reads `geo.longitude`/`geo.formattedAddress`, which `geocodeAddress`/`reverseGeocode` never return (they return `{coordinates, address, ...}`). Fix to use the real shape.

- [ ] **Step 1: Write the failing auth test**

Create `tests/auth.test.js`:

```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';

let app;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });
beforeEach(async () => { await User.deleteMany({}); });

test('register then login issues tokens; refresh rotates', async () => {
  const reg = await app.inject({ method:'POST', url:'/api/auth/register', payload:{ name:'A', email:'a@x.com', password:'pass123' } });
  assert.equal(reg.statusCode, 201);
  const { refreshToken } = reg.json();
  const r = await app.inject({ method:'POST', url:'/api/auth/refresh', payload:{ refreshToken } });
  assert.equal(r.statusCode, 200);
  assert.ok(r.json().accessToken);
  // old refresh token is now invalid (rotated)
  const reuse = await app.inject({ method:'POST', url:'/api/auth/refresh', payload:{ refreshToken } });
  assert.equal(reuse.statusCode, 401);
});

test('protected route rejects without token (401) and wrong role (403)', async () => {
  const noAuth = await app.inject({ method:'GET', url:'/api/bookings' });
  assert.equal(noAuth.statusCode, 401);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/auth.test.js`
Expected: FAIL initially only if services/refactor incomplete; the reuse-rejection assertion will pass only once refresh rotation invalidates the prior token (current code already rotates — this characterizes it).

- [ ] **Step 3: Implement `services/authService.js`**

```js
import User from '../models/user.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { JWT_REFRESH_SECRET, EMAIL_USER, EMAIL_PASS, FRONTEND_URL } from '../config/env.js';
import { Errors } from '../common/errors.js';

const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS } });

const issueTokens = async (user) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save();
  return { accessToken, refreshToken };
};

export const register = async ({ name, email, password, phone, role }) => {
  if (await User.findOne({ email })) throw Errors.CONFLICT('Email already in use');
  const passwordHash = await bcrypt.hash(password, 12);
  const roles = role === 'LAB_OWNER' ? ['LAB_OWNER'] : ['CUSTOMER'];
  const user = await User.create({ name, email, passwordHash, phone, roles });
  const tokens = await issueTokens(user);
  return { ...tokens, user: { id: user._id, name: user.name, email: user.email, roles: user.roles } };
};

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw Errors.UNAUTHORIZED();
  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user);
  return { ...tokens, user: { id: user._id, name: user.name, email: user.email, roles: user.roles } };
};

export const refresh = async ({ refreshToken }) => {
  if (!refreshToken) throw Errors.UNAUTHORIZED();
  let decoded;
  try { decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET); } catch { throw Errors.UNAUTHORIZED(); }
  const user = await User.findById(decoded.id);
  if (!user || !user.refreshToken || !(await bcrypt.compare(refreshToken, user.refreshToken))) throw Errors.UNAUTHORIZED();
  const { accessToken, refreshToken: newRefresh } = await issueTokens(user);
  return { accessToken, refreshToken: newRefresh };
};

export const logout = async (user) => {
  user.refreshToken = null;
  await user.save();
  return { message: 'Logged out successfully' };
};

export const forgotPassword = async ({ email }, log) => {
  const user = await User.findOne({ email });
  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();
    const resetURL = `${FRONTEND_URL}/reset-password/${resetToken}`;
    try {
      await transporter.sendMail({ from: EMAIL_USER, to: user.email, subject: 'Password Reset — Labzy',
        html: `<p>Click <a href="${resetURL}">here</a> to reset your password. This link expires in 1 hour.</p>` });
    } catch (e) { log?.error({ err: e }, 'Failed to send reset email'); }
  }
  return { message: 'If that email exists, a reset link was sent' };
};

export const resetPassword = async ({ token, newPassword }) => {
  const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
  if (!user) throw Errors.VALIDATION_ERROR('Invalid or expired reset token');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();
  return { message: 'Password reset successfully' };
};
```

- [ ] **Step 4: Implement `services/profileService.js`**

```js
import User from '../models/user.js';
import { geocodeAddress, reverseGeocode } from './locationService.js';
import { Errors } from '../common/errors.js';

const SAFE_SELECT = '-passwordHash -refreshToken -resetToken -resetTokenExpiry';

export const getProfile = async (userId) => {
  const user = await User.findById(userId).select(SAFE_SELECT);
  if (!user) throw Errors.NOT_FOUND('User');
  return user;
};

export const updateProfile = async ({ userId, body }) => {
  const update = {};
  for (const k of ['name', 'phone', 'fcmToken', 'gender']) if (body[k] !== undefined) update[k] = body[k];
  if (body.birthDate !== undefined) update.birthDate = new Date(body.birthDate);
  return User.findByIdAndUpdate(userId, update, { new: true }).select('-passwordHash -refreshToken');
};

export const addAddress = async ({ userId, body }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  const { label, line1, line2, city, state, zipCode, country } = body;
  user.addresses.push({ label, line1, line2, city, state, zipCode, country: country || 'India' });
  await user.save();
  return user.addresses;
};

export const updateAddress = async ({ userId, addressId, body }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  const addr = user.addresses.id(addressId);
  if (!addr) throw Errors.NOT_FOUND('Address');
  for (const k of ['label', 'line1', 'line2', 'city', 'state', 'zipCode', 'country']) if (body[k] !== undefined) addr[k] = body[k];
  await user.save();
  return user.addresses;
};

export const deleteAddress = async ({ userId, addressId }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  user.addresses = user.addresses.filter((a) => a._id.toString() !== addressId);
  await user.save();
  return user.addresses;
};

export const updateLocation = async ({ userId, address, latitude, longitude }) => {
  let coords = [longitude || 0, latitude || 0];
  let resolvedAddress = address;
  if (address && !latitude) {
    try { const geo = await geocodeAddress(address); coords = geo.coordinates; resolvedAddress = geo.address || address; } catch { /* keep */ }
  } else if (latitude && longitude && !address) {
    try { const geo = await reverseGeocode(latitude, longitude); resolvedAddress = geo.address || `${latitude},${longitude}`; }
    catch { resolvedAddress = `${latitude},${longitude}`; }
  }
  const user = await User.findByIdAndUpdate(userId, { location: { type: 'Point', coordinates: coords } }, { new: true })
    .select('-passwordHash -refreshToken');
  return { user, resolvedAddress };
};
```

- [ ] **Step 5: Implement `services/subscriptionService.js`**

```js
import Subscription from '../models/subscription.js';
import Lab from '../models/lab.js';
import { Errors } from '../common/errors.js';

export const nextBookingDate = (from, frequency, customIntervalDays) => {
  const d = new Date(from);
  if (frequency === 'WEEKLY') d.setDate(d.getDate() + 7);
  else if (frequency === 'CUSTOM') d.setDate(d.getDate() + (customIntervalDays || 30));
  else d.setMonth(d.getMonth() + 1); // MONTHLY default
  return d;
};

const ownedSub = async (userId, id) => {
  const sub = await Subscription.findById(id);
  if (!sub || sub.user.toString() !== userId.toString()) throw Errors.NOT_FOUND('Subscription');
  return sub;
};

export const createSubscription = async ({ userId, labId, testId, frequency, customIntervalDays, autoPayment, startDate }) =>
  Subscription.create({
    user: userId, lab: labId, test: testId, frequency,
    customIntervalDays: frequency === 'CUSTOM' ? customIntervalDays : undefined,
    nextBookingDate: startDate ? new Date(startDate) : new Date(),
    autoPayment: autoPayment || false, status: 'ACTIVE',
  });

export const listSubscriptions = async (userId) =>
  Subscription.find({ user: userId }).populate('lab', 'name').populate('test', 'name price').sort({ createdAt: -1 });

export const getSubscription = async ({ userId, id }) => {
  const sub = await Subscription.findById(id).populate('lab', 'name').populate('test', 'name price');
  if (!sub || sub.user.toString() !== userId.toString()) throw Errors.NOT_FOUND('Subscription');
  return sub;
};

export const updateSubscription = async ({ userId, id, body }) => {
  const sub = await ownedSub(userId, id);
  if (body.frequency !== undefined) sub.frequency = body.frequency;
  if (body.customIntervalDays !== undefined) sub.customIntervalDays = body.customIntervalDays;
  if (body.autoPayment !== undefined) sub.autoPayment = body.autoPayment;
  await sub.save();
  return sub;
};

export const pauseSubscription = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  if (sub.status !== 'ACTIVE') throw Errors.INVALID_SUBSCRIPTION_STATE('Only ACTIVE subscriptions can be paused');
  sub.status = 'PAUSED'; await sub.save(); return sub;
};

export const resumeSubscription = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  if (sub.status !== 'PAUSED') throw Errors.INVALID_SUBSCRIPTION_STATE('Only PAUSED subscriptions can be resumed');
  sub.status = 'ACTIVE';
  sub.nextBookingDate = nextBookingDate(new Date(), sub.frequency, sub.customIntervalDays);
  await sub.save(); return sub;
};

export const cancelSubscription = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  if (sub.status === 'CANCELLED') throw Errors.INVALID_SUBSCRIPTION_STATE('Subscription is already cancelled');
  sub.status = 'CANCELLED'; await sub.save(); return sub;
};

// Used by the scheduler (Task 10). Returns count processed.
export const runDueSubscriptions = async ({ now, log, createBookingForSub }) => {
  const due = await Subscription.find({ status: 'ACTIVE', nextBookingDate: { $lte: now }, $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } }] }).limit(50);
  let processed = 0;
  for (const sub of due) {
    const claimed = await Subscription.findOneAndUpdate(
      { _id: sub._id, status: 'ACTIVE', $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } }] },
      { $set: { lockedAt: now } }, { new: true },
    );
    if (!claimed) continue;
    try {
      await createBookingForSub(claimed);
      claimed.nextBookingDate = nextBookingDate(claimed.nextBookingDate, claimed.frequency, claimed.customIntervalDays);
      claimed.lastRunAt = now;
      claimed.retryCount = 0;
      claimed.lockedAt = null;
      await claimed.save();
      processed += 1;
    } catch (err) {
      log?.error({ err, subId: claimed._id }, 'Subscription booking failed');
      claimed.retryCount = (claimed.retryCount || 0) + 1;
      if (claimed.retryCount >= 3) claimed.status = 'PAUSED';
      claimed.lockedAt = null;
      await claimed.save();
    }
  }
  return processed;
};
```

> Add a `lockedAt: { type: Date, default: null }` field to `models/subscription.js` (and an index `{ status:1, nextBookingDate:1, lockedAt:1 }`) — needed for the atomic claim.

- [ ] **Step 6: Rewrite the three controllers (thin) + middlewares (throw)**

`controllers/authController.js`:
```js
import * as authService from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, reply) => reply.code(201).send(await authService.register(req.body)));
export const login = asyncHandler(async (req, reply) => reply.code(200).send(await authService.login(req.body)));
export const refresh = asyncHandler(async (req, reply) => reply.code(200).send(await authService.refresh(req.body)));
export const logout = asyncHandler(async (req, reply) => reply.code(200).send(await authService.logout(req.user)));
export const forgotPassword = asyncHandler(async (req, reply) => reply.code(200).send(await authService.forgotPassword(req.body, req.log)));
export const resetPassword = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.resetPassword({ token: req.params.token, newPassword: req.body.newPassword })));
```

`controllers/profileController.js`:
```js
import * as profileService from '../services/profileService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (req, reply) => reply.code(200).send({ user: await profileService.getProfile(req.user._id) }));
export const updateProfile = asyncHandler(async (req, reply) => reply.code(200).send({ user: await profileService.updateProfile({ userId: req.user._id, body: req.body }) }));
export const addAddress = asyncHandler(async (req, reply) => reply.code(201).send({ addresses: await profileService.addAddress({ userId: req.user._id, body: req.body }) }));
export const updateAddress = asyncHandler(async (req, reply) => reply.code(200).send({ addresses: await profileService.updateAddress({ userId: req.user._id, addressId: req.params.id, body: req.body }) }));
export const deleteAddress = asyncHandler(async (req, reply) => reply.code(200).send({ addresses: await profileService.deleteAddress({ userId: req.user._id, addressId: req.params.id }) }));
export const updateLocation = asyncHandler(async (req, reply) => reply.code(200).send(await profileService.updateLocation({ userId: req.user._id, ...req.body })));
```
> Remove the duplicate `getNearbyLabs` export from `profileController`. If `routes/profileRoutes.js` references it, repoint that route to `labController.getNearbyLabs` (or delete the duplicate route — `/api/labs/nearby` already exists). Verify the route file and adjust imports accordingly.

`controllers/subscriptionController.js`:
```js
import * as subscriptionService from '../services/subscriptionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createSubscription = asyncHandler(async (req, reply) =>
  reply.code(201).send({ subscription: await subscriptionService.createSubscription({ userId: req.user._id, ...req.body }) }));
export const listSubscriptions = asyncHandler(async (req, reply) =>
  reply.code(200).send({ subscriptions: await subscriptionService.listSubscriptions(req.user._id) }));
export const getSubscriptionById = asyncHandler(async (req, reply) =>
  reply.code(200).send({ subscription: await subscriptionService.getSubscription({ userId: req.user._id, id: req.params.id }) }));
export const updateSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({ subscription: await subscriptionService.updateSubscription({ userId: req.user._id, id: req.params.id, body: req.body }) }));
export const pauseSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({ subscription: await subscriptionService.pauseSubscription({ userId: req.user._id, id: req.params.id }) }));
export const resumeSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({ subscription: await subscriptionService.resumeSubscription({ userId: req.user._id, id: req.params.id }) }));
export const cancelSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({ subscription: await subscriptionService.cancelSubscription({ userId: req.user._id, id: req.params.id }) }));
```

`middlewares/authMiddleware.js`:
```js
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { JWT_SECRET } from '../config/env.js';
import { Errors } from '../common/errors.js';

export const verifyJWT = async (request) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw Errors.UNAUTHORIZED();
  const token = authHeader.split('Bearer ')[1];
  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); } catch { throw Errors.UNAUTHORIZED(); }
  const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');
  if (!user) throw Errors.UNAUTHORIZED();
  request.user = user;
};
```

`middlewares/rbacMiddleware.js`:
```js
import { Errors } from '../common/errors.js';

export const requireRoles = (...allowed) => async (request) => {
  const userRoles = request.user?.roles || [];
  if (!allowed.some((r) => userRoles.includes(r))) throw Errors.FORBIDDEN();
};
```

- [ ] **Step 7: Run auth + full suite**

Run: `node --test tests/auth.test.js`
Expected: PASS.
Run: `npm test`
Expected: all green.

**Checkpoint:** every controller is thin; no controller/middleware calls `.toRFC7807()`. Commit when ready.

---

## Task 9: Notification foundation

**Files:**
- Create/replace: `services/notificationService.js` (replaces the Task 5/7 stub)
- Create: `config/firebase.js` check (verify it exposes `initFirebase`)
- Create: `tests/notification.test.js`

- [ ] **Step 1: Write the failing test (degrades gracefully)**

Create `tests/notification.test.js`:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod, notifyBookingStatus, registerSocket;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  process.env.FCM_ENABLED = 'false';
  ({ notifyBookingStatus, registerSocket } = await import('../services/notificationService.js'));
});
after(async () => { await mongoose.disconnect(); await mongod.stop(); });

test('notifyBookingStatus does not throw when FCM disabled and no socket', async () => {
  const fake = { user: new mongoose.Types.ObjectId(), status: 'CONFIRMED', _id: new mongoose.Types.ObjectId() };
  await assert.doesNotReject(() => notifyBookingStatus(fake));
});

test('registered websocket receives the event', async () => {
  const userId = new mongoose.Types.ObjectId();
  const received = [];
  const fakeSocket = { readyState: 1, send: (m) => received.push(JSON.parse(m)) };
  registerSocket(userId.toString(), fakeSocket);
  await notifyBookingStatus({ user: userId, status: 'COLLECTED', _id: new mongoose.Types.ObjectId() });
  assert.equal(received.length, 1);
  assert.equal(received[0].status, 'COLLECTED');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/notification.test.js`
Expected: FAIL — `registerSocket`/full service not implemented.

- [ ] **Step 3: Implement `services/notificationService.js`**

```js
import User from '../models/user.js';
import { FCM_ENABLED } from '../config/env.js';
import { initFirebase } from '../config/firebase.js';

// userId -> Set<socket>
const sockets = new Map();

export const registerSocket = (userId, socket) => {
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId).add(socket);
};

export const unregisterSocket = (userId, socket) => {
  sockets.get(userId)?.delete(socket);
  if (sockets.get(userId)?.size === 0) sockets.delete(userId);
};

const broadcast = (userId, payload) => {
  const set = sockets.get(userId.toString());
  if (!set) return;
  for (const s of set) {
    try { if (s.readyState === 1) s.send(JSON.stringify(payload)); } catch { /* ignore broken socket */ }
  }
};

const sendPush = async (userId, title, body, data) => {
  if (!FCM_ENABLED) return;
  try {
    const fb = initFirebase();
    if (!fb) return;
    const user = await User.findById(userId).select('fcmToken');
    if (!user?.fcmToken) return;
    await fb.messaging().send({ token: user.fcmToken, notification: { title, body }, data: data || {} });
  } catch { /* never block the request on push failure */ }
};

export const notify = async ({ userId, event, title, body, data }) => {
  const payload = { event, title, body, data, at: new Date().toISOString() };
  broadcast(userId, payload);
  await sendPush(userId, title, body, data);
};

const STATUS_COPY = {
  CONFIRMED: ['Booking confirmed', 'Your lab booking is confirmed.'],
  COLLECTED: ['Sample collected', 'Your sample has been collected.'],
  COMPLETED: ['Report ready', 'Your report is ready to view.'],
  CANCELLED: ['Booking cancelled', 'Your booking was cancelled.'],
};

export const notifyBookingStatus = async (booking) => {
  const copy = STATUS_COPY[booking.status];
  if (!copy) return;
  await notify({
    userId: booking.user,
    event: 'BOOKING_STATUS',
    title: copy[0],
    body: copy[1],
    data: { bookingId: booking._id.toString(), status: booking.status },
  });
};
```

> Verify `config/firebase.js` exports `initFirebase()` returning the admin SDK or `null` if unconfigured (the storage adapter already imports it this way). If the signature differs, adapt the import.

- [ ] **Step 4: Run notification test**

Run: `node --test tests/notification.test.js`
Expected: PASS (no-throw when disabled; socket receives event).

- [ ] **Step 5: Wire the websocket route to the registry (optional connectivity)**

In `routes/index.js` (or a small `routes/wsRoutes.js`), register an authenticated websocket route that calls `registerSocket(userId, socket)` on open and `unregisterSocket` on close. (Connection auth via a `token` query param verified with `jwt.verify`.) The notification calls were already added in Tasks 5 and 7 (`notifyBookingStatus(...).catch(()=>{})`), so completing the service makes them live.

Run: `npm test`
Expected: all green.

**Checkpoint:** status transitions notify customers; failures never break requests. Commit when ready.

---

## Task 10: Scheduler refactor (atomic claim + hold-expiry sweep)

**Files:**
- Create: `scheduler/index.js` (replaces the Task 1 stub), `scheduler/jobs/subscriptionsJob.js`, `scheduler/jobs/slotHoldSweepJob.js`
- Delete: `jobs/subscriptions.js`
- Create: `tests/scheduler.test.js`

- [ ] **Step 1: Write the failing sweep test**

Create `tests/scheduler.test.js`:

```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod, runSlotHoldSweep, Booking, SlotCapacity, reserveSlot;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Booking = (await import('../models/booking.js')).default;
  SlotCapacity = (await import('../models/slotCapacity.js')).default;
  ({ reserveSlot } = await import('../services/slotCapacityService.js'));
  ({ runSlotHoldSweep } = await import('../scheduler/jobs/slotHoldSweepJob.js'));
});
after(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(async () => { await Promise.all([Booking.deleteMany({}), SlotCapacity.deleteMany({})]); });

test('expired PENDING hold is cancelled and slot released', async () => {
  const labId = new mongoose.Types.ObjectId();
  await reserveSlot({ labId, scheduledDate: '2026-06-10', slotStart: '10:00', maxPerSlot: 1 });
  const b = await Booking.create({
    user: new mongoose.Types.ObjectId(), lab: labId, tests: [new mongoose.Types.ObjectId()],
    scheduledDate: new Date('2026-06-10'), slot: { start: '10:00', end: '10:30' },
    collectionType: 'IN_LAB', totalAmount: 0, status: 'PENDING',
    slotHoldExpiry: new Date(Date.now() - 1000),
  });
  await runSlotHoldSweep({ now: new Date() });
  const after = await Booking.findById(b._id);
  assert.equal(after.status, 'CANCELLED');
  const counter = await SlotCapacity.findOne({ lab: labId, day: '2026-06-10', slotStart: '10:00' });
  assert.equal(counter.count, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/scheduler.test.js`
Expected: FAIL — sweep job not found.

- [ ] **Step 3: Implement `scheduler/jobs/slotHoldSweepJob.js`**

```js
import Booking from '../../models/booking.js';
import { releaseSlot } from '../../services/slotCapacityService.js';

export const runSlotHoldSweep = async ({ now = new Date(), log } = {}) => {
  const expired = await Booking.find({ status: 'PENDING', slotHoldExpiry: { $lt: now } }).limit(200);
  for (const b of expired) {
    b.status = 'CANCELLED';
    b.cancelReason = 'Hold expired';
    await b.save();
    await releaseSlot({ labId: b.lab, scheduledDate: b.scheduledDate, slotStart: b.slot.start });
    log?.info({ bookingId: b._id }, 'Expired hold released');
  }
  return expired.length;
};
```

- [ ] **Step 4: Implement `scheduler/jobs/subscriptionsJob.js`**

```js
import Booking from '../../models/booking.js';
import Lab from '../../models/lab.js';
import { runDueSubscriptions } from '../../services/subscriptionService.js';
import { reserveSlot } from '../../services/slotCapacityService.js';
import { weekdayName, addMinutes } from '../../services/_shared/slotTime.js';

const pickFirstSlot = (lab, date) => {
  const hours = lab?.openingHours?.[weekdayName(date)];
  if (!hours || hours.isClosed || !hours.open) return { start: '09:00', end: '09:30' };
  const dur = lab.slotMatrix?.duration || 30;
  return { start: hours.open, end: addMinutes(hours.open, dur) };
};

export const runSubscriptionsJob = async ({ now = new Date(), log } = {}) =>
  runDueSubscriptions({
    now, log,
    createBookingForSub: async (sub) => {
      const dateStr = sub.nextBookingDate.toISOString().slice(0, 10).replace(/-/g, '');
      const idempotencyKey = `sub_${sub._id}_${dateStr}`;
      if (await Booking.exists({ idempotencyKey })) return;
      const lab = await Lab.findById(sub.lab);
      const slot = pickFirstSlot(lab, sub.nextBookingDate);
      const maxPerSlot = lab?.slotMatrix?.maxBookingsPerSlot || 5;
      await reserveSlot({ labId: sub.lab, scheduledDate: sub.nextBookingDate, slotStart: slot.start, maxPerSlot });
      await Booking.create({
        user: sub.user, lab: sub.lab, tests: [sub.test], subscription: sub._id,
        scheduledDate: sub.nextBookingDate, slot, status: 'PENDING',
        collectionType: 'IN_LAB', totalAmount: 0,
        slotHoldExpiry: new Date(Date.now() + 15 * 60 * 1000), idempotencyKey,
      });
    },
  });
```

- [ ] **Step 5: Implement `scheduler/index.js`**

```js
import { runSubscriptionsJob } from './jobs/subscriptionsJob.js';
import { runSlotHoldSweep } from './jobs/slotHoldSweepJob.js';

const HOUR = 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

// Swap to BullMQ + Redis when you outgrow a single instance; the atomic
// claim in runDueSubscriptions already makes a second instance safe.
export const initScheduler = (app) => {
  setInterval(() => runSubscriptionsJob({ now: new Date(), log: app.log }).catch((e) => app.log.error({ err: e }, 'subscriptionsJob failed')), HOUR);
  setInterval(() => runSlotHoldSweep({ now: new Date(), log: app.log }).catch((e) => app.log.error({ err: e }, 'slotHoldSweep failed')), FIVE_MIN);
  app.log.info('Scheduler initialised (subscriptions hourly, hold-sweep every 5 min)');
};
```

- [ ] **Step 6: Delete the old job + run tests**

Delete `jobs/subscriptions.js`.
Run: `node --test tests/scheduler.test.js`
Expected: PASS (expired hold cancelled + counter back to 0).
Run: `npm test`
Expected: all green.

**Checkpoint:** scheduler is modular, multi-instance-safe, and self-healing on expired holds. Commit when ready.

---

## Task 11: Container deployment + session store fix + drop Vercel

**Files:**
- Create: `Dockerfile`, `.dockerignore`
- Delete: `vercel.json`
- Modify: `config/config.js` (session store for SRV)

- [ ] **Step 1: Fix the AdminJS session store for SRV URIs**

In `config/config.js`, replace the early `return null` SRV bailout in `createSessionStore()` so it builds a `MongoDBStore` for `mongodb+srv://` too:

```js
export const createSessionStore = () => {
  try {
    const dbName = process.env.DB_NAME || "labzy";
    const baseUri = process.env.MONGO_URI || "mongodb://localhost:27017/labzy";
    const store = new MongoDBStore({ uri: baseUri, collection: "sessions", databaseName: dbName });
    store.on("error", (error) => console.log("session store error", error));
    return store;
  } catch (error) {
    console.log("failed to initialize session store", error);
    return null;
  }
};
```
(Keep the rest of the file unchanged.)

- [ ] **Step 2: Add `Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "app.js"]
```

- [ ] **Step 3: Add `.dockerignore`**

```
node_modules
npm-debug.log
.git
.env
docs
tests
.adminjs
```

- [ ] **Step 4: Remove Vercel config**

Delete `vercel.json`.

- [ ] **Step 5: Smoke-build + full suite**

Run:
```bash
docker build -t labzy-backend .
npm test
```
Expected: image builds; `npm test` green. (If Docker is unavailable locally, verify `node app.js` boots with required env set and `GET /health` returns 200.)

**Checkpoint:** deployable as a long-running container with persistent AdminJS sessions. Commit when ready.

---

## Final Self-Review Checklist (run after all tasks)

- [ ] No controller or middleware calls `.toRFC7807()` directly (grep to confirm).
- [ ] `VALID_TRANSITIONS` defined only in `services/_shared/transitions.js` (grep for duplicates in controllers).
- [ ] `getNearbyLabs` defined once (catalog), not duplicated in `profileController`.
- [ ] Every service file has zero `request`/`reply` references.
- [ ] `npm test` passes: health, env, shared, slotCapacity, booking, labCatalog, partner, auth, notification, scheduler.
- [ ] `jobs/subscriptions.js`, `models/prescription.js`, `vercel.json` are deleted.
- [ ] `start()` boots and `GET /health` returns 200 against a real Mongo URI.

## Dependencies / ordering note

Tasks 1→2 must run first (env exports + scheduler stub unblock the app factory). Task 3 (shared) precedes 4–10. Task 4 (SlotCapacity) precedes 5, 7, 10. The Task 5/7 `notifyBookingStatus` stub is replaced by the real service in Task 9 — if a worker executes strictly in order, create the one-line stub when first referenced, then overwrite in Task 9.

---

# Phase 2 — Frontend Alignment Tasks

> **Driver:** the `labzy frotend helper/` design-system kit + the PatientHome/PatientLabDetail/PatientBookings/PatientReports/PartnerToday/PartnerOrders UI kits surface several endpoints, statuses, and data shapes the current backend cannot serve. Phase 2 closes those gaps without breaking Phase 1's layered architecture: every new endpoint goes through routes → controller → service → models, and uses the same `DomainError` envelope.

**Status mapping (the source of truth used by both apps):**

| Frontend stage    | Backend `Booking.status` | Timeline step | Partner action that advances it |
|-------------------|--------------------------|---------------|---------------------------------|
| Pending lab confirmation | `PENDING`        | 0             | accept → CONFIRMED              |
| Booked / Confirmed | `CONFIRMED`             | 0             | mark collected → COLLECTED      |
| Sample collected   | `COLLECTED`             | 1             | start processing → PROCESSING   |
| Processing         | `PROCESSING` *(new)*    | 2             | upload report → COMPLETED       |
| Report ready       | `COMPLETED`             | 3             | —                               |
| Cancelled by you / by lab | `CANCELLED`      | —             | —                               |

> Phase 2 introduces a new `PROCESSING` state. Existing transitions stay backwards-compatible: `COLLECTED → COMPLETED` becomes `COLLECTED → PROCESSING → COMPLETED`. Old data with status `COLLECTED` is untouched; the new state only appears for bookings that transition forward after Phase 2 ships.

---

## Task 12: Email + password onboarding for customers (defer OTP)

> **Why this is email/password, not phone+OTP:** SMS providers (MSG91/Twilio) charge per send and add an operational dependency. The frontend UI kits show a phone field on the onboarding screen, but the patient app can render that field as **email + password** without re-skinning a single component. When budget is available, swap this task for the previously-drafted phone+OTP design (kept in commit history) — `authService.registerOrLoginByPhone` is a drop-in addition; the email path stays as the partner login. No other Phase-2 task depends on the chosen credential.

**Files:**
- Modify: `models/user.js` — add `emailVerifiedAt` (preps the verification-email task without forcing it now)
- Modify: `services/authService.js` (from Phase-1 Task 8) — `register({ name, email, password, phone?, role? })` already exists and creates a user with hashed password + issues tokens. Confirm it returns `{ accessToken, refreshToken, user }`.
- Modify: `controllers/authController.js` — no changes beyond Phase-1 Task 8.
- Modify: `routes/authRoutes.js` — confirm `POST /auth/register` accepts `phone` (already in the Phase-1 schema; this lets us collect the phone number for future SMS without sending one).
- Create: `tests/customerSignup.test.js` — explicit coverage for the customer path.

- [ ] **Step 1: Add the failing customer-signup test**

Create `tests/customerSignup.test.js`:
```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';

let app;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });
beforeEach(async () => { await User.deleteMany({}); });

test('register then login: customer gets accessToken/refreshToken/user with CUSTOMER role', async () => {
  const reg = await app.inject({ method:'POST', url:'/api/auth/register',
    payload:{ name:'Asha Rao', email:'asha@labzy.test', password:'pass1234', phone:'+919999990000' } });
  assert.equal(reg.statusCode, 201);
  const body = reg.json();
  assert.ok(body.accessToken);
  assert.ok(body.refreshToken);
  assert.deepEqual(body.user.roles, ['CUSTOMER']);

  const login = await app.inject({ method:'POST', url:'/api/auth/login',
    payload:{ email:'asha@labzy.test', password:'pass1234' } });
  assert.equal(login.statusCode, 200);
  assert.ok(login.json().accessToken);
});

test('duplicate email returns 409 CONFLICT', async () => {
  const payload = { name:'A', email:'dup@labzy.test', password:'pass1234' };
  await app.inject({ method:'POST', url:'/api/auth/register', payload });
  const dup = await app.inject({ method:'POST', url:'/api/auth/register', payload });
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.json().type, 'https://labzy.in/errors/CONFLICT');
});
```

- [ ] **Step 2: Verify `services/authService.js` already covers this**

The `register` helper from Phase-1 Task 8 already:
1. Rejects duplicate emails with `Errors.CONFLICT('Email already in use')`.
2. Hashes the password (`bcrypt.hash(password, 12)`).
3. Defaults `roles` to `['CUSTOMER']` unless `role === 'LAB_OWNER'`.
4. Returns `{ accessToken, refreshToken, user: { id, name, email, roles } }`.

No service change is needed; this task is mostly **acceptance test coverage** for the customer journey and a small schema field for future verification.

- [ ] **Step 3: Add `emailVerifiedAt` to `models/user.js`** (no behavior change yet)

Append to the user schema definition:
```js
emailVerifiedAt: { type: Date, default: null },
```
Verification emails are deferred until a transactional sender is configured; the column is added now so the column flip is a one-line change later.

- [ ] **Step 4: Tighten the register route schema**

In `routes/authRoutes.js`, the existing schema already accepts `name, email, password, phone, role`. No change needed.

- [ ] **Step 5: Run**

```bash
node --test tests/customerSignup.test.js
```
Expected: PASS — both subtests.

**Checkpoint:** customer and partner use the same `POST /auth/register` + `POST /auth/login` flow; only the role differs. Commit when ready.

### Future swap-in (when SMS budget exists)

Drop in a follow-up task that adds:
- `models/otpChallenge.js` (TTL'd hashed OTPs with attempt counter),
- `services/otpService.js` (`requestOtp` / `verifyOtp` with bcrypt-hashed compare),
- `services/authService.registerOrLoginByPhone({ phone, otp, name })`,
- `POST /api/auth/otp/request` + `POST /api/auth/otp/verify`,
- `phoneVerifiedAt` on User.

The phone field already collected on `/auth/register` becomes the seed for that flow.

---

## Task 13: Booking code + `PROCESSING` status + advance endpoints

**Why:** the UI shows `LBZ-48291`-style codes and a four-step timeline (Booked → Sampled → Processing → Ready). The current state machine collapses Sampled/Processing into one. Add a sortable, short, public code on every booking and split `PROCESSING` out of `COLLECTED`.

**Files:**
- Modify: `models/booking.js` — add `code` (unique, indexed), extend `status` enum with `PROCESSING`
- Modify: `services/_shared/transitions.js` — add `COLLECTED → PROCESSING` and `PROCESSING → COMPLETED`
- Create: `services/bookingCodeService.js` — `generateCode()` (e.g. `LBZ-` + base32 of incrementing counter)
- Modify: `services/bookingService.js` — set `code` on create
- Modify: `services/partnerService.js` — add `markCollected`, `markProcessing`, `markReady` (the last triggers `linkReport` flow)
- Modify: `controllers/partnerController.js` + `routes/partnerRoutes.js` — `POST /partner/bookings/:id/mark-collected`, `/mark-processing`, `/mark-ready`
- Modify: `tests/booking.test.js` — assert booking response contains `code` matching `^LBZ-[A-Z0-9]{6,}$`
- Create: `tests/bookingAdvance.test.js` — covers full state machine

- [ ] **Step 1: Update `VALID_TRANSITIONS`**
```js
export const VALID_TRANSITIONS = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['COLLECTED', 'CANCELLED'],
  COLLECTED:  ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED'],
  COMPLETED:  [],
  CANCELLED:  [],
};
```

- [ ] **Step 2: Implement `services/bookingCodeService.js`**
```js
import Booking from '../models/booking.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Crockford-ish (no I, O, 0, 1)
const encode = (n) => {
  let s = '';
  while (n > 0) { s = ALPHABET[n % 32] + s; n = Math.floor(n / 32); }
  return s.padStart(5, ALPHABET[0]);
};

export const generateCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `LBZ-${encode(Date.now() % 1e9 + Math.floor(Math.random() * 1024))}`;
    const exists = await Booking.exists({ code: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Failed to generate unique booking code');
};
```

- [ ] **Step 3: Booking model + service updates**
Add to `models/booking.js`:
```js
code: { type: String, unique: true, sparse: true, index: true },
status: { type: String, enum: ['PENDING', 'CONFIRMED', 'COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
```
In `services/bookingService.js` `createBooking`, before `Booking.create(...)`:
```js
const code = await generateCode();
```
and pass `code` into the create payload.

- [ ] **Step 4: Partner advance endpoints**

Add to `services/partnerService.js`:
```js
import { notifyBookingStatus } from './notificationService.js';
const advance = async ({ userId, bookingId, toStatus, allowedFrom }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  if (!allowedFrom.includes(booking.status)) {
    throw Errors.INVALID_BOOKING_TRANSITION(`Cannot move ${booking.status} -> ${toStatus}`);
  }
  assertTransition(booking.status, toStatus);
  booking.status = toStatus;
  await booking.save();
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};
export const markCollected  = (args) => advance({ ...args, toStatus: 'COLLECTED',  allowedFrom: ['CONFIRMED'] });
export const markProcessing = (args) => advance({ ...args, toStatus: 'PROCESSING', allowedFrom: ['COLLECTED'] });
```
(reportService.linkReport already sets COMPLETED — Task 7 — so "mark-ready" is the existing `POST /partner/bookings/:id/report`.)

Add to `controllers/partnerController.js` + `routes/partnerRoutes.js`:
```js
fastify.post('/partner/bookings/:id/mark-collected', { ...ownerAuth }, markCollected);
fastify.post('/partner/bookings/:id/mark-processing', { ...ownerAuth }, markProcessing);
```

- [ ] **Step 5: Test the new transitions**

Create `tests/bookingAdvance.test.js` that walks PENDING → CONFIRMED → COLLECTED → PROCESSING → COMPLETED via owner endpoints and asserts the booking's `code` matches `^LBZ-[A-Z0-9]{6,}$`.

Run: `npm test`
Expected: green.

**Checkpoint:** booking timeline matches the UI; every booking has a code. Commit when ready.

---

## Task 14: Booking reschedule + structured timeline payload

**Why:** the patient bookings UI exposes Reschedule and renders a step timeline whose current index is computed server-side. We give it a stable shape.

**Files:**
- Modify: `services/bookingService.js` — `rescheduleBooking({ user, bookingId, scheduledDate, slot })` (release old slot → reserve new → update booking → notify)
- Modify: `controllers/bookingController.js` + `routes/bookingRoutes.js` — `POST /bookings/:id/reschedule`
- Modify: `services/bookingService.js` `getBookingForUser` and `listBookings` — derive a `timeline` array `[{ step:'Booked', state:'done'|'active'|'pending' }, ...]` from `booking.status`
- Create: `tests/reschedule.test.js`

- [ ] **Step 1: Service**
```js
export const rescheduleBooking = async ({ user, bookingId, scheduledDate, slot }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== user._id.toString()) throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw Errors.INVALID_BOOKING_TRANSITION(`Cannot reschedule a ${booking.status} booking`);
  const lab = await Lab.findById(booking.lab);
  const maxPerSlot = lab?.slotMatrix?.maxBookingsPerSlot || 5;
  await reserveSlot({ labId: booking.lab, scheduledDate, slotStart: slot.start, maxPerSlot });
  await releaseSlot({ labId: booking.lab, scheduledDate: booking.scheduledDate, slotStart: booking.slot.start });
  booking.scheduledDate = new Date(scheduledDate);
  booking.slot = { start: slot.start, end: addMinutes(slot.start, lab.slotMatrix?.duration || 30) };
  booking.slotHoldExpiry = new Date(Date.now() + 15 * 60 * 1000);
  await booking.save();
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};
```

- [ ] **Step 2: Timeline shape**

Add to `services/_shared/transitions.js`:
```js
export const TIMELINE_STEPS = ['Booked', 'Sampled', 'Processing', 'Ready'];
const STATUS_TO_TIMELINE_INDEX = { PENDING: 0, CONFIRMED: 0, COLLECTED: 1, PROCESSING: 2, COMPLETED: 3, CANCELLED: -1 };
export const buildTimeline = (status) => {
  const idx = STATUS_TO_TIMELINE_INDEX[status] ?? -1;
  return TIMELINE_STEPS.map((label, i) => ({
    label,
    state: i < idx ? 'done' : i === idx ? 'active' : 'pending',
  }));
};
```
In `bookingService.getBookingForUser` and `listBookings`, attach `timeline: buildTimeline(b.status)` to each returned booking (serialize via plain object spread).

- [ ] **Step 3: Route + tests**
`fastify.post('/bookings/:id/reschedule', ...)` accepts `{ scheduledDate, slot:{start} }`. Test happy path (PENDING → reschedule → new slot reserved, old released) and the 409 when the new slot is full.

**Checkpoint:** UI can render the timeline directly from `booking.timeline` and reschedule works. Commit when ready.

---

## Task 15: Structured report results (parameter / value / range)

**Why:** PatientReports renders a table of `parameter / value / reference range` with high/low flags. Today, `Report` only stores a PDF URI. Add structured parameters that the lab partner enters at upload time and the customer reads back.

**Files:**
- Modify: `models/report.js` — add `parameters: [{ name, value, unit, refLow, refHigh, flag }]`, `remindRetestAt`
- Modify: `services/reportService.js` — accept `parameters` when linking, expose them on read
- Modify: `controllers/partnerController.js` linkReport input schema (accept optional `parameters`)
- Modify: `controllers/bookingController.js.getBookingReport` — return `{ signedUrl, issuedAt, parameters }`
- Create: `services/reportReminderService.js` — `setRetestReminder({ user, reportId, intervalDays })`
- Add: `POST /reports/:id/retest-reminder`
- Tests: `tests/report.test.js`

- [ ] **Step 1: Schema additions**
```js
const parameterSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  value:   { type: String, required: true },
  unit:    { type: String },
  refLow:  { type: Number },
  refHigh: { type: Number },
  flag:    { type: String, enum: ['LOW', 'NORMAL', 'HIGH', null], default: null },
}, { _id: false });

reportSchema.add({
  parameters:     [parameterSchema],
  remindRetestAt: { type: Date, default: null },
});
```

- [ ] **Step 2: Service**

Extend `reportService.linkReport` to accept `parameters` and persist them. `getReportForUser` already populates the report — add `parameters` to the returned shape.

Add:
```js
export const setRetestReminder = async ({ userId, reportId, intervalDays }) => {
  const report = await Report.findById(reportId).populate('booking');
  if (!report || report.booking.user.toString() !== userId.toString()) throw Errors.REPORT_ACCESS_DENIED();
  report.remindRetestAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
  await report.save();
  return { remindRetestAt: report.remindRetestAt };
};
```

- [ ] **Step 3: Route**
```js
fastify.post('/reports/:id/retest-reminder', { preHandler:[verifyJWT],
  schema: { body: { type:'object', required:['intervalDays'],
    properties: { intervalDays: { type:'integer', minimum:1, maximum:365 } }, additionalProperties:false } } },
  setRetestReminder);
```

- [ ] **Step 4: Schedule the reminder ping**

Add a new job in `scheduler/jobs/retestReminderJob.js`:
```js
import Report from '../../models/report.js';
import { notify } from '../../services/notificationService.js';

export const runRetestReminders = async ({ now = new Date() } = {}) => {
  const due = await Report.find({ remindRetestAt: { $lte: now, $ne: null } }).populate('booking').limit(100);
  for (const r of due) {
    await notify({ userId: r.booking.user, event: 'RETEST_DUE',
      title: 'Time for your re-test', body: `It's time to repeat: ${r.parameters?.[0]?.name || 'your test'}.`,
      data: { reportId: r._id.toString() } });
    r.remindRetestAt = null;
    await r.save();
  }
};
```
Add a 1-hour interval in `scheduler/index.js`.

**Checkpoint:** report list can render the table inline and the customer can set the re-test reminder toggle. Commit when ready.

---

## Task 16: Persisted notifications (list + mark-read) + WebSocket auth

**Why:** the bell icon shows an unread count and tapping it opens a list. We need to persist notifications, not just push them.

**Files:**
- Create: `models/notification.js` — `{ user, event, title, body, data, readAt, createdAt }`
- Modify: `services/notificationService.js` — `notify()` writes a `Notification` doc before broadcasting
- Create: `services/notificationsListService.js` — `list`, `markRead`, `unreadCount`
- Add routes:
  - `GET  /api/notifications` (paginated)
  - `POST /api/notifications/:id/read`
  - `POST /api/notifications/read-all`
  - `GET  /api/notifications/unread-count`
- Add: `routes/wsRoutes.js` — `GET /ws` upgraded route, JWT in `?token=`; calls `registerSocket`
- Tests: `tests/notifications.test.js`

- [ ] **Step 1: Model**
```js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event:  { type: String, required: true },
  title:  { type: String, required: true },
  body:   { type: String },
  data:   { type: mongoose.Schema.Types.Mixed },
  readAt: { type: Date, default: null },
}, { timestamps: true });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
export default mongoose.model('Notification', notificationSchema);
```

- [ ] **Step 2: Service additions**
```js
import Notification from '../models/notification.js';
// inside notify() — persist first, then broadcast/push:
const doc = await Notification.create({ user: userId, event, title, body, data });
broadcast(userId, { id: doc._id.toString(), ...payload });
await sendPush(userId, title, body, data);
```

- [ ] **Step 3: List service**
```js
export const listNotifications = async ({ userId, page = 1, limit = 20 }) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [items, total, unread] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Notification.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return { items, total, unread, page: parseInt(page), limit: parseInt(limit) };
};
export const markRead = async ({ userId, id }) => Notification.findOneAndUpdate({ _id: id, user: userId }, { readAt: new Date() }, { new: true });
export const markAllRead = async ({ userId }) => Notification.updateMany({ user: userId, readAt: null }, { readAt: new Date() });
export const unreadCount = async ({ userId }) => ({ unread: await Notification.countDocuments({ user: userId, readAt: null }) });
```

- [ ] **Step 4: WebSocket route**
```js
// routes/wsRoutes.js
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { JWT_SECRET } from '../config/env.js';
import { registerSocket, unregisterSocket } from '../services/notificationService.js';

export const wsRoutes = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    let userId;
    try { userId = jwt.verify(token, JWT_SECRET).id; } catch { connection.socket.close(1008, 'unauthorized'); return; }
    registerSocket(userId, connection.socket);
    connection.socket.on('close', () => unregisterSocket(userId, connection.socket));
  });
};
```
Register in `routes/index.js` (no `/api` prefix).

**Checkpoint:** bell badge can pull `unreadCount`; tapping bell hits `/notifications`; backend pushes live updates via WS. Commit when ready.

---

## Task 17: Health packages (test bundles)

**Why:** Home shows "Complete Health Check 87 tests ₹999", "Diabetes Panel 12 tests ₹649". These are bundles, not single tests.

**Files:**
- Create: `models/healthPackage.js` — `{ lab, name, slug, description, category, icon, tests:[Test], price, mrp, isActive }`
- Create: `services/healthPackageService.js`
- Add routes:
  - `GET /api/packages` — list, filter by `category`, `lab`, search
  - `GET /api/packages/:slug` — detail
- Extend `Booking` to allow `package` reference; booking creation accepts `packageId` OR `testIds` (expand to package's tests)

- [ ] **Step 1: Model**
```js
import mongoose from 'mongoose';
const pkgSchema = new mongoose.Schema({
  lab:         { type: mongoose.Schema.Types.ObjectId, ref: 'Lab' },
  name:        { type: String, required: true },
  slug:        { type: String, required: true, unique: true, index: true },
  description: { type: String },
  category:    { type: String, default: 'General' },
  icon:        { type: String, default: 'package' },
  tests:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  price:       { type: Number, required: true },
  mrp:         { type: Number },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });
pkgSchema.index({ category: 1, isActive: 1 });
export default mongoose.model('HealthPackage', pkgSchema);
```

- [ ] **Step 2: Service**
```js
export const listPackages = async (q) => {
  const filter = { isActive: true };
  if (q.category) filter.category = q.category;
  if (q.lab)      filter.lab = q.lab;
  if (q.q)        filter.name = { $regex: new RegExp(q.q, 'i') };
  const page = parseInt(q.page) || 1;
  const limit = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * limit;
  const [packages, total] = await Promise.all([
    HealthPackage.find(filter).populate('tests', 'name price').sort({ createdAt: -1 }).skip(skip).limit(limit),
    HealthPackage.countDocuments(filter),
  ]);
  return { packages, total, page, limit };
};
export const getPackage = async (slug) => {
  const pkg = await HealthPackage.findOne({ slug, isActive: true }).populate('tests', 'name price description');
  if (!pkg) throw Errors.NOT_FOUND('Package');
  return pkg;
};
```

- [ ] **Step 3: Booking creation accepts packages**

In `bookingService.createBooking`, when `packageId` is provided:
```js
const pkg = await HealthPackage.findById(packageId).populate('tests');
if (!pkg) throw Errors.NOT_FOUND('Package');
testIds = pkg.tests.map((t) => t._id.toString());
totalAmount = pkg.price; // package price overrides per-test sum
```

Add `package: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthPackage' }` to Booking model and `packageId` to the route schema.

**Checkpoint:** Home can render package cards; tapping a package adds them all to cart at the package price. Commit when ready.

---

## Task 18: Family members / dependents

**Why:** Profile shows "Family members: Asha, Ravi +1" and bookings can be made for a dependent.

**Files:**
- Modify: `models/user.js` — add `dependents: [{ name, relation, gender, birthDate }]` (sub-doc)
- Add routes:
  - `GET    /api/me/dependents`
  - `POST   /api/me/dependents`
  - `PUT    /api/me/dependents/:id`
  - `DELETE /api/me/dependents/:id`
- Modify: `Booking` model — add `patient: { name, relation, gender, birthDate }` snapshot; default to user when no dependent passed
- Update `bookingService.createBooking` to accept `dependentId` and snapshot from `user.dependents`

(Implementation mirrors `addresses` plumbing in profileService — keep the diffs DRY.)

---

## Task 19: Payment intent (Razorpay-pluggable) + booking → payment → confirmed

**Why:** the UI displays prices and "Book ₹999" CTAs; bookings should not jump to CONFIRMED until paid. We add a payment-intent layer.

**Files:**
- Modify: `models/transaction.js` (exists) — confirm shape: `{ user, booking, amount, currency, provider, providerOrderId, providerPaymentId, status }`
- Create: `services/paymentService.js` — `createIntent(booking)` → returns `{ providerOrderId, amount, currency, key }` (uses Razorpay SDK if `RAZORPAY_KEY_ID` set; otherwise dev stub returns `mock_*` IDs)
- Create: `services/webhookService.js` — `handleRazorpayWebhook(payload, signature)` verifies HMAC and marks transaction + booking CONFIRMED
- Add routes:
  - `POST /api/bookings/:id/payment-intent`
  - `POST /api/payments/webhook` (HMAC verified, no auth)
- Modify: `bookingService.createBooking` — leave status `PENDING`, accept `paymentMethod: 'PAY_AT_LAB' | 'ONLINE'`. On `PAY_AT_LAB` skip payment intent (still requires partner accept). On `ONLINE`, customer must hit payment-intent next.

> Critical: the `WEBHOOK_SIGNATURE_INVALID` error type is already defined in `common/errors.js` — use it.

---

## Task 20: Lab reviews & ratings

**Why:** UI shows `★ 4.8 (1.2k reviews)` per lab. The lab model already carries `rating` + `totalRatings` but there is no review collection or write path.

**Files:**
- Create: `models/review.js` — `{ user, lab, booking (optional), rating(1-5), comment, createdAt }`
- Create: `services/reviewService.js`
- Add routes:
  - `POST /api/labs/:id/reviews` (CUSTOMER auth; one review per booking)
  - `GET  /api/labs/:id/reviews` (paginated)
- Recompute `Lab.rating` + `totalRatings` on every create.

```js
// snippet
export const createReview = async ({ user, labId, rating, comment, bookingId }) => {
  if (bookingId && await Review.exists({ user: user._id, booking: bookingId })) throw Errors.CONFLICT('Already reviewed');
  const review = await Review.create({ user: user._id, lab: labId, booking: bookingId, rating, comment });
  const agg = await Review.aggregate([
    { $match: { lab: review.lab } },
    { $group: { _id: '$lab', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Lab.findByIdAndUpdate(labId, { rating: agg[0]?.avg || 0, totalRatings: agg[0]?.count || 0 });
  return review;
};
```

---

## Task 21: Partner Today stats endpoint + "incoming requests" derivation

**Why:** PartnerToday shows `{ totalToday, pending, inProgress, done }` and a list of "new requests". Today these would each be a separate query from the frontend.

**Files:**
- Modify: `services/partnerService.js` — `getTodaySummary(userId)`
- Add route: `GET /api/partner/today`

```js
export const getTodaySummary = async (userId) => {
  const lab = await getOwnedLab(userId);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const match = { lab: lab._id, scheduledDate: { $gte: today, $lt: tomorrow } };
  const [total, pending, inProgress, done, requests] = await Promise.all([
    Booking.countDocuments(match),
    Booking.countDocuments({ ...match, status: 'PENDING' }),
    Booking.countDocuments({ ...match, status: { $in: ['CONFIRMED', 'COLLECTED', 'PROCESSING'] } }),
    Booking.countDocuments({ ...match, status: 'COMPLETED' }),
    Booking.find({ ...match, status: 'PENDING' }).populate('user', 'name phone').populate('tests', 'name price').sort({ createdAt: 1 }).limit(10),
  ]);
  return { lab: { id: lab._id, name: lab.name }, stats: { total, pending, inProgress, done }, requests };
};
```

---

## Task 22: Static reference data (categories + promo banners)

**Why:** Home renders ten fixed category tiles and a three-banner carousel. To let the partner team change these without a release, expose them as a tiny CMS endpoint backed by a config collection.

**Files:**
- Create: `models/appContent.js` — `{ key: 'home_categories' | 'home_banners' | 'lab_amenities', payload: Mixed, updatedAt }`
- Add route: `GET /api/content/:key` (public, cached 5 min via `Cache-Control`)
- Seed defaults (categories from PatientHome.jsx, banners from index.html) in a Phase-2 migration script.

---

## Phase 2 Self-Review

- [ ] Phone-OTP path issues tokens with the same shape as email login.
- [ ] Every booking response (list + detail) includes `code` and `timeline`.
- [ ] `Booking.status` enum includes `PROCESSING`; the state machine is the only place that validates transitions.
- [ ] `GET /reports/:id` returns `parameters` and `signedUrl`.
- [ ] Notifications persist in DB and stream over `/ws`.
- [ ] All Phase-2 routes thread through routes → controller → service → models — no direct Mongo in controllers.

---

# Phase 3 — PRD Compliance

> **Driver:** `Labzy_Detailed_PRD.md` (v2.0). Phase 1 made the architecture sustainable and Phase 2 covered the UI-kit surface. Phase 3 closes the remaining PRD functional requirements (Customer §§6.1–6.12, Partner §§7.1–7.9, cross-cutting §§8.1–8.4). Same architectural rules apply: routes → controllers → services → models; `DomainError` envelope everywhere; no direct DB access in controllers.

**PRD → Task map (jump table):**

> **Auth policy note:** The PRD specifies mobile + OTP for both customers and partner staff. The user has explicitly directed that **email + password is the only auth method** for every role (cost: SMS providers aren't free). Tasks 23 and 40 are therefore implemented as email-only flows that still capture the PRD's other onboarding requirements (consent, DOB/gender, age gate, staff roles, etc.). When SMS budget is available, the deferred phone+OTP work is documented in the "Future swap-in" section at the end of Task 12 (Phase 2).

| PRD §  | Task | Title |
|--------|------|-------|
| 6.1    | 23   | Email+password onboarding with TOS/Privacy/Health-records consent + DOB/gender + < 18 age gate |
| 6.1    | 24   | Session device cap (3 devices) + account-deletion grace |
| 6.2    | 25   | Lab discovery — relevance sort + synonyms + recently viewed + "notify when lab joins" |
| 6.3    | 26   | Lab profile depth — photos, rating distribution, plain-language descriptions |
| 6.4, 6.6 | 27 | Booking state machine v2 — `ASSISTANT_ASSIGNED`, `ON_THE_WAY`, `ARRIVED`, `NO_SHOW`, `RESCHEDULED` + status-event log |
| 6.4    | 28   | Booking policy — 10-min hold, reschedule cutoff & count, cancellation policy, lab-response auto-cancel |
| 6.5    | 29   | Subscription v2 — approve-each-time, slot intelligence, skip/pause-until, occurrence history, payment-failure auto-pause |
| 6.6    | 30   | Sample-collection OTP + masked calling + visit notes |
| 6.6    | 31   | Sample issue → free re-collection flow |
| 6.7, 7.6 | 32 | Reports v2 — per-test partials, replace-with-reason, TAT board |
| 6.8    | 33   | Payments v2 — invoice PDFs, payment history, refund tracker, partial refund, double-pay reversal |
| 6.8    | 34   | Promo codes / offers |
| 6.10   | 35   | Notification preferences + quiet hours + SMS fallback |
| 6.11   | 36   | Reviews v2 — sub-ratings, lab reply, moderation queue, abuse report |
| 6.12   | 37   | Help & support tickets |
| 7.1    | 38   | Lab documents + verification gate + vacation mode + multi-branch |
| 7.2    | 39   | Master test directory + test publish states + slot capacity per mode + blackout dates |
| 7.4    | 40   | Staff roles — Lab Manager + Lab Assistant login + assistant day view + metrics |
| 7.5    | 41   | Lab-scoped customer history + staff notes |
| 7.7    | 45   | Partner notifications v2 — assistant 60-min visit reminder + owner daily digest |
| 7.8    | 42   | Analytics v2 — acceptance / no-show / TAT compliance / peak heatmap / quality panel |
| 7.9    | 43   | Earnings, settlements, disputes |
| 6.9, 8.1, 8.3 | 44 | Data export, consent center, i18n string catalog |

---

## Task 23: Email+password onboarding with PRD-mandated consent + DOB + age gate (§6.1)

**Auth method note:** PRD §6.1 FR-1 specifies mobile + OTP, but user direction overrides — **email + password is the only auth path** for v1 (SMS providers aren't free). The other §6.1 onboarding requirements (consent gates, DOB/gender, < 18 family-member-only rule) are independent of auth method and are implemented in full here.

**Files:**
- Create: `models/consentRecord.js`
- Modify: `services/authService.js` — extend `register()` to enforce consent + DOB + age gate; add `recordConsents()`
- Modify: `controllers/authController.js` — add `consents` handler
- Modify: `routes/authRoutes.js` — extend `/auth/register` body schema; add `POST /auth/consents`
- Modify: `models/user.js` — `birthDate` (exists), `gender` (exists); no new fields
- Create: `tests/customerSignup.test.js`

- [ ] **Step 1: `models/consentRecord.js`**

```js
import mongoose from 'mongoose';

const consentRecordSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind:    { type: String, enum: ['TOS', 'PRIVACY', 'HEALTH_RECORDS', 'MARKETING'], required: true },
  version: { type: String, required: true },
  given:   { type: Boolean, required: true },
  ip:      { type: String },
  ua:      { type: String },
}, { timestamps: true });

consentRecordSchema.index({ user: 1, kind: 1, createdAt: -1 });

export default mongoose.model('ConsentRecord', consentRecordSchema);
```

- [ ] **Step 2: Extend `services/authService.js`**

Replace the existing `register()` with:

```js
import ConsentRecord from '../models/consentRecord.js';

const REQUIRED_CONSENTS = ['TOS', 'PRIVACY', 'HEALTH_RECORDS'];
const MIN_AGE_YEARS = 18;

const ageYearsFrom = (birthDate) => {
  if (!birthDate) return null;
  const ageMs = Date.now() - new Date(birthDate).getTime();
  return ageMs / (365.25 * 24 * 3600 * 1000);
};

export const register = async ({ name, email, password, phone, role, gender, birthDate, consents, ip, ua }) => {
  if (await User.findOne({ email })) throw Errors.CONFLICT('Email already in use');

  // PRD §6.1 FR-2: TOS + Privacy + Health-records mandatory at signup (customers only).
  const isCustomer = role !== 'LAB_OWNER';
  if (isCustomer) {
    const accepted = new Set((consents || []).filter((c) => c.given).map((c) => c.kind));
    for (const k of REQUIRED_CONSENTS) {
      if (!accepted.has(k)) throw Errors.VALIDATION_ERROR(`Missing required consent: ${k}`);
    }
  }

  // PRD §6.1 edge: minors must be family-member profiles, not standalone accounts.
  if (isCustomer && birthDate) {
    const age = ageYearsFrom(birthDate);
    if (age !== null && age < MIN_AGE_YEARS) {
      throw Errors.VALIDATION_ERROR('Users under 18 must be added as a family member under an adult account');
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const roles = role === 'LAB_OWNER' ? ['LAB_OWNER'] : ['CUSTOMER'];
  const user = await User.create({
    name,
    email,
    passwordHash,
    phone,
    roles,
    gender,
    birthDate: birthDate ? new Date(birthDate) : undefined,
  });

  if (isCustomer && Array.isArray(consents)) {
    await ConsentRecord.insertMany(consents.map((c) => ({
      user: user._id, kind: c.kind, version: c.version || '1.0', given: !!c.given, ip, ua,
    })));
  }

  const tokens = await issueTokens(user);
  return { ...tokens, user: publicUser(user) };
};

export const recordConsents = async ({ userId, consents, ip, ua }) => {
  const docs = await ConsentRecord.insertMany((consents || []).map((c) => ({
    user: userId, kind: c.kind, version: c.version || '1.0', given: !!c.given, ip, ua,
  })));
  return { recorded: docs.length };
};
```

- [ ] **Step 3: Controller**

```js
// controllers/authController.js — add:
export const consents = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.recordConsents({
    userId: req.user._id,
    consents: req.body.consents,
    ip: req.ip,
    ua: req.headers['user-agent'],
  })));
```

Pass `ip` and `ua` into `register()` from the controller as well:

```js
export const register = asyncHandler(async (req, reply) =>
  reply.code(201).send(await authService.register({
    ...req.body,
    ip: req.ip,
    ua: req.headers['user-agent'],
  })));
```

- [ ] **Step 4: Routes**

```js
// routes/authRoutes.js — replace the existing /auth/register schema with:
fastify.post('/auth/register', {
  schema: {
    body: {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name:      { type: 'string', minLength: 2 },
        email:     { type: 'string', format: 'email' },
        password:  { type: 'string', minLength: 6 },
        phone:     { type: 'string' },
        role:      { type: 'string', enum: ['CUSTOMER', 'LAB_OWNER'] },
        gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
        birthDate: { type: 'string', format: 'date' },
        consents: { type: 'array', items: { type: 'object',
          required: ['kind', 'given'],
          properties: {
            kind:    { type: 'string', enum: ['TOS', 'PRIVACY', 'HEALTH_RECORDS', 'MARKETING'] },
            given:   { type: 'boolean' },
            version: { type: 'string' },
          }, additionalProperties: false } },
      },
      additionalProperties: false,
    },
  },
}, register);

fastify.post('/auth/consents', {
  preHandler: [verifyJWT],
  schema: {
    body: { type: 'object', required: ['consents'],
      properties: { consents: { type: 'array' } },
      additionalProperties: false } },
}, consents);
```

- [ ] **Step 5: Test (`tests/customerSignup.test.js`)**

```js
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import ConsentRecord from '../models/consentRecord.js';

let app;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), ConsentRecord.deleteMany({})]); });

const fullConsent = [
  { kind: 'TOS',            given: true },
  { kind: 'PRIVACY',        given: true },
  { kind: 'HEALTH_RECORDS', given: true },
];

test('customer signup requires TOS+Privacy+HealthRecords consent', async () => {
  const partial = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Asha', email: 'a@x.com', password: 'pass1234',
      birthDate: '1990-01-01', consents: [{ kind: 'TOS', given: true }] },
  });
  assert.equal(partial.statusCode, 400);

  const ok = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Asha', email: 'a@x.com', password: 'pass1234',
      birthDate: '1990-01-01', consents: fullConsent },
  });
  assert.equal(ok.statusCode, 201);
  const body = ok.json();
  assert.ok(body.accessToken);
  assert.deepEqual(body.user.roles, ['CUSTOMER']);
  assert.equal((await ConsentRecord.countDocuments()), 3);
});

test('customer signup rejects users under 18', async () => {
  const minor = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Minor', email: 'm@x.com', password: 'pass1234',
      birthDate: '2020-01-01', consents: fullConsent },
  });
  assert.equal(minor.statusCode, 400);
  assert.match(minor.json().detail, /under 18/);
});

test('LAB_OWNER signup does not require consents', async () => {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Owner', email: 'o@x.com', password: 'pass1234', role: 'LAB_OWNER' },
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json().user.roles, ['LAB_OWNER']);
});

test('POST /auth/consents persists additional consents post-signup', async () => {
  const reg = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { name: 'A', email: 'b@x.com', password: 'pass1234',
      birthDate: '1990-01-01', consents: fullConsent } });
  const token = reg.json().accessToken;
  const marketing = await app.inject({ method: 'POST', url: '/api/auth/consents',
    headers: { authorization: `Bearer ${token}` },
    payload: { consents: [{ kind: 'MARKETING', given: true }] } });
  assert.equal(marketing.statusCode, 200);
  assert.equal(marketing.json().recorded, 1);
});
```

Run: `node --test tests/customerSignup.test.js` → PASS.

**Checkpoint:** customer signup gates on TOS/Privacy/Health-records, captures DOB, blocks minors, and writes an audit trail. Partner signup still works without consent. Commit when ready.

---

## Task 24: Session device cap + account-deletion grace (§6.1 FR-6, FR-7)

**Why (PRD):** "A user can be logged in on a maximum of 3 devices simultaneously; logging into a 4th logs out the oldest." Account deletion: "30-day grace period, irreversible after."

**Files:**
- Create: `models/session.js` — per-device refresh-token record
- Modify: `services/authService.js` — replace single `user.refreshToken` field with `Session`
- Modify: `services/profileService.js` — `requestAccountDeletion`, `cancelDeletion`
- Add routes: `DELETE /api/me`, `POST /api/me/restore`
- Scheduler: `scheduler/jobs/accountDeletionJob.js` runs daily, purges users whose `deletionScheduledAt < now`
- Tests: `tests/sessionCap.test.js`, `tests/accountDeletion.test.js`

- [ ] **Step 1: `models/session.js`**

```js
import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshTokenHash: { type: String, required: true },
  deviceId:         { type: String },
  deviceLabel:      { type: String },
  ua:               { type: String },
  ip:               { type: String },
  lastUsedAt:       { type: Date, default: Date.now },
}, { timestamps: true });

sessionSchema.index({ user: 1, lastUsedAt: -1 });

export default mongoose.model('Session', sessionSchema);
```

- [ ] **Step 2: Update `services/authService.js`**

Replace the existing `issueTokens` with one that creates a `Session` row and enforces the 3-device cap:

```js
import Session from '../models/session.js';

const MAX_SESSIONS = 3;

const issueTokens = async (user, { deviceId, deviceLabel, ua, ip } = {}) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  // If a session with the same deviceId exists, replace it (re-login on same device).
  if (deviceId) await Session.deleteMany({ user: user._id, deviceId });

  await Session.create({ user: user._id, refreshTokenHash, deviceId, deviceLabel, ua, ip });

  // Cap at 3 — evict oldest if more.
  const sessions = await Session.find({ user: user._id }).sort({ lastUsedAt: -1 });
  if (sessions.length > MAX_SESSIONS) {
    const evict = sessions.slice(MAX_SESSIONS).map((s) => s._id);
    await Session.deleteMany({ _id: { $in: evict } });
  }
  return { accessToken, refreshToken };
};
```

Update `refresh()` to match a candidate session via `bcrypt.compare`:

```js
export const refresh = async ({ refreshToken, deviceId }) => {
  if (!refreshToken) throw Errors.UNAUTHORIZED();
  let decoded;
  try { decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET); } catch { throw Errors.UNAUTHORIZED(); }
  const sessions = await Session.find({ user: decoded.id });
  let matched = null;
  for (const s of sessions) {
    if (await bcrypt.compare(refreshToken, s.refreshTokenHash)) { matched = s; break; }
  }
  if (!matched) throw Errors.UNAUTHORIZED();
  await Session.deleteOne({ _id: matched._id });

  const user = await User.findById(decoded.id);
  if (!user) throw Errors.UNAUTHORIZED();
  return issueTokens(user, { deviceId, ua: matched.ua, ip: matched.ip });
};

export const logout = async (user, refreshToken) => {
  if (refreshToken) {
    const sessions = await Session.find({ user: user._id });
    for (const s of sessions) {
      if (await bcrypt.compare(refreshToken, s.refreshTokenHash)) { await Session.deleteOne({ _id: s._id }); break; }
    }
  } else {
    await Session.deleteMany({ user: user._id });
  }
  return { message: 'Logged out successfully' };
};
```

- [ ] **Step 3: Account deletion grace period — `models/user.js`**

Add:
```js
deletionScheduledAt: { type: Date, default: null, index: true },
```

`services/profileService.js`:
```js
import { notify } from './notificationService.js';

const GRACE_DAYS = 30;

export const requestAccountDeletion = async ({ userId }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  user.deletionScheduledAt = new Date(Date.now() + GRACE_DAYS * 24 * 3600 * 1000);
  await user.save();
  await Session.deleteMany({ user: userId });
  await notify({ userId, event: 'ACCOUNT_DELETION_REQUESTED',
    title: 'Account deletion scheduled',
    body: `Your account will be deleted on ${user.deletionScheduledAt.toDateString()}. You can cancel until then.`,
  });
  return { deletionScheduledAt: user.deletionScheduledAt };
};

export const cancelAccountDeletion = async ({ userId }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  if (!user.deletionScheduledAt) throw Errors.VALIDATION_ERROR('No deletion is scheduled');
  if (user.deletionScheduledAt < new Date()) throw Errors.VALIDATION_ERROR('Grace period has elapsed');
  user.deletionScheduledAt = null;
  await user.save();
  return { message: 'Account deletion cancelled' };
};
```

- [ ] **Step 4: Deletion job**

`scheduler/jobs/accountDeletionJob.js`:
```js
import User from '../../models/user.js';
import Session from '../../models/session.js';
import Booking from '../../models/booking.js';

export const runAccountDeletion = async ({ now = new Date(), log } = {}) => {
  const due = await User.find({ deletionScheduledAt: { $lte: now, $ne: null } }).limit(50);
  let purged = 0;
  for (const u of due) {
    // Hard-delete personal fields; preserve booking analytics anonymously.
    await Session.deleteMany({ user: u._id });
    await Booking.updateMany({ user: u._id }, { $unset: { userAddress: '', patient: '' } });
    u.name = 'Deleted User';
    u.email = undefined;
    u.phone = undefined;
    u.passwordHash = undefined;
    u.addresses = [];
    u.dependents = [];
    u.gender = undefined;
    u.birthDate = undefined;
    u.deletionScheduledAt = null;
    u.fcmToken = undefined;
    await u.save();
    purged += 1;
  }
  log?.info({ purged }, 'Account deletion job complete');
  return purged;
};
```

Register a daily interval in `scheduler/index.js`:
```js
const DAY = 24 * 60 * 60 * 1000;
setInterval(() => runAccountDeletion({ now: new Date(), log: app.log })
  .catch((e) => app.log.error({ err: e }, 'accountDeletion failed')), DAY);
```

- [ ] **Step 5: Routes**

```js
// routes/profileRoutes.js
fastify.delete('/me', auth, deleteAccount);
fastify.post('/me/restore', auth, restoreAccount);
```

**Checkpoint:** 3-device cap + 30-day grace deletion. Commit when ready.

---

## Task 25: Lab discovery — relevance sort + synonyms + recently viewed + "notify when lab joins" (§6.2)

**Why (PRD):** §6.2 FR-1 default relevance blend (distance + rating + availability), FR-5 synonyms ("sugar test" → "fasting blood glucose", "thyroid" → "TSH/T3/T4"), FR-8 recently viewed labs / recent searches, "Notify me when a lab joins near me" empty-state action.

**Files:**
- Create: `services/searchSynonymService.js` — synonym expansion
- Modify: `services/labCatalogService.js` — `nearbyLabs` accepts `sortBy=relevance` (default) and computes score
- Create: `models/recentSearch.js`, `models/labWatch.js`
- Add routes: `GET /api/me/recent-searches`, `POST /api/me/recent-searches`, `POST /api/me/lab-watches`

- [ ] **Step 1: `services/searchSynonymService.js`**

```js
// PRD §6.2 FR-5 — small starter dictionary; admins can extend via AppContent ("search_synonyms" key).
import { getContent } from './contentService.js';

const DEFAULT = {
  'sugar':        ['fasting blood glucose', 'random blood sugar', 'HbA1c'],
  'sugar test':   ['fasting blood glucose', 'HbA1c'],
  'thyroid':      ['TSH', 'T3', 'T4'],
  'diabetes':     ['HbA1c', 'fasting blood glucose'],
  'cholesterol':  ['lipid profile'],
  'kidney':       ['creatinine', 'urea', 'eGFR'],
};

let cache;
export const expand = async (term) => {
  if (!term) return [];
  const lower = term.toLowerCase().trim();
  cache ||= await getContent('search_synonyms').catch(() => ({ payload: DEFAULT }));
  const dict = cache.payload || DEFAULT;
  return [lower, ...(dict[lower] || [])];
};
```

- [ ] **Step 2: Relevance sort in `labCatalogService.nearbyLabs`**

```js
export const nearbyLabs = async ({ lat, lng, radius = 5000, minRating, sortBy = 'relevance', q, page = 1, limit = 20 }) => {
  const expanded = q ? await expand(q) : null;
  const pipeline = [
    { $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distanceMeters',
        maxDistance: parseInt(radius),
        spherical: true,
        query: { isActive: true, ...(minRating ? { rating: { $gte: parseFloat(minRating) } } : {}) },
    } },
  ];
  if (expanded) {
    pipeline.push({ $lookup: {
      from: 'tests', localField: '_id', foreignField: 'lab', as: 'matchingTests',
      pipeline: [{ $match: { isActive: true, name: { $regex: new RegExp(expanded.join('|'), 'i') } } }],
    } });
    pipeline.push({ $match: { matchingTests: { $not: { $size: 0 } } } });
  }
  if (sortBy === 'relevance') {
    pipeline.push({ $addFields: {
      relevanceScore: {
        $add: [
          { $multiply: ['$rating', 100] },                                   // rating: bigger is better
          { $multiply: [{ $divide: [10000, { $add: ['$distanceMeters', 100] }] }, 1] }, // closer is better
        ],
      },
    } });
    pipeline.push({ $sort: { relevanceScore: -1 } });
  } else if (sortBy === 'distance') pipeline.push({ $sort: { distanceMeters: 1 } });
  else if (sortBy === 'rating')     pipeline.push({ $sort: { rating: -1 } });

  pipeline.push({ $skip: (parseInt(page) - 1) * parseInt(limit) });
  pipeline.push({ $limit: parseInt(limit) });
  const labs = await Lab.aggregate(pipeline);
  return { labs, count: labs.length };
};
```

- [ ] **Step 3: `models/recentSearch.js`, `models/labWatch.js`**

```js
// recentSearch.js
const schema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind:  { type: String, enum: ['LAB', 'TEST', 'PACKAGE', 'QUERY'], required: true },
  value: { type: String, required: true },
  ref:   { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });

// labWatch.js
const schema2 = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  location:    { type: { type: String, default: 'Point' }, coordinates: { type: [Number], required: true } },
  radiusMeters:{ type: Number, default: 5000 },
  notifiedAt:  { type: Date, default: null },
}, { timestamps: true });
schema2.index({ location: '2dsphere' });
```

- [ ] **Step 4: Service + routes**

```js
// services/discoveryService.js
import RecentSearch from '../models/recentSearch.js';
import LabWatch from '../models/labWatch.js';

export const recordSearch = async ({ userId, kind, value, ref }) => {
  await RecentSearch.create({ user: userId, kind, value, ref });
  // Keep at most 20 per user.
  const old = await RecentSearch.find({ user: userId }).sort({ createdAt: -1 }).skip(20);
  if (old.length) await RecentSearch.deleteMany({ _id: { $in: old.map((r) => r._id) } });
};
export const listRecentSearches = (userId) =>
  RecentSearch.find({ user: userId }).sort({ createdAt: -1 }).limit(20);
export const watchLabsNearby = ({ userId, lat, lng, radiusMeters }) =>
  LabWatch.create({ user: userId, location: { type: 'Point', coordinates: [lng, lat] }, radiusMeters });
```

```js
// routes/profileRoutes.js — add:
fastify.get('/me/recent-searches', auth, listRecentSearches);
fastify.post('/me/recent-searches', { ...auth, schema: {
  body: { type: 'object', required: ['kind','value'],
    properties: { kind: { type: 'string', enum: ['LAB','TEST','PACKAGE','QUERY'] },
                  value: { type: 'string' }, ref: { type: 'string' } } } },
}, recordSearch);
fastify.post('/me/lab-watches', { ...auth, schema: {
  body: { type: 'object', required: ['lat','lng'],
    properties: { lat: { type: 'number' }, lng: { type: 'number' }, radiusMeters: { type: 'integer' } } } },
}, watchLabsNearby);
```

When a new lab goes active (`Lab.save()` post-hook), the matching `LabWatch` rows produce notifications via the existing `notify()` helper.

**Checkpoint:** Discovery returns relevance-ranked results that respect synonyms; recent searches and watches persist per user. Commit.

---

## Task 26: Lab profile depth — photos, rating distribution, plain-language descriptions (§6.3)

**Why (PRD):** Lab profile shows photos + masked-call + rating distribution + plain-language test copy. Test catalog shows preparation hours, sample type, savings on packages.

**Files:**
- Modify: `models/lab.js` — `photos`, `description`, `amenities`
- Modify: `models/test.js` — `plainLanguageDescription`, `fastingHours`, `sampleType`
- Modify: `services/labCatalogService.js` — `getLab` returns rating distribution
- Modify: `services/healthPackageService.js` — include `savings` (mrp − price) per package

- [ ] **Step 1: Lab + Test schema updates**

```js
// models/lab.js — append:
photos:      [{ url: String, caption: String }],
description: { type: String },
amenities:   [{ type: String }],

// models/test.js — append:
plainLanguageDescription: { type: String },
fastingHours:             { type: Number, default: 0 },
sampleType:               { type: String, enum: ['Blood','Urine','Stool','Swab','Imaging','Other'], default: 'Blood' },
```

- [ ] **Step 2: Rating distribution in `getLab`**

```js
import Review from '../models/review.js';

export const getLab = async (id) => {
  const [lab, dist] = await Promise.all([
    Lab.findById(id).populate('owner', 'name email phone').select('-__v'),
    Review.aggregate([
      { $match: { lab: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);
  if (!lab) throw Errors.NOT_FOUND('Lab', `/labs/${id}`);
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of dist) ratingDistribution[d._id] = d.count;
  return { ...lab.toObject(), ratingDistribution };
};
```

- [ ] **Step 3: Package savings**

```js
// services/healthPackageService.js — in listPackages, attach savings.
const withSavings = (pkg) => {
  const sumOfTests = (pkg.tests || []).reduce((s, t) => s + (t.price || 0), 0);
  return { ...pkg.toObject(), sumOfTests, savings: Math.max(0, sumOfTests - pkg.price) };
};
```

**Checkpoint:** lab/test/package payloads carry the depth the patient UI expects. Commit.

---

## Task 27: Booking state machine v2 + status-event log (§6.4 FR-7, §6.6)

**Why (PRD §6.4 FR-7):** Customer-visible states are `Pending lab confirmation` → `Confirmed` → `Assistant assigned` → `On the way` → `Arrived` → `Sample collected` → `Processing` → `Report ready` → `Completed` plus `Rescheduled`, `Cancelled by you`, `Cancelled by lab`, `No-show`. Backend currently has fewer states; expand.

**Files:**
- Modify: `models/booking.js` — extend `status` enum and add `cancelBy`
- Create: `models/bookingEvent.js` — append-only event log
- Modify: `services/_shared/transitions.js` — add new transitions + new `buildTimeline`
- Modify: `services/partnerService.js`, `services/bookingService.js` — emit event rows on every state change
- Add: assistant-side actions in a future task (Task 30 builds on this)

- [ ] **Step 1: Enum + cancelBy**

```js
// models/booking.js
status: { type: String,
  enum: [
    'PENDING','CONFIRMED','ASSISTANT_ASSIGNED','ON_THE_WAY','ARRIVED',
    'COLLECTED','PROCESSING','COMPLETED','RESCHEDULED','NO_SHOW','CANCELLED',
  ],
  default: 'PENDING' },
cancelBy: { type: String, enum: ['CUSTOMER','LAB','SYSTEM',null], default: null },
rescheduleCount: { type: Number, default: 0 },
```

- [ ] **Step 2: `models/bookingEvent.js`**

```js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  fromStatus: String,
  toStatus:   { type: String, required: true },
  actorType:  { type: String, enum: ['CUSTOMER','LAB_OWNER','LAB_ASSISTANT','SYSTEM'], required: true },
  actorId:    { type: mongoose.Schema.Types.ObjectId },
  reason:     String,
  meta:       mongoose.Schema.Types.Mixed,
}, { timestamps: true });
schema.index({ booking: 1, createdAt: 1 });
export default mongoose.model('BookingEvent', schema);
```

- [ ] **Step 3: Extend `transitions.js`**

```js
export const VALID_TRANSITIONS = {
  PENDING:            ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:          ['ASSISTANT_ASSIGNED', 'COLLECTED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'],
  ASSISTANT_ASSIGNED: ['ON_THE_WAY', 'ASSISTANT_ASSIGNED', 'CANCELLED', 'NO_SHOW'],
  ON_THE_WAY:         ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED:            ['COLLECTED', 'NO_SHOW'],
  COLLECTED:          ['PROCESSING', 'CANCELLED'],
  PROCESSING:         ['COMPLETED'],
  COMPLETED:          [],
  RESCHEDULED:        ['CONFIRMED'],
  CANCELLED:          [],
  NO_SHOW:            [],
};

export const TIMELINE_STEPS = ['Booked', 'Confirmed', 'On the way', 'Sample collected', 'Processing', 'Report ready'];
const STATUS_TO_TIMELINE_INDEX = {
  PENDING: 0, CONFIRMED: 1, ASSISTANT_ASSIGNED: 1,
  ON_THE_WAY: 2, ARRIVED: 2,
  COLLECTED: 3, PROCESSING: 4, COMPLETED: 5,
  RESCHEDULED: 1, NO_SHOW: -1, CANCELLED: -1,
};
export const buildTimeline = (status) => {
  const idx = STATUS_TO_TIMELINE_INDEX[status] ?? -1;
  return TIMELINE_STEPS.map((label, i) => ({
    label, state: i < idx ? 'done' : i === idx ? 'active' : 'pending',
  }));
};
```

- [ ] **Step 4: Event-log helper**

```js
// services/_shared/events.js
import BookingEvent from '../../models/bookingEvent.js';
export const recordEvent = async ({ booking, fromStatus, toStatus, actorType, actorId, reason, meta }) =>
  BookingEvent.create({ booking: booking._id, fromStatus, toStatus, actorType, actorId, reason, meta });
```

Call `recordEvent({...})` from every status-changing service path (`bookingService.cancelBooking`, `partnerService.acceptBooking`, etc.).

**Checkpoint:** every status change writes an event row; `GET /api/bookings/:id/events` (add a small route) returns the timeline an investigator can audit. Commit.

---

## Task 28: Booking policy — 10-min hold + reschedule cutoff + lab-response auto-cancel (§6.4 FR-5, FR-8, FR-9, FR-10)

**Why (PRD):** §6.4 mandates a 10-minute slot hold (not 15), 4-hour reschedule cutoff with max 2 reschedules, 4-hour cancellation cutoff with lab-defined fee, and **2-hour lab-response SLA** after which the booking auto-cancels with full refund.

**Files:**
- Modify: `services/bookingService.js` — change hold to 10 min, enforce reschedule cutoff/count
- Modify: `models/lab.js` — add `policy: { responseSlaMinutes, rescheduleCutoffHours, cancellationCutoffHours, cancellationFee, noShowFee }`
- Create: `scheduler/jobs/labResponseSlaJob.js` — auto-cancel PENDING bookings older than the lab's SLA

- [ ] **Step 1: `models/lab.js` policy block**

```js
policy: {
  responseSlaMinutes:       { type: Number, default: 120 }, // PRD §6.4 FR-10: 2 hours
  rescheduleCutoffHours:    { type: Number, default: 4 },   // PRD §6.4 FR-8
  maxReschedulesPerBooking: { type: Number, default: 2 },   // PRD §6.4 FR-8
  cancellationCutoffHours:  { type: Number, default: 4 },   // PRD §6.4 FR-9
  cancellationFee:          { type: Number, default: 0 },
  noShowFee:                { type: Number, default: 0 },
  noShowGraceMinutes:       { type: Number, default: 30 },
  homeCollectionFee:        { type: Number, default: 0 },   // PRD §6.4 FR-3
  homeCollectionWaiverAbove:{ type: Number, default: 0 },   // PRD §6.4 FR-3: fee waived above this order value
},
```

Apply the fee in `bookingService.createBooking` for home bookings:

```js
let homeCollectionFee = 0;
if (collectionType === 'HOME') {
  homeCollectionFee = lab.policy?.homeCollectionFee || 0;
  const waiverThreshold = lab.policy?.homeCollectionWaiverAbove || 0;
  if (waiverThreshold > 0 && cart.totalAmount >= waiverThreshold) homeCollectionFee = 0;
}
// ...
const booking = await Booking.create({
  // ...
  totalAmount: cart.totalAmount + homeCollectionFee,
  homeCollectionFee, // store separately for invoice line itemisation (PRD §6.8 FR-2)
});
```

Add to `models/booking.js`:
```js
homeCollectionFee: { type: Number, default: 0 },
```

- [ ] **Step 2: 10-min hold (was 15)**

In `services/bookingService.js`:
```js
const HOLD_MS = 10 * 60 * 1000; // PRD §6.4 FR-5
// ... in createBooking:
slotHoldExpiry: new Date(Date.now() + HOLD_MS),
```

- [ ] **Step 3: Reschedule cutoff + count**

```js
export const rescheduleBooking = async ({ user, bookingId, scheduledDate, slot }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== user._id.toString()) throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) throw Errors.INVALID_BOOKING_TRANSITION(`Cannot reschedule a ${booking.status} booking`);

  const lab = await Lab.findById(booking.lab);
  if (!lab) throw Errors.NOT_FOUND('Lab');
  const cutoffMs = (lab.policy?.rescheduleCutoffHours ?? 4) * 3600 * 1000;
  const slotMoment = new Date(booking.scheduledDate);
  const [h, m] = booking.slot.start.split(':').map(Number);
  slotMoment.setHours(h, m, 0, 0);
  if (slotMoment.getTime() - Date.now() < cutoffMs) {
    throw Errors.RESCHEDULE_CUTOFF_PASSED(`Reschedule cutoff is ${lab.policy?.rescheduleCutoffHours} hours before slot`);
  }
  const maxR = lab.policy?.maxReschedulesPerBooking ?? 2;
  if (booking.rescheduleCount >= maxR) {
    throw Errors.RESCHEDULE_LIMIT_REACHED(`Reschedules exhausted (max ${maxR})`);
  }

  await reserveSlot({ labId: booking.lab, scheduledDate, slotStart: slot.start,
    maxPerSlot: lab.slotMatrix?.maxBookingsPerSlot || 5 });
  await releaseSlot({ labId: booking.lab, scheduledDate: booking.scheduledDate, slotStart: booking.slot.start });
  booking.scheduledDate = new Date(scheduledDate);
  booking.slot = { start: slot.start, end: addMinutes(slot.start, lab.slotMatrix?.duration || 30) };
  booking.rescheduleCount += 1;
  booking.slotHoldExpiry = new Date(Date.now() + HOLD_MS);
  await booking.save();
  return withTimeline(booking);
};
```

- [ ] **Step 4: Add errors**

`common/errors.js`:
```js
RESCHEDULE_CUTOFF_PASSED: (detail) => new DomainError('RESCHEDULE_CUTOFF_PASSED', 409, detail || 'Reschedule cutoff passed'),
RESCHEDULE_LIMIT_REACHED: (detail) => new DomainError('RESCHEDULE_LIMIT_REACHED', 409, detail || 'No more reschedules allowed'),
CANCELLATION_FEE_APPLICABLE: (detail) => new DomainError('CANCELLATION_FEE_APPLICABLE', 200, detail || 'Cancellation fee applies'),
```

- [ ] **Step 5: Lab response SLA job**

```js
// scheduler/jobs/labResponseSlaJob.js
import Booking from '../../models/booking.js';
import Lab from '../../models/lab.js';
import { releaseSlot } from '../../services/slotCapacityService.js';
import { notifyBookingStatus } from '../../services/notificationService.js';
import { recordEvent } from '../../services/_shared/events.js';

export const runLabResponseSlaSweep = async ({ now = new Date(), log } = {}) => {
  const candidates = await Booking.find({ status: 'PENDING', createdAt: { $lte: new Date(now.getTime() - 60 * 60 * 1000) } }).limit(200);
  let cancelled = 0;
  for (const b of candidates) {
    const lab = await Lab.findById(b.lab).select('policy');
    const slaMin = lab?.policy?.responseSlaMinutes ?? 120;
    const slotMoment = new Date(b.scheduledDate);
    const [hh, mm] = b.slot.start.split(':').map(Number);
    slotMoment.setHours(hh, mm, 0, 0);
    const slaDeadline = new Date(b.createdAt.getTime() + slaMin * 60 * 1000);
    if (now.getTime() < Math.min(slaDeadline.getTime(), slotMoment.getTime())) continue;
    const fromStatus = b.status;
    b.status = 'CANCELLED';
    b.cancelBy = 'SYSTEM';
    b.cancelReason = 'Lab did not respond within SLA';
    await b.save();
    await releaseSlot({ labId: b.lab, scheduledDate: b.scheduledDate, slotStart: b.slot.start });
    await recordEvent({ booking: b, fromStatus, toStatus: 'CANCELLED', actorType: 'SYSTEM',
      reason: 'lab-response-sla' });
    notifyBookingStatus(b).catch(() => {});
    cancelled += 1;
  }
  log?.info({ cancelled }, 'Lab response SLA sweep complete');
  return cancelled;
};
```

Register on a 10-min interval in `scheduler/index.js`.

**Checkpoint:** policy fields, cutoffs, max-reschedules and auto-cancel SLA enforced. Commit.

---

## Task 29: Subscription v2 — approve-each-time + slot intelligence + skip/pause-until + occurrence history + payment-failure auto-pause (§6.5)

**Why (PRD §6.5):** Need approve-per-occurrence flow, pre-booking reminder (N days, default 3), slot intelligence (preferred window → nearest same day → next +2 days), skip / pause-until-date / resume, two consecutive payment failures auto-pause, full occurrence history per subscription.

**Files:**
- Modify: `models/subscription.js` — add policy + occurrence history reference
- Create: `models/subscriptionOccurrence.js` — one row per occurrence
- Modify: `services/subscriptionService.js` — split `runDueSubscriptions` into `requestNextOccurrence`, plus `skipOccurrence`, `pauseUntil`
- Modify: `scheduler/jobs/subscriptionsJob.js` — implements the new slot-intelligence flow
- Add routes: `POST /api/subscriptions/:id/skip-next`, `POST /api/subscriptions/:id/pause-until`, `GET /api/subscriptions/:id/occurrences`

- [ ] **Step 1: Subscription policy**

```js
// models/subscription.js — append:
preferredTimeWindow: {
  start: { type: String, default: '09:00' },
  end:   { type: String, default: '12:00' },
},
preBookingReminderDays:  { type: Number, default: 3, min: 1, max: 7 },
approvalMode:            { type: String, enum: ['AUTO_PAY','APPROVE_EACH_TIME'], default: 'APPROVE_EACH_TIME' },
pauseUntil:              { type: Date, default: null },
consecutivePaymentFailures: { type: Number, default: 0 },
collectionType:          { type: String, enum: ['HOME','IN_LAB'], default: 'IN_LAB' },
userAddressId:           { type: mongoose.Schema.Types.ObjectId },
dependentId:             { type: mongoose.Schema.Types.ObjectId },
```

- [ ] **Step 2: `models/subscriptionOccurrence.js`**

```js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
  scheduledFor: { type: Date, required: true },
  state: { type: String,
    enum: ['REMINDED','AWAITING_APPROVAL','BOOKED','SKIPPED','NO_SLOT','PAYMENT_FAILED','COMPLETED'],
    required: true },
  booking:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  reason:   String,
  shiftedTo: Date,
}, { timestamps: true });
schema.index({ subscription: 1, scheduledFor: -1 });
export default mongoose.model('SubscriptionOccurrence', schema);
```

- [ ] **Step 3: Slot intelligence helper**

```js
// services/_shared/slotIntelligence.js
import Lab from '../../models/lab.js';
import Booking from '../../models/booking.js';
import { weekdayName, addMinutes } from './slotTime.js';

export const findSlot = async ({ labId, date, windowStart, windowEnd }) => {
  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    const day = new Date(date);
    day.setDate(day.getDate() + dayOffset);
    const lab = await Lab.findById(labId);
    const hours = lab.openingHours?.[weekdayName(day)];
    if (!hours || hours.isClosed) continue;
    const dur = lab.slotMatrix?.duration || 30;
    const step = lab.slotMatrix?.intervalMinutes || 30;
    const maxPerSlot = lab.slotMatrix?.maxBookingsPerSlot || 5;
    const winStart = dayOffset === 0 ? windowStart : hours.open;
    const winEnd = dayOffset === 0 ? windowEnd : hours.close;
    const startOfDay = new Date(day); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const existing = await Booking.find({
      lab: labId, scheduledDate: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ['PENDING','CONFIRMED','COLLECTED','PROCESSING'] },
    });
    const [winSH, winSM] = winStart.split(':').map(Number);
    const [winEH, winEM] = winEnd.split(':').map(Number);
    let cur = winSH * 60 + winSM;
    const end = winEH * 60 + winEM;
    while (cur + dur <= end) {
      const pad = (n) => String(n).padStart(2, '0');
      const slotStart = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`;
      const booked = existing.filter((b) => b.slot?.start === slotStart).length;
      if (booked < maxPerSlot) return { date: day, slot: { start: slotStart, end: addMinutes(slotStart, dur) }, shifted: dayOffset !== 0 };
      cur += step;
    }
  }
  return null;
};
```

- [ ] **Step 4: Replace `scheduler/jobs/subscriptionsJob.js`**

```js
import Subscription from '../../models/subscription.js';
import SubscriptionOccurrence from '../../models/subscriptionOccurrence.js';
import Booking from '../../models/booking.js';
import { reserveSlot } from '../../services/slotCapacityService.js';
import { generateCode } from '../../services/bookingCodeService.js';
import { findSlot } from '../../services/_shared/slotIntelligence.js';
import { nextBookingDate } from '../../services/subscriptionService.js';
import { notify } from '../../services/notificationService.js';

const REMINDER_LOOKAHEAD = 7 * 24 * 3600 * 1000;
const APPROVAL_WINDOW    = 48 * 3600 * 1000;

export const runSubscriptionsJob = async ({ now = new Date(), log } = {}) => {
  // Reminders: subs whose next occurrence is within reminderDays.
  const subs = await Subscription.find({ status: 'ACTIVE',
    nextBookingDate: { $lte: new Date(now.getTime() + REMINDER_LOOKAHEAD) } });

  for (const sub of subs) {
    if (sub.pauseUntil && sub.pauseUntil > now) continue;
    const dueIn = (sub.nextBookingDate - now) / (24 * 3600 * 1000);
    if (dueIn > sub.preBookingReminderDays) continue;
    // Idempotency: skip if we already have an occurrence row for this date.
    const exists = await SubscriptionOccurrence.findOne({
      subscription: sub._id,
      scheduledFor: { $gte: new Date(sub.nextBookingDate.getTime() - 12 * 3600 * 1000),
                      $lte: new Date(sub.nextBookingDate.getTime() + 12 * 3600 * 1000) },
    });
    if (exists) continue;

    if (sub.approvalMode === 'APPROVE_EACH_TIME') {
      await SubscriptionOccurrence.create({ subscription: sub._id, scheduledFor: sub.nextBookingDate,
        state: 'AWAITING_APPROVAL' });
      await notify({ userId: sub.user, event: 'SUBSCRIPTION_AWAITING_APPROVAL',
        title: 'Your subscription needs approval',
        body: `Tap to confirm your next booking on ${sub.nextBookingDate.toDateString()}.`,
        data: { subscriptionId: sub._id.toString() } });
    } else {
      const found = await findSlot({ labId: sub.lab, date: sub.nextBookingDate,
        windowStart: sub.preferredTimeWindow?.start || '09:00',
        windowEnd:   sub.preferredTimeWindow?.end   || '18:00' });
      if (!found) {
        await SubscriptionOccurrence.create({ subscription: sub._id, scheduledFor: sub.nextBookingDate,
          state: 'NO_SLOT' });
        await notify({ userId: sub.user, event: 'SUBSCRIPTION_NO_SLOT',
          title: 'No slot for your recurring test', body: 'Open the app to book manually.' });
      } else {
        await reserveSlot({ labId: sub.lab, scheduledDate: found.date, slotStart: found.slot.start,
          maxPerSlot: 5 });
        const code = await generateCode();
        const booking = await Booking.create({
          user: sub.user, lab: sub.lab, tests: [sub.test], subscription: sub._id,
          scheduledDate: found.date, slot: found.slot, status: 'PENDING',
          collectionType: sub.collectionType, totalAmount: 0, code,
          idempotencyKey: `sub_${sub._id}_${found.date.toISOString().slice(0,10)}`,
        });
        await SubscriptionOccurrence.create({ subscription: sub._id, scheduledFor: sub.nextBookingDate,
          state: 'BOOKED', booking: booking._id, shiftedTo: found.shifted ? found.date : undefined });
        sub.nextBookingDate = nextBookingDate(sub.nextBookingDate, sub.frequency, sub.customIntervalDays);
        sub.lastRunAt = now;
        await sub.save();
      }
    }
  }

  // Expire stale AWAITING_APPROVAL rows.
  const stale = await SubscriptionOccurrence.find({ state: 'AWAITING_APPROVAL',
    createdAt: { $lte: new Date(now.getTime() - APPROVAL_WINDOW) } });
  for (const s of stale) { s.state = 'SKIPPED'; s.reason = 'Approval window elapsed'; await s.save(); }

  log?.info('subscriptionsJob cycle complete');
};
```

- [ ] **Step 5: New service methods + routes**

```js
// services/subscriptionService.js — add:
import SubscriptionOccurrence from '../models/subscriptionOccurrence.js';

export const approveOccurrence = async ({ userId, occurrenceId }) => {
  const occ = await SubscriptionOccurrence.findById(occurrenceId).populate('subscription');
  if (!occ || occ.subscription.user.toString() !== userId.toString()) throw Errors.NOT_FOUND('Occurrence');
  if (occ.state !== 'AWAITING_APPROVAL') throw Errors.INVALID_SUBSCRIPTION_STATE('Occurrence is not awaiting approval');
  const sub = occ.subscription;
  const lab = await Lab.findById(sub.lab);
  const found = await findSlot({
    labId: sub.lab,
    date: occ.scheduledFor,
    windowStart: sub.preferredTimeWindow?.start || '09:00',
    windowEnd:   sub.preferredTimeWindow?.end   || '18:00',
  });
  if (!found) {
    occ.state = 'NO_SLOT';
    await occ.save();
    throw Errors.SLOT_UNAVAILABLE('No slot available in your preferred window');
  }
  await reserveSlot({ labId: sub.lab, scheduledDate: found.date, slotStart: found.slot.start,
    maxPerSlot: lab.slotMatrix?.maxBookingsPerSlot || 5 });
  const code = await generateCode();
  const booking = await Booking.create({
    user: sub.user, lab: sub.lab, tests: [sub.test], subscription: sub._id,
    scheduledDate: found.date, slot: found.slot, status: 'PENDING',
    collectionType: sub.collectionType, totalAmount: 0, code,
    idempotencyKey: `sub_${sub._id}_${found.date.toISOString().slice(0,10)}`,
  });
  occ.state = 'BOOKED';
  occ.booking = booking._id;
  occ.shiftedTo = found.shifted ? found.date : undefined;
  await occ.save();
  sub.nextBookingDate = nextBookingDate(sub.nextBookingDate, sub.frequency, sub.customIntervalDays);
  await sub.save();
  return occ;
};

export const skipNextOccurrence = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  await SubscriptionOccurrence.create({ subscription: sub._id, scheduledFor: sub.nextBookingDate,
    state: 'SKIPPED', reason: 'Skipped by user' });
  sub.nextBookingDate = nextBookingDate(sub.nextBookingDate, sub.frequency, sub.customIntervalDays);
  await sub.save();
  return sub;
};

export const pauseUntil = async ({ userId, id, until }) => {
  const sub = await ownedSub(userId, id);
  sub.status = 'PAUSED';
  sub.pauseUntil = new Date(until);
  await sub.save();
  return sub;
};

export const listOccurrences = async ({ userId, id }) => {
  await ownedSub(userId, id);
  return SubscriptionOccurrence.find({ subscription: id }).sort({ createdAt: -1 }).limit(100);
};
```

```js
// routes/subscriptionRoutes.js — add:
fastify.post('/subscriptions/:id/skip-next', auth, skipNext);
fastify.post('/subscriptions/:id/pause-until', { ...auth,
  schema: { body: { type: 'object', required: ['until'],
    properties: { until: { type: 'string', format: 'date' } } } },
}, pauseUntilHandler);
fastify.get('/subscriptions/:id/occurrences', auth, listOccurrences);
fastify.post('/subscription-occurrences/:occId/approve', auth, approveOccurrence);
```

- [ ] **Step 6: Payment-failure auto-pause hook**

In `services/paymentService.handleRazorpayWebhook`, on a failed payment whose transaction has a `subscription` ref:

```js
const sub = await Subscription.findById(tx.subscription);
if (sub) {
  sub.consecutivePaymentFailures = (sub.consecutivePaymentFailures || 0) + 1;
  if (sub.consecutivePaymentFailures >= 2) {
    sub.status = 'PAUSED';
    sub.pauseUntil = null;
    await notify({ userId: sub.user, event: 'SUBSCRIPTION_PAUSED_PAYMENT',
      title: 'Subscription paused', body: 'Two payments failed — your subscription is paused.' });
  }
  await sub.save();
}
```

**Checkpoint:** subscriptions match PRD §6.5 occurrence-by-occurrence semantics. Commit.

---

## Task 30: Sample-collection OTP + masked calling + visit notes (§6.6 FR-1)

**Why (PRD §6.6 FR-1.5):** collection cannot be marked complete without a 4-digit OTP the user reads from the app. PRD §6.6 FR-1.3 requires masked numbers in both directions. PRD §6.6 FR-1.6 stores per-visit notes from the customer ("gate code 4521").

**Files:**
- Modify: `models/booking.js` — `visitOtp`, `visitOtpVerifiedAt`, `visitNotes`
- Create: `services/maskedCallService.js` — abstracts Exotel/Knowlarity; stub for dev
- Add routes:
  - Customer: `POST /api/bookings/:id/visit-notes`, `GET /api/bookings/:id/visit-otp` (returns the 4-digit OTP to the customer in-app)
  - Assistant: `POST /api/assistant/bookings/:id/verify-otp { otp }`, `POST /api/assistant/bookings/:id/start-journey`, `POST /api/assistant/bookings/:id/arrived`
  - Masked call: `POST /api/calls/connect { bookingId, side: 'customer'|'lab' }`

- [ ] **Step 1: Booking model**

```js
visitOtp:           { type: String },
visitOtpVerifiedAt: { type: Date, default: null },
visitNotes:         { type: String, maxlength: 500 },
```

- [ ] **Step 2: Generate visit OTP on `ASSISTANT_ASSIGNED`**

```js
// services/partnerService.js — extend reassignAssistant:
if (!booking.visitOtp) {
  booking.visitOtp = String(crypto.randomInt(1000, 9999));
}
if (booking.status === 'CONFIRMED') booking.status = 'ASSISTANT_ASSIGNED';
await booking.save();
```

- [ ] **Step 3: Assistant service + routes (Lab Assistant role is added in Task 40; create the assistant-flow stub now)**

```js
// services/assistantService.js
import Booking from '../models/booking.js';
import LabAssistant from '../models/labAssistant.js';
import { Errors } from '../common/errors.js';
import { assertTransition } from './_shared/transitions.js';
import { recordEvent } from './_shared/events.js';
import { notifyBookingStatus } from './notificationService.js';

const ownedByAssistant = async (userId, bookingId) => {
  const asst = await LabAssistant.findOne({ user: userId, isActive: true });
  if (!asst) throw Errors.FORBIDDEN();
  const b = await Booking.findOne({ _id: bookingId, labAssistant: asst._id });
  if (!b) throw Errors.BOOKING_NOT_FOUND();
  return { booking: b, assistant: asst };
};

export const startJourney = async ({ userId, bookingId }) => {
  const { booking } = await ownedByAssistant(userId, bookingId);
  assertTransition(booking.status, 'ON_THE_WAY');
  const from = booking.status; booking.status = 'ON_THE_WAY'; await booking.save();
  await recordEvent({ booking, fromStatus: from, toStatus: 'ON_THE_WAY', actorType: 'LAB_ASSISTANT', actorId: userId });
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};

export const markArrived = async ({ userId, bookingId }) => {
  const { booking } = await ownedByAssistant(userId, bookingId);
  assertTransition(booking.status, 'ARRIVED');
  const from = booking.status; booking.status = 'ARRIVED'; await booking.save();
  await recordEvent({ booking, fromStatus: from, toStatus: 'ARRIVED', actorType: 'LAB_ASSISTANT', actorId: userId });
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};

export const verifyVisitOtp = async ({ userId, bookingId, otp }) => {
  const { booking } = await ownedByAssistant(userId, bookingId);
  if (!booking.visitOtp || booking.visitOtp !== otp) throw Errors.UNAUTHORIZED();
  booking.visitOtpVerifiedAt = new Date();
  assertTransition(booking.status, 'COLLECTED');
  booking.status = 'COLLECTED'; await booking.save();
  await recordEvent({ booking, fromStatus: 'ARRIVED', toStatus: 'COLLECTED', actorType: 'LAB_ASSISTANT', actorId: userId,
    reason: 'visit-otp-verified' });
  notifyBookingStatus(booking).catch(() => {});
  return booking;
};
```

- [ ] **Step 4: `services/maskedCallService.js`**

```js
// Provider-agnostic facade. Real impl can call Exotel/Knowlarity APIs.
import { NODE_ENV } from '../config/env.js';
import { Errors } from '../common/errors.js';

const provider = process.env.MASKED_CALL_PROVIDER || (NODE_ENV === 'production' ? null : 'STUB');

export const connect = async ({ bookingId, fromUserId, toUserId }) => {
  if (provider === 'STUB') return { callId: `stub_${bookingId}_${Date.now()}`, virtualNumber: '+910000000000' };
  if (!provider) throw Errors.SERVICE_UNAVAILABLE('Masked calling is not configured for this environment');
  // Real provider call goes here.
  return { callId: 'real_call_id', virtualNumber: '+91...' };
};
```

Add `SERVICE_UNAVAILABLE: (detail) => new DomainError('SERVICE_UNAVAILABLE', 503, detail || 'Service unavailable')` to `common/errors.js`.

- [ ] **Step 5: Routes**

```js
// routes/bookingRoutes.js
fastify.post('/bookings/:id/visit-notes', { ...customerAuth, schema: {
  body: { type: 'object', required: ['notes'], properties: { notes: { type: 'string', maxLength: 500 } } } },
}, setVisitNotes);
fastify.get('/bookings/:id/visit-otp', customerAuth, getVisitOtp); // returns { otp } once status is ASSISTANT_ASSIGNED+

// routes/assistantRoutes.js (new file, registered under /api)
fastify.post('/assistant/bookings/:id/start-journey', assistantAuth, startJourney);
fastify.post('/assistant/bookings/:id/arrived',       assistantAuth, markArrived);
fastify.post('/assistant/bookings/:id/verify-otp', { ...assistantAuth,
  schema: { body: { type: 'object', required: ['otp'], properties: { otp: { type: 'string' } } } } },
  verifyVisitOtp);
fastify.post('/calls/connect', { ...auth, schema: {
  body: { type: 'object', required: ['bookingId', 'side'],
    properties: { bookingId: { type: 'string' }, side: { type: 'string', enum: ['customer','lab'] } } } },
}, connectCall);
```

**Checkpoint:** §6.6's collection-OTP and masked-call requirements are implemented; assistants have a dedicated endpoint surface. Commit.

---

## Task 31: Sample issue → free re-collection (§6.6 edge)

**Why (PRD):** When a lab flags a hemolyzed/insufficient sample, customer must get an apology notification + a free re-collection booking flow.

**Files:**
- Modify: `services/partnerService.js` — `flagSampleIssue({ bookingId, reason })`
- Add route: `POST /api/partner/bookings/:id/sample-issue`
- Modify: `services/bookingService.js` — `createBooking` honors `recollectionOf` (skips charge)

```js
// services/partnerService.js
export const flagSampleIssue = async ({ userId, bookingId, reason }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}/sample-issue`);
  if (!['COLLECTED', 'PROCESSING'].includes(booking.status)) {
    throw Errors.INVALID_BOOKING_TRANSITION(`Cannot flag a ${booking.status} booking`);
  }
  booking.status = 'CANCELLED';
  booking.cancelBy = 'LAB';
  booking.cancelReason = `Sample issue: ${reason}`;
  await booking.save();
  await notify({ userId: booking.user, event: 'SAMPLE_ISSUE',
    title: 'We need to re-collect your sample',
    body: 'Your sample had an issue — we\'ll re-collect at no extra charge.',
    data: { bookingId: booking._id.toString(), recollection: true } });
  return booking;
};
```

`bookingService.createBooking` accepts `recollectionOf: bookingId`. When present, `totalAmount` is set to 0 and the new booking carries `meta.recollectionOf` for analytics.

**Checkpoint:** sample-issue flow ends in a free re-collection. Commit.

---

## Task 32: Reports v2 — per-test partials + replace-with-reason + TAT board (§6.7, §7.6)

**Why (PRD §6.7 FR-6):** multi-test bookings receive partial reports ("2 of 3 ready"). PRD §7.6 FR-4: replace published report with mandatory reason; old version permanently inaccessible. PRD §7.6 FR-5: TAT board for the lab.

**Files:**
- Modify: `models/booking.js` — drop single `report` ref; use `reports: [{ test, report }]` map
- Modify: `models/report.js` — `replacedAt`, `replacedBy`, `replaceReason`, `expectedAt`
- Modify: `services/reportService.js` — `replaceReport`, `getTatBoard`
- Add routes: `PUT /api/partner/bookings/:id/reports/:reportId`, `GET /api/partner/tat-board`

- [ ] **Step 1: Booking + Report changes**

```js
// models/booking.js — replace single `report` with:
reports: [{
  test:   { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
}],

// models/report.js — add:
replacedAt:    { type: Date, default: null },
replacedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
replaceReason: String,
expectedAt:    Date,
isAccessible:  { type: Boolean, default: true },
```

`linkReport` pushes onto `booking.reports[]`, marks status `COMPLETED` only when **every** test in the booking has a report.

- [ ] **Step 2: Replace flow**

```js
export const replaceReport = async ({ userId, oldReportId, uri, checksum, parameters, reason }) => {
  const old = await Report.findById(oldReportId);
  if (!old) throw Errors.NOT_FOUND('Report');
  // Lab ownership check (omitted: same as in partnerService.findOwnedBooking).
  const fresh = await Report.create({
    booking: old.booking, test: old.test,
    file: { uri, storageProvider: 'FIREBASE', checksum },
    parameters: parameters || [], issuedAt: new Date(), isAccessible: true,
  });
  old.isAccessible = false;
  old.replacedAt = new Date();
  old.replacedBy = fresh._id;
  old.replaceReason = reason;
  await old.save();
  await notify({ userId, event: 'REPORT_REPLACED',
    title: 'Report updated', body: `Your previous report was replaced. Reason: ${reason}` });
  return fresh;
};
```

- [ ] **Step 3: TAT board**

```js
export const getTatBoard = async (userId) => {
  const lab = await getOwnedLab(userId);
  const now = new Date();
  const items = await Booking.aggregate([
    { $match: { lab: lab._id, status: 'PROCESSING' } },
    { $lookup: { from: 'tests', localField: 'tests', foreignField: '_id', as: 'testDocs' } },
    { $addFields: { expectedAt: { $add: ['$createdAt',
        { $multiply: [{ $max: '$testDocs.turnaroundHours' }, 3600 * 1000] }] } } },
    { $addFields: {
        dueSoon: { $and: [{ $gt: ['$expectedAt', now] }, { $lt: ['$expectedAt', new Date(now.getTime() + 4 * 3600 * 1000)] }] },
        overdue: { $lt: ['$expectedAt', now] },
    } },
    { $sort: { expectedAt: 1 } },
  ]);
  return { items };
};
```

Add route: `GET /api/partner/tat-board`.

**Checkpoint:** per-test partials, lab-side replace, TAT board live. Commit.

---

## Task 33: Payments v2 — invoice PDF, payment history, refund tracker, partial refund, double-pay reversal (§6.8)

**Why (PRD §6.8):** invoice per payment downloadable as PDF, refund states `Initiated → Processed → Credited`, partial cancellation refund, double-pay auto-reversal.

**Files:**
- Create: `models/invoice.js`, `models/refund.js`
- Create: `services/invoiceService.js` — generates a PDF (use `pdfkit`)
- Modify: `services/paymentService.js` — emit invoice on webhook `payment.captured`; double-pay detection; partial refund API
- Add routes: `GET /api/me/payments`, `GET /api/invoices/:id`, `POST /api/bookings/:id/refund`

- [ ] **Step 1: `models/invoice.js`**

```js
const schema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking:     { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  number:      { type: String, required: true, unique: true },
  lines: [{ description: String, amount: Number, qty: Number }],
  subtotal:    Number,
  tax:         { type: Number, default: 0 },
  discount:    { type: Number, default: 0 },
  total:       Number,
  pdfUri:      String,
}, { timestamps: true });
```

- [ ] **Step 2: `models/refund.js`**

```js
const schema = new mongoose.Schema({
  booking:     { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  amount:      { type: Number, required: true },
  reason:      String,
  state: { type: String, enum: ['INITIATED','PROCESSED','CREDITED','FAILED'], default: 'INITIATED' },
  providerRefundId: String,
  expectedAt:       Date,
}, { timestamps: true });
```

- [ ] **Step 3: Invoice generation**

```js
// services/invoiceService.js
import PDFDocument from 'pdfkit';
import { storage } from '../integrations/storage/storage.js';
import Invoice from '../models/invoice.js';

const next = async () => {
  const last = await Invoice.findOne().sort({ createdAt: -1 });
  const lastN = last ? parseInt(last.number.split('-').pop()) : 0;
  return `LBZ-INV-${new Date().getFullYear()}-${String(lastN + 1).padStart(6, '0')}`;
};

export const generateInvoice = async ({ user, booking, transaction, tests }) => {
  const number = await next();
  const lines = tests.map((t) => ({ description: t.name, amount: t.price, qty: 1 }));
  const subtotal = lines.reduce((s, l) => s + l.amount * l.qty, 0);
  const total = subtotal;
  // Render PDF (kept short — full template lives in a future task).
  const doc = new PDFDocument();
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.fontSize(18).text('Labzy Invoice', { align: 'right' }).moveDown();
  doc.fontSize(11).text(`Invoice: ${number}`).text(`Booking: ${booking.code}`).moveDown();
  for (const l of lines) doc.text(`${l.description} — ₹${l.amount}`);
  doc.moveDown().text(`Total: ₹${total}`);
  doc.end();
  await new Promise((res) => doc.on('end', res));
  const pdfPath = `invoices/${number}.pdf`;
  await storage.uploadBuffer(Buffer.concat(chunks), pdfPath, 'application/pdf');
  return Invoice.create({ user: user._id, booking: booking._id, transaction: transaction._id,
    number, lines, subtotal, total, pdfUri: pdfPath });
};
```

- [ ] **Step 4: Refund + double-pay reversal**

```js
// services/paymentService.js — extend handleRazorpayWebhook:
// 1) Successful capture: emit invoice + check for duplicate.
const dup = await Transaction.findOne({ booking: tx.booking, _id: { $ne: tx._id }, status: 'CAPTURED' });
if (dup) await issueRefund({ transactionId: tx._id, amount: tx.amount, reason: 'duplicate payment' });
else await generateInvoice({ user, booking, transaction: tx, tests });

// services/refundService.js
export const issueRefund = async ({ transactionId, amount, reason }) => {
  const tx = await Transaction.findById(transactionId);
  if (!tx) throw Errors.NOT_FOUND('Transaction');
  // Stub when no real provider key.
  const providerRefundId = process.env.RAZORPAY_KEY_ID
    ? await razorpayRefund(tx.providerPaymentId, amount)
    : `mock_refund_${Date.now()}`;
  return Refund.create({ booking: tx.booking, transaction: tx._id, amount, reason,
    state: 'INITIATED', providerRefundId,
    expectedAt: new Date(Date.now() + 5 * 24 * 3600 * 1000) });
};
```

- [ ] **Step 5: Routes**

```js
fastify.get('/me/payments', auth, listPayments);             // bundles invoices + refunds
fastify.get('/invoices/:id', auth, getInvoice);              // returns signed PDF URL
fastify.post('/bookings/:id/refund', auth, requestRefund);   // partial refund supported via {testIds:[]}
```

**Checkpoint:** §6.8 closed. Commit.

---

## Task 34: Promo codes (§6.8 FR-7)

**Files:**
- Create: `models/promoCode.js` — `{ code, kind: 'PCT'|'FLAT', value, minOrder, maxDiscount, validFrom, validUntil, perUserLimit, totalLimit, usedCount }`
- Create: `services/promoService.js` — `validate(code, user, cart)`; returns `{ discount }` or throws
- Modify: `bookingService.createBooking` — accepts `promoCode`; computes `totalAmount` net of discount; records `appliedPromo` on Booking

```js
// services/promoService.js
export const validate = async ({ code, user, subtotal }) => {
  const p = await PromoCode.findOne({ code: code.toUpperCase() });
  if (!p) throw Errors.PROMO_INVALID('Invalid code');
  const now = new Date();
  if (p.validFrom > now || p.validUntil < now) throw Errors.PROMO_INVALID('Code is expired');
  if (subtotal < (p.minOrder || 0)) throw Errors.PROMO_INVALID(`Minimum order is ₹${p.minOrder}`);
  if (p.totalLimit && p.usedCount >= p.totalLimit) throw Errors.PROMO_INVALID('Code limit reached');
  // Per-user limit (count past bookings with this code).
  const usedByUser = await Booking.countDocuments({ user: user._id, 'appliedPromo.code': p.code });
  if (p.perUserLimit && usedByUser >= p.perUserLimit) throw Errors.PROMO_INVALID('You have used this code');
  const raw = p.kind === 'PCT' ? Math.floor((subtotal * p.value) / 100) : p.value;
  return { discount: Math.min(raw, p.maxDiscount || raw), promo: p };
};
```

Add `PROMO_INVALID: (detail) => new DomainError('PROMO_INVALID', 400, detail || 'Invalid promo code')`.

**Checkpoint:** promo flow works. Commit.

---

## Task 35: Notification preferences + quiet hours + SMS fallback (§6.10)

**Why (PRD §6.10):** critical (non-disablable) vs configurable categories; quiet hours 10pm-7am for non-critical; channels: push (primary), SMS fallback when push fails, email for invoices/reports.

**Files:**
- Modify: `models/user.js` — `notificationPreferences`
- Create: `services/smsService.js` — provider abstraction (same shape as `otpService`)
- Modify: `services/notificationService.js` — gate by category + quiet hours; fallback to SMS for critical when push unavailable

```js
// models/user.js — append:
notificationPreferences: {
  promotions:                { type: Boolean, default: false },
  preBookingReminderEnabled: { type: Boolean, default: true },
  preparationReminders:      { type: Boolean, default: true },
  ratingPrompts:             { type: Boolean, default: true },
  channelsByCategory: {
    CRITICAL: { push: { type: Boolean, default: true }, sms: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    OPTIONAL: { push: { type: Boolean, default: true }, sms: { type: Boolean, default: false }, email: { type: Boolean, default: false } },
  },
  quietHours: { start: { type: String, default: '22:00' }, end: { type: String, default: '07:00' } },
},
```

```js
// services/notificationService.js — within notify():
const isCritical = ['BOOKING_STATUS','PAYMENT_SUCCESS','PAYMENT_FAILED','REPORT_READY',
                    'SUBSCRIPTION_AWAITING_APPROVAL','VISIT_OTP_REQUIRED'].includes(event);
const u = await User.findById(userId).select('notificationPreferences fcmToken phone email');

if (!isCritical) {
  const { start, end } = u.notificationPreferences?.quietHours || {};
  if (inQuietHours(new Date(), start, end)) {
    return Notification.create({ user: userId, event, title, body, data, deliveredAt: null });
  }
}
const cat = isCritical ? 'CRITICAL' : 'OPTIONAL';
const ch = u.notificationPreferences?.channelsByCategory?.[cat] || {};
const doc = await Notification.create({ user: userId, event, title, body, data });
broadcast(userId, { id: doc._id.toString(), event, title, body, data, at: new Date().toISOString() });
if (ch.push !== false) await sendPush(userId, title, body, data);
if (isCritical && ch.sms && u.phone) await sendSms(u.phone, `${title}: ${body}`);
return doc;
```

Add route: `PUT /api/me/notification-preferences`.

**Checkpoint:** quiet hours + critical-vs-optional gating. Commit.

---

## Task 36: Reviews v2 — sub-ratings + lab reply + moderation + abuse report (§6.11)

**Why (PRD §6.11):** sub-ratings (assistant, timeliness, TAT), lab can post one public reply per review, abuse moderation (profanity + PII), report-inappropriate flow.

**Files:**
- Modify: `models/review.js` — `subRatings`, `reply`, `moderationStatus`, `reportedBy`
- Modify: `services/reviewService.js` — `replyToReview`, `flagReview`
- Create: `services/_shared/moderation.js` — basic profanity + phone-number regex

```js
// models/review.js — append:
subRatings: {
  assistant:  { type: Number, min: 1, max: 5 },
  timeliness: { type: Number, min: 1, max: 5 },
  tat:        { type: Number, min: 1, max: 5 },
},
reply: {
  text:      String,
  repliedAt: Date,
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
},
moderationStatus: { type: String, enum: ['PENDING','APPROVED','REJECTED'], default: 'PENDING' },
reportedBy:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
```

```js
// services/_shared/moderation.js
const PROFANITY = [/* curated list */];
const PII_PATTERNS = [/\b\d{10}\b/, /\b[\w.+-]+@[\w-]+\.[a-z]+\b/i];
export const moderate = (text) => {
  if (!text) return { ok: true };
  for (const p of PROFANITY) if (p.test(text)) return { ok: false, reason: 'profanity' };
  for (const p of PII_PATTERNS) if (p.test(text)) return { ok: false, reason: 'personal-info' };
  return { ok: true };
};
```

`reviewService.createReview` runs `moderate(comment)`. If `ok === false` → `moderationStatus = 'REJECTED'`, do not include in lab rating recompute.

Add routes:
- `POST /api/labs/:id/reviews/:reviewId/reply` (LAB_OWNER)
- `POST /api/reviews/:id/report { reason }` (CUSTOMER)

**Checkpoint:** §6.11 closed. Commit.

---

## Task 37: Help & support tickets (§6.12)

**Files:**
- Create: `models/ticket.js`
- Create: `services/ticketService.js`
- Add routes:
  - `POST /api/tickets`
  - `GET /api/tickets`
  - `GET /api/tickets/:id`
  - `POST /api/tickets/:id/messages`
  - `POST /api/tickets/:id/reopen`

```js
// models/ticket.js
const schema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  booking:     { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  category: { type: String, required: true,
    enum: ['DELAY','REFUND','REPORT_ISSUE','ASSISTANT_BEHAVIOR','PAYMENT','SAFETY','OTHER'] },
  priority:    { type: String, enum: ['NORMAL','HIGH'], default: 'NORMAL' },
  state:       { type: String, enum: ['OPEN','IN_PROGRESS','RESOLVED'], default: 'OPEN' },
  subject:     { type: String, required: true },
  messages: [{
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromRole:   { type: String, enum: ['CUSTOMER','SUPPORT'], required: true },
    text:       String,
    attachments:[{ uri: String }],
    createdAt:  { type: Date, default: Date.now },
  }],
  resolutionNote: String,
  resolvedAt:     Date,
}, { timestamps: true });
```

`createTicket` auto-flags `priority='HIGH'` when category is `REFUND`, `REPORT_ISSUE`, `SAFETY`, or `PAYMENT` (PRD §6.12 FR-4). Reopen allowed within 7 days of `resolvedAt`.

**Checkpoint:** support flow live. Commit.

---

## Task 38: Lab documents + verification gate + vacation mode + multi-branch (§7.1)

**Why (PRD §7.1):** labs only become discoverable after documents are verified; certification badges map 1:1 to verified documents; expiry auto-removes badges; vacation mode pauses new bookings.

**Files:**
- Create: `models/labDocument.js`
- Modify: `models/lab.js` — `state` enum (`DRAFT/UNDER_REVIEW/LIVE/PAUSED/SUSPENDED`), `parentLab` (multi-branch)
- Modify: `services/labCatalogService.js` — only show `state==='LIVE'` and `state!=='PAUSED'`
- Create: `scheduler/jobs/docExpiryJob.js` — notify 30/7/1 days before, then drop badge
- Add routes: `POST /api/partner/lab/documents`, `GET /api/partner/lab/documents`, `POST /api/partner/lab/vacation`, `POST /api/partner/branches`

```js
// models/labDocument.js
const schema = new mongoose.Schema({
  lab:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true, index: true },
  kind:       { type: String, enum: ['REGISTRATION','NABL','ID_PROOF','OTHER'], required: true },
  file:       { uri: String, checksum: String },
  state:      { type: String, enum: ['SUBMITTED','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED'], default: 'SUBMITTED' },
  rejectionReason: String,
  verifiedAt: Date,
  expiresAt:  Date,
}, { timestamps: true });
schema.index({ lab: 1, state: 1 });
```

```js
// models/lab.js — append:
state: { type: String, enum: ['DRAFT','UNDER_REVIEW','LIVE','PAUSED','SUSPENDED'], default: 'DRAFT' },
parentLab: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', default: null },
vacationRange: { from: Date, to: Date },
```

Catalog filter: `Lab.find({ state: 'LIVE', ... })` (plus vacation check before serving slots).

```js
// scheduler/jobs/docExpiryJob.js
import LabDocument from '../../models/labDocument.js';
import { notify } from '../../services/notificationService.js';

export const runDocExpiry = async ({ now = new Date() } = {}) => {
  const docs = await LabDocument.find({ state: 'VERIFIED', expiresAt: { $lte: new Date(now.getTime() + 30 * 24 * 3600 * 1000) } })
    .populate({ path: 'lab', populate: { path: 'owner', select: '_id' } });
  for (const d of docs) {
    const daysLeft = Math.ceil((d.expiresAt - now) / (24 * 3600 * 1000));
    if (daysLeft <= 0) {
      d.state = 'EXPIRED'; await d.save();
      await notify({ userId: d.lab.owner._id, event: 'CERT_EXPIRED',
        title: 'Certification expired', body: `${d.kind} expired — re-upload to keep your badge.` });
    } else if ([30, 7, 1].includes(daysLeft)) {
      await notify({ userId: d.lab.owner._id, event: 'CERT_EXPIRING',
        title: `Certification expires in ${daysLeft} days`, body: `${d.kind} expires soon.` });
    }
  }
};
```

`POST /api/partner/lab/vacation { from, to }` toggles `vacationRange` and `state='PAUSED'` for that range.

**Checkpoint:** verification gate + multi-branch + vacation. Commit.

---

## Task 39: Master test directory + test publish states + slot capacity per mode + blackout dates (§7.2)

**Files:**
- Create: `models/masterTest.js` — canonical names/sample types/descriptions Labzy curates
- Modify: `models/test.js` — add `state` enum (`DRAFT/PUBLISHED/TEMP_UNAVAILABLE/DISCONTINUED`), `masterTestId`, `homeAvailable`, `inLabAvailable`
- Modify: `models/lab.js` — `slotMatrix` becomes `slotMatrixByMode: { HOME, IN_LAB }` and `blackoutDates: [Date]`
- Modify: `services/labCatalogService.computeLabSlots` — accept `mode` param

```js
// models/masterTest.js
const schema = new mongoose.Schema({
  name:                     { type: String, required: true, unique: true },
  category:                 String,
  sampleType:               { type: String, enum: ['Blood','Urine','Stool','Swab','Imaging','Other'] },
  plainLanguageDescription: String,
  defaultPreparation:       String,
  defaultFastingHours:      { type: Number, default: 0 },
}, { timestamps: true });
```

```js
// models/test.js — extend:
state:        { type: String, enum: ['DRAFT','PUBLISHED','TEMP_UNAVAILABLE','DISCONTINUED'], default: 'DRAFT' },
masterTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterTest' },
homeAvailable:  { type: Boolean, default: true },
inLabAvailable: { type: Boolean, default: true },
```

Publish guard in service:
```js
export const publishTest = async ({ testId }) => {
  const t = await Test.findById(testId);
  if (!t) throw Errors.NOT_FOUND('Test');
  if (!t.price || !t.turnaroundHours || (!t.homeAvailable && !t.inLabAvailable)) {
    throw Errors.VALIDATION_ERROR('Cannot publish: missing price, TAT, or mode availability');
  }
  t.state = 'PUBLISHED';
  await t.save();
  return t;
};
```

`computeLabSlots({ labId, date, mode })` — pick `lab.slotMatrixByMode[mode]` and `blackoutDates`.

**Checkpoint:** catalog matches §7.2. Commit.

---

## Task 40: Staff roles — Lab Manager + Lab Assistant login + assistant day view + metrics (§7.4)

**Why (PRD §7.4):** Lab Manager + Lab Assistant roles, assistants see only their own day, owners see per-assistant metrics. **Auth method override:** PRD specifies mobile + OTP login for staff; we use email + password instead (see auth-policy note at the top of Phase 3). Owners create staff accounts with email + password via a partner-side endpoint.

**Files:**
- Modify: `middlewares/rbacMiddleware.js` — already supports multiple roles
- Modify: `models/user.js` — add `LAB_MANAGER` to the `roles` enum
- Modify: `models/labAssistant.js` — `photoUrl`, `idVerifiedAt`
- Modify: `services/assistantService.js` (created Task 30) — add `getMyDay({ userId })`
- Modify: `services/partnerService.js` — `createStaffUser`, `getAssistantMetrics`
- Add routes:
  - `POST /api/partner/staff` (owner creates a Lab Manager or Lab Assistant user with email + password)
  - `GET /api/assistant/day`
  - `GET /api/partner/assistants/:id/metrics`

- [ ] **Step 0: Staff account creation (email+password, owner-issued)**

```js
// services/partnerService.js
import bcrypt from 'bcryptjs';
import LabAssistant from '../models/labAssistant.js';

export const createStaffUser = async ({ userId: ownerId, name, email, password, phone, role, photoUrl }) => {
  const lab = await getOwnedLab(ownerId);
  if (!['LAB_MANAGER', 'LAB_ASSISTANT'].includes(role)) {
    throw Errors.VALIDATION_ERROR('Role must be LAB_MANAGER or LAB_ASSISTANT');
  }
  if (await User.findOne({ email })) throw Errors.CONFLICT('Email already in use');
  const passwordHash = await bcrypt.hash(password, 12);
  const staff = await User.create({ name, email, passwordHash, phone, roles: [role] });
  if (role === 'LAB_ASSISTANT') {
    if (!photoUrl) throw Errors.VALIDATION_ERROR('Assistant photo is required'); // PRD §7.4 FR-2
    await LabAssistant.create({ lab: lab._id, user: staff._id, name, phone, photoUrl, isActive: true });
  }
  return { id: staff._id, name: staff.name, email: staff.email, role };
};
```

```js
// routes/partnerRoutes.js
fastify.post('/partner/staff', {
  ...ownerAuth,
  schema: {
    body: { type: 'object', required: ['name', 'email', 'password', 'role'],
      properties: {
        name:     { type: 'string', minLength: 2 },
        email:    { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 },
        phone:    { type: 'string' },
        role:     { type: 'string', enum: ['LAB_MANAGER', 'LAB_ASSISTANT'] },
        photoUrl: { type: 'string' },
      }, additionalProperties: false },
  },
}, createStaff);
```

```js
// services/assistantService.js
export const getMyDay = async ({ userId }) => {
  const asst = await LabAssistant.findOne({ user: userId, isActive: true });
  if (!asst) throw Errors.FORBIDDEN();
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  return Booking.find({ labAssistant: asst._id,
    scheduledDate: { $gte: today, $lt: tomorrow },
    status: { $in: ['ASSISTANT_ASSIGNED','ON_THE_WAY','ARRIVED','COLLECTED'] } })
    .populate('user', 'name phone')
    .populate('tests', 'name')
    .sort({ 'slot.start': 1 });
};

// services/partnerService.js
export const getAssistantMetrics = async ({ userId, assistantId }) => {
  const lab = await getOwnedLab(userId);
  const asst = await LabAssistant.findOne({ _id: assistantId, lab: lab._id });
  if (!asst) throw Errors.NOT_FOUND('Assistant');
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [completed, onTime, otpFailed, noShows] = await Promise.all([
    Booking.countDocuments({ labAssistant: asst._id, status: 'COMPLETED', createdAt: { $gte: since } }),
    Booking.countDocuments({ labAssistant: asst._id, status: 'COLLECTED', visitOtpVerifiedAt: { $ne: null }, createdAt: { $gte: since } }),
    Booking.countDocuments({ labAssistant: asst._id, status: { $in: ['ARRIVED'] }, visitOtpVerifiedAt: null, createdAt: { $gte: since } }),
    Booking.countDocuments({ labAssistant: asst._id, status: 'NO_SHOW', createdAt: { $gte: since } }),
  ]);
  return { completed, onTime, otpFailed, noShows };
};
```

**Checkpoint:** staff roles + metrics. Commit.

---

## Task 41: Lab-scoped customer history + staff notes (§7.5)

**Files:**
- Create: `models/labCustomerNote.js` — `{ lab, customer, note, createdBy }`
- Modify: `services/partnerService.getCustomerHistory` — scope strictly to caller's lab and attach notes
- Add routes: `POST /api/partner/customers/:customerId/notes`, `DELETE /api/partner/customers/:customerId/notes/:id`

```js
// models/labCustomerNote.js
const schema = new mongoose.Schema({
  lab:       { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true, index: true },
  customer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  note:      { type: String, required: true, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ lab: 1, customer: 1, createdAt: -1 });
```

Existing `getCustomerHistory` already filters by `lab: lab._id` — that satisfies PRD's cross-lab privacy clause. This task only adds the notes overlay.

**Checkpoint:** PRD §7.5 closed. Commit.

---

## Task 42: Analytics v2 — acceptance / no-show / TAT compliance / peak heatmap / quality panel (§7.8)

**Why (PRD §7.8):** existing analytics (Phase 1 Task 7) only cover totals + revenue. PRD wants acceptance rate, no-show rate, TAT compliance %, peak-hours heatmap, quality panel (rating trend + reviews feed with reply action).

**Files:**
- Modify: `services/partnerService.js` — `getAnalyticsOverview` returns the additional metrics
- Modify: `services/partnerService.js` — new `getQualityPanel`, `getHeatmap`
- Add routes: `GET /api/partner/analytics/heatmap`, `GET /api/partner/analytics/quality`

```js
export const getAnalyticsOverview = async (userId) => {
  const lab = await getOwnedLab(userId);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [total, accepted, completed, cancelled, noShows, revenue, tatHits, tatMisses] = await Promise.all([
    Booking.countDocuments({ lab: lab._id, createdAt: { $gte: since } }),
    Booking.countDocuments({ lab: lab._id, status: { $in: ['CONFIRMED','COLLECTED','PROCESSING','COMPLETED'] }, createdAt: { $gte: since } }),
    Booking.countDocuments({ lab: lab._id, status: 'COMPLETED', createdAt: { $gte: since } }),
    Booking.countDocuments({ lab: lab._id, status: 'CANCELLED', createdAt: { $gte: since } }),
    Booking.countDocuments({ lab: lab._id, status: 'NO_SHOW', createdAt: { $gte: since } }),
    Booking.aggregate([
      { $match: { lab: lab._id, status: 'COMPLETED', createdAt: { $gte: since } } },
      { $group: { _id: null, gross: { $sum: '$totalAmount' } } },
    ]),
    // TAT hit / miss via aggregation: compare report.issuedAt − booking.createdAt to max(test.turnaroundHours).
    Report.aggregate([
      { $lookup: { from: 'bookings', localField: 'booking', foreignField: '_id', as: 'b' } },
      { $unwind: '$b' },
      { $match: { 'b.lab': lab._id, 'b.createdAt': { $gte: since } } },
      { $lookup: { from: 'tests', localField: 'b.tests', foreignField: '_id', as: 'tDocs' } },
      { $addFields: {
          expectedAt: { $add: ['$b.createdAt',
            { $multiply: [{ $max: '$tDocs.turnaroundHours' }, 3600 * 1000] }] },
      } },
      { $group: { _id: null,
          hit:  { $sum: { $cond: [{ $lte: ['$issuedAt', '$expectedAt'] }, 1, 0] } },
          miss: { $sum: { $cond: [{ $gt:  ['$issuedAt', '$expectedAt'] }, 1, 0] } },
      } },
    ]).then((r) => r[0]?.hit  || 0),
    Report.aggregate([
      { $lookup: { from: 'bookings', localField: 'booking', foreignField: '_id', as: 'b' } },
      { $unwind: '$b' },
      { $match: { 'b.lab': lab._id, 'b.createdAt': { $gte: since } } },
      { $lookup: { from: 'tests', localField: 'b.tests', foreignField: '_id', as: 'tDocs' } },
      { $addFields: {
          expectedAt: { $add: ['$b.createdAt',
            { $multiply: [{ $max: '$tDocs.turnaroundHours' }, 3600 * 1000] }] },
      } },
      { $group: { _id: null,
          miss: { $sum: { $cond: [{ $gt: ['$issuedAt', '$expectedAt'] }, 1, 0] } },
      } },
    ]).then((r) => r[0]?.miss || 0),
  ]);
  return {
    bookings: { total, accepted, completed, cancelled, noShows },
    revenue: { gross: revenue[0]?.gross || 0 },
    rates: {
      acceptanceRate: total ? accepted / total : 0,
      noShowRate:     total ? noShows  / total : 0,
      tatCompliance:  (tatHits + tatMisses) ? tatHits / (tatHits + tatMisses) : 1,
    },
  };
};

export const getHeatmap = async (userId) => {
  const lab = await getOwnedLab(userId);
  return Booking.aggregate([
    { $match: { lab: lab._id, status: { $in: ['COMPLETED','CONFIRMED'] } } },
    { $group: { _id: { weekday: { $dayOfWeek: '$scheduledDate' }, hour: { $substrBytes: ['$slot.start', 0, 2] } },
                count: { $sum: 1 } } },
  ]);
};
```

**Checkpoint:** PRD §7.8 metrics live. Commit.

---

## Task 43: Earnings, settlements, disputes (§7.9)

**Files:**
- Create: `models/settlement.js`, `models/settlementLine.js`, `models/settlementDispute.js`
- Create: `services/settlementService.js` — `accrueLine(booking)`, `runSettlementCycle(lab)`, `raiseDispute`, `listEarnings`
- Add routes: `GET /api/partner/earnings`, `GET /api/partner/settlements/:id`, `POST /api/partner/settlements/:lineId/dispute`

```js
// models/settlement.js
const schema = new mongoose.Schema({
  lab:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true, index: true },
  cycleStart: Date,
  cycleEnd:   Date,
  state:      { type: String, enum: ['ACCRUED','INITIATED','PAID'], default: 'ACCRUED' },
  total:      Number,
  payoutRef:  String,
}, { timestamps: true });

// models/settlementLine.js
const schema2 = new mongoose.Schema({
  settlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', required: true, index: true },
  booking:    { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  testAmount:    Number,
  collectionFee: Number,
  commission:    Number,
  refunds:       Number,
  payout:        Number,
}, { timestamps: true });
```

`accrueLine` runs when booking reaches `COMPLETED`. `runSettlementCycle` rolls up the current cycle and flips state. Dispute = create row + freeze the line until resolved.

**Checkpoint:** §7.9 closed. Commit.

---

## Task 44: Data export + consent center + i18n strings (§6.9, §8.1, §8.3)

**Why (PRD §8.1 FR-5):** customer can request a complete export of their data; PRD §6.9 FR-5 consent center; PRD §8.3 Hindi+English.

**Files:**
- Create: `services/dataExportService.js` — produces a ZIP of all user data
- Create: `models/dataExportJob.js`
- Modify: `services/profileService.js` — `requestExport`, `withdrawConsent`
- Add routes: `POST /api/me/exports`, `GET /api/me/exports/:id`, `POST /api/me/consents/withdraw`
- Create: `services/i18nService.js` + AppContent rows `i18n_en` and `i18n_hi`

```js
// services/dataExportService.js
import archiver from 'archiver';
import { storage } from '../integrations/storage/storage.js';
import DataExportJob from '../models/dataExportJob.js';

export const requestExport = async ({ userId }) => {
  const job = await DataExportJob.create({ user: userId, state: 'QUEUED' });
  // Kick off async (run inside scheduler tick or worker).
  return job;
};

export const runExport = async (job) => {
  const [user, bookings, reports, invoices, refunds, notifications] = await Promise.all([
    User.findById(job.user).select('-passwordHash -refreshToken'),
    Booking.find({ user: job.user }),
    Report.find({ booking: { $in: (await Booking.find({ user: job.user }).select('_id')).map((b) => b._id) } }),
    Invoice.find({ user: job.user }),
    Refund.find({ /* via transactions */ }),
    Notification.find({ user: job.user }),
  ]);
  const buf = await renderZip({ user, bookings, reports, invoices, refunds, notifications });
  const path = `exports/${job.user}/${job._id}.zip`;
  await storage.uploadBuffer(buf, path, 'application/zip');
  job.state = 'READY'; job.fileUri = path; await job.save();
  return job;
};

const renderZip = (payload) => new Promise((resolve, reject) => {
  const archive = archiver('zip');
  const chunks = [];
  archive.on('data', (c) => chunks.push(c));
  archive.on('end', () => resolve(Buffer.concat(chunks)));
  archive.on('error', reject);
  archive.append(JSON.stringify(payload, null, 2), { name: 'labzy-data.json' });
  archive.finalize();
});
```

```js
// services/i18nService.js
import { getContent } from './contentService.js';
const cache = new Map();
export const t = async (lang, key, fallback) => {
  if (!cache.has(lang)) cache.set(lang, await getContent(`i18n_${lang}`).catch(() => ({ payload: {} })));
  return cache.get(lang).payload?.[key] || fallback || key;
};
```

Add `Accept-Language` middleware that sets `request.lang` for any controller that wants to localise messages.

**Checkpoint:** PRD §6.9, §8.1, §8.3 closed. Commit.

---

## Task 45: Partner notifications v2 — assistant visit reminder + owner daily digest (§7.7)

**Why (PRD §7.7):** §7.7 FR-2 — assistants get "upcoming visit reminder (60 min before window)". §7.7 FR-3 — owner/manager configurable "daily morning summary + end-of-day recap".

**Files:**
- Create: `scheduler/jobs/assistantReminderJob.js`
- Create: `scheduler/jobs/partnerDigestJob.js`
- Modify: `models/user.js` — add `partnerDigestPreferences` for LAB_OWNER/LAB_MANAGER users
- Register both intervals in `scheduler/index.js`

- [ ] **Step 1: Assistant reminder job**

```js
// scheduler/jobs/assistantReminderJob.js
import Booking from '../../models/booking.js';
import LabAssistant from '../../models/labAssistant.js';
import { notify } from '../../services/notificationService.js';

const WINDOW_MS = 60 * 60 * 1000;     // 60-min ahead
const TOLERANCE_MS = 10 * 60 * 1000;  // ±10 min so we don't double-fire

export const runAssistantReminders = async ({ now = new Date(), log } = {}) => {
  const from = new Date(now.getTime() + WINDOW_MS - TOLERANCE_MS);
  const to   = new Date(now.getTime() + WINDOW_MS + TOLERANCE_MS);
  // Match bookings whose slot.start time today falls in the [from,to] window.
  const todays = await Booking.find({
    status: { $in: ['ASSISTANT_ASSIGNED', 'CONFIRMED'] },
    labAssistant: { $ne: null },
    scheduledDate: {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      $lt:  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    },
  }).populate('labAssistant');
  let sent = 0;
  for (const b of todays) {
    const [hh, mm] = b.slot.start.split(':').map(Number);
    const slotMoment = new Date(b.scheduledDate);
    slotMoment.setHours(hh, mm, 0, 0);
    if (slotMoment < from || slotMoment > to) continue;
    const assistant = await LabAssistant.findById(b.labAssistant).populate('user');
    if (!assistant?.user) continue;
    await notify({
      userId: assistant.user._id,
      event: 'ASSISTANT_VISIT_REMINDER',
      title: `Visit at ${b.slot.start}`,
      body: `Upcoming home collection — leave soon.`,
      data: { bookingId: b._id.toString() },
    });
    sent += 1;
  }
  log?.info({ sent }, 'Assistant reminders sent');
  return sent;
};
```

- [ ] **Step 2: Partner digest job**

```js
// scheduler/jobs/partnerDigestJob.js
import User from '../../models/user.js';
import Lab from '../../models/lab.js';
import Booking from '../../models/booking.js';
import { notify } from '../../services/notificationService.js';

export const runMorningDigest = async ({ now = new Date(), log } = {}) => {
  const owners = await User.find({
    roles: { $in: ['LAB_OWNER', 'LAB_MANAGER'] },
    'partnerDigestPreferences.morning': true,
  });
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  let sent = 0;
  for (const owner of owners) {
    const labs = await Lab.find({ owner: owner._id }).select('_id name');
    for (const lab of labs) {
      const [total, pending, expectedRevenue] = await Promise.all([
        Booking.countDocuments({ lab: lab._id, scheduledDate: { $gte: today, $lt: tomorrow } }),
        Booking.countDocuments({ lab: lab._id, status: 'PENDING' }),
        Booking.aggregate([
          { $match: { lab: lab._id, scheduledDate: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]).then((r) => r[0]?.total || 0),
      ]);
      await notify({
        userId: owner._id,
        event: 'PARTNER_MORNING_DIGEST',
        title: `${lab.name} — today's plan`,
        body: `${total} bookings, ${pending} pending action, ₹${expectedRevenue} expected.`,
        data: { labId: lab._id.toString() },
      });
      sent += 1;
    }
  }
  log?.info({ sent }, 'Morning digest sent');
  return sent;
};

export const runEveningDigest = async ({ now = new Date(), log } = {}) => {
  const owners = await User.find({
    roles: { $in: ['LAB_OWNER', 'LAB_MANAGER'] },
    'partnerDigestPreferences.evening': true,
  });
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  let sent = 0;
  for (const owner of owners) {
    const labs = await Lab.find({ owner: owner._id }).select('_id name');
    for (const lab of labs) {
      const [done, cancelled, revenue] = await Promise.all([
        Booking.countDocuments({ lab: lab._id, status: 'COMPLETED', updatedAt: { $gte: today, $lt: tomorrow } }),
        Booking.countDocuments({ lab: lab._id, status: 'CANCELLED', updatedAt: { $gte: today, $lt: tomorrow } }),
        Booking.aggregate([
          { $match: { lab: lab._id, status: 'COMPLETED', updatedAt: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]).then((r) => r[0]?.total || 0),
      ]);
      await notify({
        userId: owner._id,
        event: 'PARTNER_EVENING_DIGEST',
        title: `${lab.name} — day recap`,
        body: `${done} completed, ${cancelled} cancelled, ₹${revenue} earned.`,
        data: { labId: lab._id.toString() },
      });
      sent += 1;
    }
  }
  log?.info({ sent }, 'Evening digest sent');
  return sent;
};
```

- [ ] **Step 3: User model preferences**

```js
// models/user.js — append:
partnerDigestPreferences: {
  morning: { type: Boolean, default: true },
  evening: { type: Boolean, default: true },
},
```

- [ ] **Step 4: Register in `scheduler/index.js`**

```js
import { runAssistantReminders } from './jobs/assistantReminderJob.js';
import { runMorningDigest, runEveningDigest } from './jobs/partnerDigestJob.js';

const TEN_MIN = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

setInterval(() => runAssistantReminders({ now: new Date(), log: app.log })
  .catch((e) => app.log.error({ err: e }, 'assistantReminders failed')), TEN_MIN);

// Cron-style: fire once per day at 7 AM and 9 PM local time. Use a 30-min tick
// guarded by checking the current hour to avoid bringing in a cron lib.
setInterval(() => {
  const h = new Date().getHours();
  if (h === 7)  runMorningDigest({ now: new Date(), log: app.log }).catch((e) => app.log.error({ err: e }, 'morningDigest failed'));
  if (h === 21) runEveningDigest({ now: new Date(), log: app.log }).catch((e) => app.log.error({ err: e }, 'eveningDigest failed'));
}, 30 * 60 * 1000);
```

**Checkpoint:** assistants get a 60-min reminder before each visit; owners/managers can opt in to morning + evening digests. Commit when ready.

---

## Phase 3 Self-Review

- [ ] Customer can register and log in with email + password; signup blocks without TOS+Privacy+Health-records consent (§6.1 FR-2). (Auth-method override: email/password instead of OTP.)
- [ ] Users < 18 cannot create a standalone customer account; they only exist as family members.
- [ ] Lab owners can create LAB_MANAGER and LAB_ASSISTANT user accounts with email + password from `POST /api/partner/staff`; assistant creation requires a photo URL.
- [ ] No user has more than 3 active sessions; logging into a 4th evicts the oldest.
- [ ] `GET /api/me/recent-searches` returns the user's last 20 search interactions.
- [ ] `GET /api/labs/:id` returns `ratingDistribution` plus `photos` and `description`.
- [ ] Every state-changing booking endpoint writes a `BookingEvent` row.
- [ ] Slot hold is 10 minutes (was 15).
- [ ] Cannot reschedule a booking within the lab's `rescheduleCutoffHours`; cannot reschedule more than `maxReschedulesPerBooking` times.
- [ ] PENDING bookings older than the lab's `responseSlaMinutes` are auto-cancelled by the scheduler with `cancelBy='SYSTEM'`.
- [ ] Subscriptions in `APPROVE_EACH_TIME` mode create an `AWAITING_APPROVAL` occurrence and never auto-book.
- [ ] Two consecutive payment failures on a subscription auto-pause it.
- [ ] Sample-collection `COLLECTED` transition requires `visit-otp` verification on home bookings.
- [ ] Lab can flag a sample issue → customer gets a free re-collection booking.
- [ ] Multi-test bookings can carry partial reports; `COMPLETED` fires only when all tests have a report.
- [ ] Replaced reports are flagged `isAccessible=false` and the customer is notified.
- [ ] Every successful capture issues an `Invoice` PDF; duplicate captures auto-refund.
- [ ] Promo code application is validated against `validFrom/Until`, `minOrder`, and per-user / total caps.
- [ ] Non-critical notifications are suppressed during the user's quiet hours; critical notifications always deliver and fall back to SMS when push is disabled.
- [ ] Reviews with profanity or PII are auto-rejected from public listings.
- [ ] Help tickets in REFUND / REPORT_ISSUE / SAFETY / PAYMENT categories are auto-flagged HIGH priority.
- [ ] Labs in `state='DRAFT'`, `'UNDER_REVIEW'`, `'PAUSED'`, or `'SUSPENDED'` are never returned to customer discovery.
- [ ] Tests cannot be `PUBLISHED` without price + TAT + at least one mode available.
- [ ] Each settlement line is traceable to a specific booking with a clear payout calculation.
- [ ] A user can request a ZIP export of all their data and receive a download link when ready.
- [ ] Home-collection bookings carry `homeCollectionFee` line item; fee is waived above the lab's threshold (PRD §6.4 FR-3).
- [ ] Assistants receive a 60-min-before reminder for every assigned visit (PRD §7.7 FR-2).
- [ ] Lab owners/managers receive opt-in morning + evening digests when enabled (PRD §7.7 FR-3).

---

## Phase 3 ordering notes

- Task 23 unblocks 24 (Session model lives next to phone-OTP login).
- Task 27 (state machine v2) must precede 30 (assistant flow) because the new transitions are referenced there.
- Task 32 depends on 27 (per-test reports check booking status).
- Task 33 must precede 34 (promo codes feed into invoice line items).
- Task 38 must precede 39 (test publish guard relies on `lab.state === 'LIVE'` indirectly through discovery).
- Tasks 40 + 41 round out the partner-side scope.
- Tasks 42 + 43 are read-only analytics layered on top of everything earlier.
- Task 44 is independent and can ship any time after the relevant models exist.
- Task 45 depends on Task 30 (assistants must have `labAssistant.user` linked) and Task 35 (preferences gate the digests through `notify()`).
- [ ] `docs/api-integration-for-frontend.md` is in sync with the Phase 2 surface.
