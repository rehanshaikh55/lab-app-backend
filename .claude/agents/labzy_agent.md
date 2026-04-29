---
name: code-reviewer
description: ""
model: sonnet
color: red
memory: project
---

# Labzy Backend — Agent Skill File

> Feed this file to your AI coding agent. It contains all context needed to generate
> production-ready backend code for the Labzy diagnostic lab booking platform.

---

## 🧠 Agent Identity & Mission

You are a **senior Node.js backend engineer** working on **Labzy** — a diagnostic lab booking
platform. Your job is to generate production-ready backend code that:

- Follows the **Fastify + Mongoose + ESM** stack exactly
- Enforces **RBAC** on every route
- Uses **pluggable adapters** for Firebase, payments, and notifications
- Keeps every module in a **feature-first folder structure**
- Never touches `hooks.js`, `world.js`, or any shared infra file unless explicitly told to

---

## 📦 Tech Stack (Non-Negotiable)

| Layer | Technology | Notes |
|-------|-----------|-------|
| HTTP Framework | Fastify (ESM) | JSON Schema validation via AJV on every route |
| Database | MongoDB + Mongoose | GeoJSON 2dsphere indexes for location |
| Auth | JWT | Access token (15 min) + Refresh token (7 days) |
| Background Jobs | Agenda (Mongo-backed) | Recurring subscriptions, webhook retries |
| Storage | Firebase Storage | Pluggable adapter, signed URLs |
| Notifications | FCM + SendGrid | Firebase for push, SendGrid for email |
| Logging | pino | Structured logs, redact auth headers + emails |
| Runtime | Node.js ESM | No CommonJS. No `require()`. No Express. |

---

## 🗂️ Project Structure

```
src/
  app.ts                  ← Fastify instance, plugins, global error handler
  server.ts               ← Bootstrap entry point
  config/                 ← env, db, provider configs
  common/                 ← types, errors, result types, constants
  middleware/
    auth.ts               ← JWT verify → attach user to request
    rbac.ts               ← Role check factory: requireRole('LAB_OWNER')
    rateLimiter.ts
  modules/
    users/                ← model · repo · service · controller · routes · validators
    labs/                 ← model · repo · service · controller · routes · validators
    tests/
    bookings/
    subscriptions/
    assistants/
    reports/
    payments/
    notifications/
  integrations/
    firebase.ts           ← lazy init adapter (FCM + Storage)
    storage/
      FirebaseStorage.ts  ← implements StorageAdapter interface
    notifications/
      FcmNotifier.ts
      SendGridNotifier.ts
    maps/
      MapsAdapter.ts
  jobs/
    subscriptions.run.ts
    payments.webhook-retry.ts
    bookings.slot-release.ts
    notifications.dispatch.ts
  admin/                  ← AdminJS setup
  utils/                  ← crypto, dates, pagination, idempotency
```

**Rules:**
- Each module owns: `model → repo → service → controller → routes → validators`
- Services never import from another module's controller
- Controllers never touch Mongoose directly — always go through the repo
- All env vars accessed via `src/config/env.ts` — never `process.env` inline

---

## 👤 User Roles (RBAC)

```
CUSTOMER        → book tests, manage own bookings, view reports, manage subscriptions
LAB_OWNER       → manage own lab's bookings, upload reports, view analytics, manage assistants
LAB_ASSISTANT   → view assigned bookings, update collection status
ADMIN           → full access, issue refunds, manage all resources
```

**RBAC middleware usage:**
```ts
// In route files
fastify.get('/partner/bookings/daily', {
  preHandler: [fastify.authenticate, fastify.requireRole('LAB_OWNER')],
  schema: dailyBookingsSchema,
}, controller.getDailyBookings);
```

---

## 🗃️ Domain Models

### User
```ts
{
  _id: ObjectId,
  name: String,                         // required
  email: String,                        // unique, lowercase
  phone: String,                        // unique
  passwordHash: String,                 // bcrypt
  roles: ['CUSTOMER'|'LAB_OWNER'|'LAB_ASSISTANT'|'ADMIN'],
  addresses: [AddressSchema],
  location: { type: 'Point', coordinates: [lng, lat] },  // 2dsphere index
  refreshToken: String,                 // hashed
  fcmToken: String,                     // for push notifications
  isVerified: Boolean,
  timestamps: true
}
```

### Lab
```ts
{
  _id: ObjectId,
  owner: ref(User),                     // LAB_OWNER
  name: String,
  address: AddressSchema,
  location: { type: 'Point', coordinates: [lng, lat] },  // ← 2dsphere index REQUIRED
  certifications: [String],             // ['NABL', 'CAP', 'ISO']
  openingHours: WeekScheduleSchema,     // { monday: { open: '09:00', close: '18:00' }, ... }
  slotMatrix: { duration: Number, intervalMinutes: Number, maxBookingsPerSlot: Number },
  rating: Number,
  totalRatings: Number,
  isActive: Boolean,
  timestamps: true
}
// Index: { location: '2dsphere' }
// Index: { owner: 1, isActive: 1 }
```

### Test
```ts
{
  _id: ObjectId,
  lab: ref(Lab),
  name: String,                         // 'CBC', 'Lipid Panel', 'HbA1c'
  description: String,
  price: Number,                        // INR
  sampleRequirements: String,           // 'Fasting 8 hours required'
  turnaroundHours: Number,
  isActive: Boolean,
  timestamps: true
}
// Index: { lab: 1, isActive: 1 }
```

### Booking
```ts
{
  _id: ObjectId,
  user: ref(User),
  lab: ref(Lab),
  tests: [ref(Test)],
  subscription: ref(Subscription),      // nullable
  scheduledDate: Date,
  slot: { start: String, end: String }, // '10:00', '10:30'
  status: 'PENDING'|'CONFIRMED'|'COLLECTED'|'COMPLETED'|'CANCELLED',
  labAssistant: ref(LabAssistant),      // nullable
  collectionType: 'HOME'|'IN_LAB',
  userAddress: AddressSnapshot,         // snapshot at booking time
  totalAmount: Number,
  report: ref(Report),                  // nullable
  cancelReason: String,
  timestamps: true
}
// Index: { lab: 1, scheduledDate: 1 }
// Index: { user: 1, status: 1 }
// Index: { subscription: 1 }
```

### Subscription
```ts
{
  _id: ObjectId,
  user: ref(User),
  lab: ref(Lab),
  test: ref(Test),
  frequency: 'MONTHLY'|'WEEKLY'|'CUSTOM',
  customIntervalDays: Number,           // only for CUSTOM
  nextBookingDate: Date,               // Agenda uses this field
  autoPayment: Boolean,
  status: 'ACTIVE'|'PAUSED'|'CANCELLED',
  lastRunAt: Date,
  retryCount: Number,
  timestamps: true
}
// Index: { user: 1, status: 1, nextBookingDate: 1 }
```

### Report
```ts
{
  _id: ObjectId,
  booking: ref(Booking),
  test: ref(Test),
  file: {
    uri: String,              // Firebase Storage path: 'reports/{bookingId}/report.pdf'
    storageProvider: 'FIREBASE',
    checksum: String,         // sha256
  },
  issuedAt: Date,
  isAccessible: Boolean,
  timestamps: true
}
// Index: { booking: 1 }
```

### Transaction
```ts
{
  _id: ObjectId,
  booking: ref(Booking),
  subscription: ref(Subscription),      // nullable
  provider: 'RAZORPAY'|'STRIPE'|'PAYTM',
  providerTxnId: String,
  amount: Number,                       // paise (INR × 100)
  currency: 'INR',
  status: 'PENDING'|'AUTHORIZED'|'CAPTURED'|'FAILED'|'REFUNDED',
  method: 'UPI'|'CARD'|'WALLET'|'NETBANKING',
  invoice: ref(Invoice),
  webhookEvents: [Object],             // raw provider payloads
  idempotencyKey: String,              // unique
  timestamps: true
}
// Index: { provider: 1, providerTxnId: 1 } — unique compound
// Index: { booking: 1 }
```

---

## 🔌 Firebase Adapter (Confirmed Integration)

### Initialization — Lazy, Never Crash
```ts
// src/integrations/firebase.ts
import admin from 'firebase-admin';

let _app: admin.app.App | null = null;

export function getFirebaseApp(): admin.app.App | null {
  if (_app) return _app;
  if (process.env.FCM_ENABLED !== 'true') return null;

  _app = admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)
    ),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  return _app;
}
```

### Firebase Storage Adapter
```ts
// src/integrations/storage/FirebaseStorage.ts
import { getFirebaseApp } from '../firebase';

export class FirebaseStorage {
  async upload(localPath: string, destination: string, mimeType: string): Promise<string> {
    const bucket = getFirebaseApp()!.storage().bucket();
    await bucket.upload(localPath, {
      destination,
      metadata: { contentType: mimeType },
    });
    return destination; // Store this path — NOT the full URL
  }

  async getSignedUrl(filePath: string, expiryMinutes = 15): Promise<string> {
    const bucket = getFirebaseApp()!.storage().bucket();
    const [url] = await bucket.file(filePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiryMinutes * 60 * 1000,
    });
    return url;
  }
}
```

### FCM Notifier
```ts
// src/integrations/notifications/FcmNotifier.ts
import { getFirebaseApp } from '../firebase';

export class FcmNotifier {
  async send(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
    const app = getFirebaseApp();
    if (!app || !fcmToken) return;

    await app.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data,
    });
  }
}
```

---

## 🛣️ API Routes Reference

### Auth (PUBLIC)
```
POST   /auth/register            Register (CUSTOMER or LAB_OWNER)
POST   /auth/login               Returns { accessToken, refreshToken }
POST   /auth/refresh             Rotate refresh token
POST   /auth/forgot-password     Send reset OTP/link
POST   /auth/reset-password      Validate token, set new password
POST   /auth/logout              Invalidate refresh token [AUTH]
```

### Profile [AUTH]
```
GET    /me                       Own profile
PUT    /profile                  Update name, phone, fcmToken
POST   /addresses                Add address
PUT    /addresses/:id            Update address
DELETE /addresses/:id            Remove address
POST   /location                 Update GeoJSON coordinates
```

### Labs [AUTH]
```
GET    /labs/nearby              ?lat=&lng=&radius=5000&testType=&minRating=
GET    /labs/:id                 Full lab details + slot matrix
GET    /labs/:id/tests           Active test catalog
GET    /labs/:id/slots           Available slots for ?date=YYYY-MM-DD
```

### Bookings [AUTH → CUSTOMER]
```
POST   /bookings                 Create booking (slot hold → payment)
GET    /bookings                 List own bookings ?status=&page=&limit=
GET    /bookings/:id             Single booking detail
POST   /bookings/:id/cancel      Cancel → refund if paid
GET    /bookings/:id/report      Get signed URL for report PDF
```

### Subscriptions [AUTH → CUSTOMER]
```
POST   /subscriptions            Create recurring subscription
GET    /subscriptions            List own subscriptions
GET    /subscriptions/:id        Single subscription
PUT    /subscriptions/:id        Update frequency / autoPayment
POST   /subscriptions/:id/pause  Pause (stops Agenda job)
POST   /subscriptions/:id/resume Resume (resets nextBookingDate)
POST   /subscriptions/:id/cancel Cancel permanently
```

### Payments [AUTH → CUSTOMER]
```
POST   /payments/intent          Create payment intent for booking/sub
GET    /payments/:id             Transaction detail + invoice
POST   /webhooks/payments        PUBLIC — provider webhook (sig verify required)
POST   /payments/:id/refund      [ADMIN] Trigger refund
```

### Reports
```
GET    /reports/:id              [AUTH] Signed Firebase Storage URL (15 min expiry)
```

### Partner — Lab Owner [AUTH → LAB_OWNER]
```
GET    /partner/bookings/daily           Today's bookings for own lab
GET    /partner/bookings                 Full history ?status=&page=
POST   /partner/bookings/:id/accept      Confirm booking
POST   /partner/bookings/:id/reject      Reject with reason
POST   /partner/bookings/:id/reassign    Reassign lab assistant
POST   /partner/reports/upload           Multipart PDF → Firebase Storage
POST   /partner/bookings/:id/report      Link uploaded report to booking
GET    /partner/assistants               List assistants for own lab
POST   /partner/assistants               Create assistant
PUT    /partner/assistants/:id           Update assistant
PUT    /partner/assistants/:id/availability  Set weekly schedule
GET    /partner/analytics/overview       Revenue, count, top tests
GET    /partner/analytics/revenue        Revenue over ?from=&to=
GET    /partner/analytics/slots          Peak slot analysis
GET    /partner/customers/:id/history    Full test+billing history per customer
```

---

## ⚙️ Key Workflows

### Booking State Machine
```
─────────────────────────────────────────────────────────────────
FROM            EVENT                   TO          SIDE EFFECTS
─────────────────────────────────────────────────────────────────
—               POST /bookings          PENDING     Slot held (15 min window)
PENDING         Payment captured        CONFIRMED   Invoice generated, notify
CONFIRMED       Assistant assigned      CONFIRMED   Notify assistant
CONFIRMED       Sample collected        COLLECTED   Notify lab to process
COLLECTED       Report uploaded         COMPLETED   Signed URL issued, notify customer
PENDING/        cancel request          CANCELLED   Slot released, refund if paid
CONFIRMED
─────────────────────────────────────────────────────────────────
Invalid state transitions → throw DomainError('INVALID_BOOKING_TRANSITION', 409)
```

### Lab Discovery Query
```ts
Lab.find({
  location: {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: radius, // meters
    },
  },
  isActive: true,
  // optional filters:
  certifications: { $in: certFilter },   // if certFilter provided
})
// Then filter opening hours in-memory (check day + current time)
```

### Recurring Subscription Job
```
Agenda job: subscriptions:run — runs daily at 00:00 UTC

1. Query: { status: 'ACTIVE', nextBookingDate: { $lte: now } }
2. For each subscription:
   a. Generate idempotencyKey = `sub_${id}_${YYYYMMDD}`
   b. Check idempotencyKey doesn't already exist in Booking collection
   c. Create Booking (status = PENDING)
   d. If autoPayment → trigger PaymentProvider.createAndCapture()
   e. Update nextBookingDate based on frequency
   f. Update lastRunAt
3. On failure:
   a. Increment retryCount
   b. If retryCount >= 3 → set status = PAUSED, notify owner via FCM + email
```

### Report Upload Flow (Firebase)
```
1. Partner: POST /partner/reports/upload (multipart, PDF only, max 10MB)
2. Validate MIME type = 'application/pdf'
3. Stream to Firebase Storage: path = reports/{bookingId}/{timestamp}.pdf
4. Compute SHA-256 checksum
5. Create Report document: { booking, file: { uri, provider: 'FIREBASE', checksum } }
6. POST /partner/bookings/:id/report → link Report to Booking
7. Emit domain event: ReportReady
8. Handler: FcmNotifier.send(user.fcmToken, 'Report Ready', '...') + SendGrid email
```

---

## 🔐 Error Response Format (RFC 7807)

All errors must return this exact shape:
```json
{
  "type": "https://labzy.in/errors/SLOT_UNAVAILABLE",
  "title": "Slot Unavailable",
  "status": 409,
  "detail": "The 10:00 AM slot on 2026-03-15 is already fully booked",
  "instance": "/bookings"
}
```

### Domain Error Codes
```
SLOT_UNAVAILABLE          409   Slot taken or outside opening hours
BOOKING_NOT_FOUND         404   Booking not found or access denied
INVALID_BOOKING_TRANSITION 409  State machine violation
PAYMENT_FAILED            402   Provider returned failure
REPORT_ACCESS_DENIED      403   User not authorized for this report
LAB_CLOSED                422   Lab not open at requested time
ASSISTANT_UNAVAILABLE     409   No available assistant
WEBHOOK_SIGNATURE_INVALID 401   HMAC mismatch on payment webhook
INVALID_SUBSCRIPTION_STATE 409  Cannot transition subscription to that state
FILE_TOO_LARGE            413   Upload exceeds 10MB limit
INVALID_FILE_TYPE         415   Only PDF accepted for reports
```

---

## 📋 Code Conventions

### Route File Pattern
```ts
// src/modules/bookings/routes.ts
import { FastifyInstance } from 'fastify';
import { BookingController } from './controller';
import { createBookingSchema, listBookingsSchema } from './validators';

export async function bookingRoutes(fastify: FastifyInstance) {
  const controller = new BookingController();

  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('CUSTOMER')],
    schema: createBookingSchema,
  }, controller.create.bind(controller));

  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('CUSTOMER')],
    schema: listBookingsSchema,
  }, controller.list.bind(controller));
}
```

### Service Layer Pattern
```ts
// src/modules/bookings/service.ts
export class BookingService {
  constructor(
    private bookingRepo: BookingRepo,
    private labRepo: LabRepo,
    private notificationService: NotificationService,
  ) {}

  async createBooking(dto: CreateBookingDto, userId: string): Promise<Booking> {
    // 1. Validate slot availability
    // 2. Hold slot (set expiry)
    // 3. Create Booking (PENDING)
    // 4. Return booking (payment handled separately)
  }
}
```

### Validator (AJV JSON Schema) Pattern
```ts
// src/modules/bookings/validators.ts
export const createBookingSchema = {
  body: {
    type: 'object',
    required: ['labId', 'testIds', 'scheduledDate', 'slot', 'collectionType'],
    properties: {
      labId:          { type: 'string' },
      testIds:        { type: 'array', items: { type: 'string' }, minItems: 1 },
      scheduledDate:  { type: 'string', format: 'date' },
      slot:           { type: 'object', required: ['start'], properties: { start: { type: 'string' } } },
      collectionType: { type: 'string', enum: ['HOME', 'IN_LAB'] },
    },
    additionalProperties: false,
  },
};
```

### Repo Pattern
```ts
// src/modules/bookings/repo.ts
export class BookingRepo {
  async findById(id: string): Promise<Booking | null> {
    return BookingModel.findById(id).populate('lab tests report labAssistant');
  }

  async findByUser(userId: string, filters: BookingFilters): Promise<Booking[]> {
    return BookingModel.find({ user: userId, ...filters })
      .sort({ createdAt: -1 })
      .skip(filters.skip)
      .limit(filters.limit);
  }

  async updateStatus(id: string, status: BookingStatus, extra?: Partial<Booking>): Promise<Booking> {
    return BookingModel.findByIdAndUpdate(id, { status, ...extra }, { new: true });
  }
}
```

---

## 🚨 Critical Fixes Required Before New Features

These must be done first — they block everything else:

1. **Lab 2dsphere index missing** — Add to Lab model immediately:
   ```ts
   LocationSchema.index({ location: '2dsphere' });
   ```
   Then fix the `$near` query in `controllers/profileController.js`.

2. **Firebase admin not initialized** — Use the lazy adapter pattern above.
   Current code references `firebase-admin` but never calls `initializeApp()`.

3. **Remove Express** — Any file with `import express` or `require('express')` must be rewritten for Fastify.

4. **Remove hardcoded Gmail creds** — Move Nodemailer config to env vars or replace with SendGrid adapter.

5. **No RBAC checks exist** — JWT auth works but roles are never checked. Add `requireRole()` middleware to all existing routes.

---

## ✅ Development Milestones (Sequential)

```
MILESTONE 1 — Foundation (~1 week)
  □ pino structured logging + request redaction
  □ @fastify/helmet + @fastify/cors (allowlist)
  □ RBAC middleware: requireRole() factory
  □ Global error handler → RFC 7807
  □ AJV JSON Schema on all existing routes
  □ Remove Express, unify ESM
  □ Fix Firebase lazy init

MILESTONE 2 — Lab Discovery (~3 days)
  □ Add Lab.location field + 2dsphere index
  □ GET /labs/nearby (with $near + filters)
  □ GET /labs/:id
  □ GET /labs/:id/tests
  □ GET /labs/:id/slots (slot matrix generator)

MILESTONE 3 — Bookings + Slot Management (~1 week)
  □ POST /bookings (slot hold → PENDING)
  □ Booking state machine (service layer)
  □ GET/CANCEL booking routes
  □ Lab assistant assignment service
  □ bookings:slot-release Agenda job (15 min hold expiry)

MILESTONE 4 — Subscriptions (~1 week)
  □ Subscription model + service
  □ POST/GET/PUT/pause/resume/cancel routes
  □ subscriptions:run Agenda job (daily)
  □ Idempotency key per run
  □ Retry logic → pause after 3 failures

MILESTONE 5 — Payments (~1 week)
  □ PaymentProvider adapter interface
  □ Razorpay provider implementation
  □ POST /payments/intent
  □ POST /webhooks/payments (HMAC verify)
  □ Transaction model + Invoice generation
  □ payments:webhook-retry Agenda job

MILESTONE 6 — Reports + Firebase Storage (~4 days)
  □ FirebaseStorage adapter
  □ POST /partner/reports/upload (multipart)
  □ Report model + checksum
  □ GET /reports/:id → signed URL (15 min)
  □ Link report to booking → emit ReportReady event

MILESTONE 7 — Notifications (~4 days)
  □ Domain event bus (EventEmitter)
  □ FcmNotifier (push via Firebase)
  □ SendGridNotifier (transactional email)
  □ notifications:dispatch Agenda job + outbox pattern
  □ channelMap.ts: event → channels config

MILESTONE 8 — AdminJS + Analytics (~3 days)
  □ AdminJS: bcrypt admin auth
  □ Register: Subscriptions, Transactions, Reports, Assistants, Invoices
  □ GET /partner/analytics/* aggregation pipelines

MILESTONE 9 — Security Hardening (~1 week)
  □ AuditLog model + hooks on sensitive reads/writes
  □ Encrypt PII fields (report URIs, address elements)
  □ Rate limiting per route group
  □ Load testing + index performance review
```

---

## 🚫 Never Do This

- Never use `require()` or CommonJS `module.exports`
- Never access `process.env.*` directly in modules — use `src/config/env.ts`
- Never call Mongoose models directly from controllers — always go through repo
- Never skip AJV schema on a new route
- Never hardcode credentials, provider keys, or bucket names
- Never generate a signed URL and store it in the DB — store the path, sign on demand
- Never allow a subscription job run without checking the idempotency key first
- Never modify `hooks.js`, `world.js`, or `commonUtils.js`

---

## 📎 How to Use This File

**When asked to generate a new module**, always:
1. Read the domain model for that module from this file
2. Check which milestone it belongs to
3. Generate all 6 files: `model → repo → service → controller → routes → validators`
4. Apply RBAC from the role matrix
5. Add AJV schema to every route
6. Use the Firebase adapter (not raw firebase-admin calls)
7. Emit a domain event for any state change that needs a notification
8. Use RFC 7807 error format for all thrown errors

**When asked to fix a bug**, check the Critical Fixes section first.

**When generating a background job**, always include:
- Idempotency key logic
- Retry/backoff strategy
- Failure notification to the relevant owner