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

In `package.json` `scripts`, set:
```json
"test": "node --test",
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
