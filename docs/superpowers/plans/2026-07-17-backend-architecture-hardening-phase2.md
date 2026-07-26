# Labzy Backend Hardening — Phase 2 Plan

Status: NOT STARTED. Deferred from Phase 1 (`2026-05-28-backend-architecture-hardening-phase1.md`) at the
user's explicit direction on 2026-07-17: "focus one core functionality for now, we will implement extra
features in phase 2 — finish only important core features now." Phase 1 concluded with the core
customer/booking/payment lifecycle complete; everything below is deliberately out of Phase 1's scope.

## What Phase 1 actually shipped (context for whoever picks up Phase 2)

Tasks 1–30, 32, 33, 37 from the Phase 1 plan are DONE and reviewed (spec-compliant, tests passing). In scope:
auth (email+password only, no SMS/phone OTP anywhere — this is a hard standing constraint, see below),
session management + account deletion grace period, booking state machine v2 (11-state enum, event log),
booking policy (10-min hold, reschedule cutoffs, lab-response SLA), lab discovery v2 (relevance search,
synonyms, recent searches, lab-watch notifications), lab profile depth, subscriptions v2 (occurrence-based,
slot intelligence, approval flow), sample-collection visit-OTP + masked-call stub, reports v2 (per-test
partials, replace-with-reason, TAT board), payments v2 (invoices, refund tracking, double-pay reversal), and
help/support tickets. Task 31 (sample-issue free re-collection) and Task 34 (promo codes) were explicitly
deferred to Phase 2 alongside everything from Task 35 onward — see the task list below.

**Standing constraints that apply to ALL Phase 2 work, no exceptions:**
- **Never implement SMS or phone-based OTP/auth for any role.** Auth is email+password only — confirmed twice
  by the user, including explicitly against this PRD's own stated requirements in a couple of places (e.g.
  Task 40's staff login below already notes this override). Any task below that references SMS (Task 35's SMS
  fallback, Task 40's "mobile + OTP" PRD language) must keep that path as a permanently non-functional stub,
  exactly like Phase 1's `services/maskedCallService.js` — never wire a real provider.
- **No git commits without being explicitly asked.** The user controls version control.
- Current `models/booking.js` `status` enum (as of end of Phase 1): `PENDING, CONFIRMED,
  ASSISTANT_ASSIGNED, ON_THE_WAY, ARRIVED, COLLECTED, PROCESSING, COMPLETED, RESCHEDULED, NO_SHOW, CANCELLED`.
  Booking also now has `cancelBy`, `rescheduleCount`, `visitOtp`, `visitOtpVerifiedAt`, `visitNotes`,
  `homeCollectionFee`, and `reports: [{ test, report }]` (NOT a single `report` ref — that was migrated away
  in Task 32). Any Phase 2 task snippet below that still references a singular `booking.report` is stale
  relative to the plan-authoring time and must be adapted to the array shape.
- `services/_shared/transitions.js` (`assertTransition`, `canTransition`, `buildTimeline`) and
  `services/_shared/events.js` (`recordEvent`) are stable, completed infrastructure — use them for any new
  status-changing code path in Phase 2 rather than mutating `booking.status` directly.
- `common/errors.js` already has (as of end of Phase 1): the original Phase-1 set, plus
  `RESCHEDULE_CUTOFF_PASSED`, `RESCHEDULE_LIMIT_REACHED`, `CANCELLATION_FEE_APPLICABLE`, `SERVICE_UNAVAILABLE`.
  `CANCELLATION_FEE_APPLICABLE` exists but is NOT yet wired to any actionable charge — Task 34 (promo codes) or
  a cancellation-fee-charging task in Phase 2 is the natural place to finish that.
- Before starting ANY Phase 2 task, re-read the actual current file contents for anything it touches — several
  Phase 1 tasks deviated from this plan's original snippets in deliberate, documented ways (see each Phase 1
  task's `task-NN-report.md` under the scratchpad directory used during that run, if still available, or just
  trust the live code). Do not assume any code snippet below matches the current file verbatim.
- Known unresolved systemic issue (flagged during Phase 1, not fixed): `config/env.js` freezes `process.env.*`
  into top-level `export const`s at module-evaluation time, which races `tests/helpers/buildApp.js`'s
  `setupTestApp()` when a test file's static imports transitively touch it first. Two Phase 1 tasks hit this
  independently and worked around it locally (dynamic imports / deferred imports). A real fix (lazy getters
  instead of frozen consts) is recommended as an early Phase 2 task or standalone chore before the codebase
  accumulates more test files that could hit it.
- Also flagged during Phase 1 review (not fixed, pre-existing, unrelated to any single task): `models/booking.js`
  status mutations in `scheduler/jobs/slotHoldSweepJob.js` (PENDING→CANCELLED on hold expiry) do not call
  `recordEvent`. Worth folding into whichever Phase 2 task next touches that job.
- `package.json` gained one new dependency in Phase 1: `pdfkit` (for invoice PDF generation, Task 33). No other
  new dependencies were added. Phase 2 tasks that need a new package (e.g. Task 44's `archiver` for ZIP export)
  should install it deliberately and note it, same as Phase 1 did.

---

## Task 31: Sample issue → free re-collection (§6.6 edge)

**Why (PRD):** When a lab flags a hemolyzed/insufficient sample, customer must get an apology notification + a
free re-collection booking flow.

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

`bookingService.createBooking` accepts `recollectionOf: bookingId`. When present, `totalAmount` is set to 0 and
the new booking carries `meta.recollectionOf` for analytics.

**Phase-2 implementer note**: `flagSampleIssue`'s status mutation should go through `assertTransition` +
`recordEvent` (both stable now) rather than a bare assignment, unlike this original snippet — this is a new
code path, so there's no excuse to introduce a fresh un-audited transition. Also: `booking.js` has no `meta`
field currently — either add one (`meta: mongoose.Schema.Types.Mixed`) or use a more specific
`recollectionOf: { type: ObjectId, ref: 'Booking', default: null }` field instead, which is more query-friendly
for analytics than a buried `meta.recollectionOf`.

**Checkpoint:** sample-issue flow ends in a free re-collection.

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
  const usedByUser = await Booking.countDocuments({ user: user._id, 'appliedPromo.code': p.code });
  if (p.perUserLimit && usedByUser >= p.perUserLimit) throw Errors.PROMO_INVALID('You have used this code');
  const raw = p.kind === 'PCT' ? Math.floor((subtotal * p.value) / 100) : p.value;
  return { discount: Math.min(raw, p.maxDiscount || raw), promo: p };
};
```

Add `PROMO_INVALID: (detail) => new DomainError('PROMO_INVALID', 400, detail || 'Invalid promo code')` to
`common/errors.js`.

**Phase-2 implementer note**: `createBooking`'s `totalAmount` computation now also includes `homeCollectionFee`
(added in Phase 1 Task 28) — apply the promo discount to `cart.totalAmount` (the test/package subtotal) BEFORE
adding `homeCollectionFee`, not after, unless product intent says otherwise (worth a quick product-sense check
rather than assuming). Also increment `promo.usedCount` atomically (`findOneAndUpdate` with `$inc`) to avoid a
race under concurrent bookings, rather than a read-then-write.

**Checkpoint:** promo flow works.

---

## Task 35: Notification preferences + quiet hours + SMS fallback (§6.10)

**Why (PRD §6.10):** critical (non-disablable) vs configurable categories; quiet hours 10pm-7am for
non-critical; channels: push (primary), SMS fallback when push fails, email for invoices/reports.

**Files:**
- Modify: `models/user.js` — `notificationPreferences`
- Create: `services/smsService.js` — provider abstraction (same shape as Phase 1's `maskedCallService.js`)
- Modify: `services/notificationService.js` — gate by category + quiet hours; fallback to SMS for critical
  when push unavailable

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

**CRITICAL constraint for this task specifically**: `services/smsService.js` must be built exactly like Phase
1's `services/maskedCallService.js` — a permanently non-functional stub. `sendSms()` must NEVER contact a real
SMS provider (Twilio, MSG91, etc.) under any environment/configuration. Note `twilio` is already sitting
unused in `package.json` (pre-existing, from before Phase 1 — verified during Phase 1 that nothing imports it).
Do not import or wire it up. This is the single most important constraint in this entire task — every other
requirement is negotiable, this one is not.

**Checkpoint:** quiet hours + critical-vs-optional gating, SMS path stubbed and inert.

---

## Task 36: Reviews v2 — sub-ratings + lab reply + moderation + abuse report (§6.11)

**Why (PRD §6.11):** sub-ratings (assistant, timeliness, TAT), lab can post one public reply per review, abuse
moderation (profanity + PII), report-inappropriate flow.

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

`reviewService.createReview` runs `moderate(comment)`. If `ok === false` → `moderationStatus = 'REJECTED'`, do
not include in lab rating recompute.

Add routes:
- `POST /api/labs/:id/reviews/:reviewId/reply` (LAB_OWNER)
- `POST /api/reviews/:id/report { reason }` (CUSTOMER)

**Phase-2 implementer note**: `services/labCatalogService.js`'s `getLab` already computes a `ratingDistribution`
via `Review.aggregate` (Phase 1 Task 26) — that aggregation should be updated to exclude
`moderationStatus !== 'APPROVED'` reviews once this task lands, or rejected/pending reviews will skew the
lab's public rating distribution.

**Checkpoint:** review flow closed.

---

## Task 38: Lab documents + verification gate + vacation mode + multi-branch (§7.1)

**Why (PRD §7.1):** labs only become discoverable after documents are verified; certification badges map 1:1
to verified documents; expiry auto-removes badges; vacation mode pauses new bookings.

**Files:**
- Create: `models/labDocument.js`
- Modify: `models/lab.js` — `state` enum (`DRAFT/UNDER_REVIEW/LIVE/PAUSED/SUSPENDED`), `parentLab` (multi-branch)
- Modify: `services/labCatalogService.js` — only show `state==='LIVE'` and `state!=='PAUSED'`
- Create: `scheduler/jobs/docExpiryJob.js` — notify 30/7/1 days before, then drop badge
- Add routes: `POST /api/partner/lab/documents`, `GET /api/partner/lab/documents`,
  `POST /api/partner/lab/vacation`, `POST /api/partner/branches`

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

**Phase-2 implementer note**: `models/lab.js` already has a `pre('save')`/`post('save')` hook pair (Phase 1
Task 25, lab-watch "notify me when a lab joins nearby" feature) keyed on the `isActive` field transitioning to
`true`. Introducing a separate `state` enum here means there are now two semi-overlapping "is this lab live"
signals (`isActive` boolean and `state` enum) — decide deliberately whether `state === 'LIVE'` should imply/set
`isActive = true` (and trigger that existing hook) or whether the two are meant to be independent, and document
the decision; don't let them silently drift out of sync.

**Checkpoint:** verification gate + multi-branch + vacation.

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

**Phase-2 implementer note**: `lab.slotMatrix` (singular, not per-mode) is read in MANY places already —
`services/bookingService.js` (createBooking, rescheduleBooking), `services/partnerService.js`,
`services/_shared/slotIntelligence.js` (Phase 1 Task 29), `services/subscriptionService.js`'s scheduler job.
Changing to `slotMatrixByMode: { HOME, IN_LAB }` is a breaking schema change on the same order as Phase 1
Task 32's booking.report → booking.reports migration — budget time to grep every `slotMatrix` reference and
update each call site to pass/select the right mode, not just the two files explicitly listed above.

**Checkpoint:** catalog matches §7.2.

---

## Task 40: Staff roles — Lab Manager + Lab Assistant login + assistant day view + metrics (§7.4)

**Why (PRD §7.4):** Lab Manager + Lab Assistant roles, assistants see only their own day, owners see
per-assistant metrics. **Auth method override (standing project constraint):** PRD specifies mobile + OTP login
for staff; per the user's explicit, twice-confirmed instruction, use email + password instead — same as every
other role in this app. Owners create staff accounts with email + password via a partner-side endpoint. Do not
implement phone/OTP login for staff under any circumstances.

**Files:**
- `middlewares/rbacMiddleware.js` already supports multiple roles generically (`requireRoles(...allowed)`) —
  confirmed during Phase 1 Task 30, no change needed there.
- Modify: `models/user.js` — add `LAB_MANAGER` to the `roles` enum (currently `['CUSTOMER', 'LAB_OWNER',
  'LAB_ASSISTANT', 'ADMIN']` — `LAB_ASSISTANT` already exists from Phase 1)
- Modify: `models/labAssistant.js` — `photoUrl`, `idVerifiedAt`
- Modify: `services/assistantService.js` (created Phase 1 Task 30) — add `getMyDay({ userId })`
- Modify: `services/partnerService.js` — `createStaffUser`, `getAssistantMetrics`
- Add routes:
  - `POST /api/partner/staff` (owner creates a Lab Manager or Lab Assistant user with email + password)
  - `GET /api/assistant/day`
  - `GET /api/partner/assistants/:id/metrics`

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

**Phase-2 implementer note**: `services/assistantService.js` already exists from Phase 1 Task 30
(`startJourney`, `markArrived`, `verifyVisitOtp`) — `getMyDay` is a new export alongside those, not a new file.
`LabAssistant.photoUrl` doesn't exist yet — this task adds it as a required field for `createStaffUser`'s
`LAB_ASSISTANT` branch, which is fine, but note existing `LabAssistant` docs created in Phase 1 tests/dev data
won't have it — don't make it `required: true` at the schema level unless you also handle backfill, or the
existing partner-assistant creation flow (`partnerService.createAssistant`, Phase 1) will start failing
validation on save for old-style calls that don't pass `photoUrl`.

**Checkpoint:** staff roles + metrics.

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

Existing `getCustomerHistory` (in `services/partnerService.js`) already filters by `lab: lab._id` — that
satisfies PRD's cross-lab privacy clause. This task only adds the notes overlay. Smallest task in Phase 2 —
good candidate to pair with Task 31 or knock out first.

**Checkpoint:** PRD §7.5 closed.

---

## Task 42: Analytics v2 — acceptance / no-show / TAT compliance / peak heatmap / quality panel (§7.8)

**Why (PRD §7.8):** existing analytics (Phase 1's inherited Task 7 baseline — `getAnalyticsOverview`,
`getRevenueAnalytics`, `getSlotsAnalytics` in `services/partnerService.js`) only cover totals + revenue. PRD
wants acceptance rate, no-show rate, TAT compliance %, peak-hours heatmap, quality panel (rating trend +
reviews feed with reply action).

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

**Phase-2 implementer note**: this snippet's `Report` lookups join on `report.booking` — after Phase 1 Task
32's schema migration, a `Report` document's `booking` field still exists and is unchanged (only
`Booking.reports[]` changed shape), so this aggregation should still work as written, but double check against
the live `Report` schema before assuming so. `getQualityPanel` (rating trend + reviews feed with reply action)
depends on Task 36 (Reviews v2) having landed first for the `reply` field to exist — sequence Task 36 before
this one, or before the quality-panel half of it specifically.

**Checkpoint:** PRD §7.8 metrics live.

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

`accrueLine` runs when booking reaches `COMPLETED`. `runSettlementCycle` rolls up the current cycle and flips
state. Dispute = create row + freeze the line until resolved.

**Phase-2 implementer note**: `accrueLine(booking)` needs a trigger point — the natural hook is wherever
`booking.status` transitions to `COMPLETED` (currently in `services/reportService.js`'s `linkReport`, after
Phase 1 Task 32, when all per-test reports are in). Wire it in there rather than polling. Also this task should
read `Refund` records (Phase 1 Task 33, `models/refund.js`) for the `refunds` line-item field — a booking with
a processed refund should reduce its settlement payout accordingly.

**Checkpoint:** §7.9 closed.

---

## Task 44: Data export + consent center + i18n strings (§6.9, §8.1, §8.3)

**Why (PRD §8.1 FR-5):** customer can request a complete export of their data; PRD §6.9 FR-5 consent center;
PRD §8.3 Hindi+English.

**Files:**
- Create: `services/dataExportService.js` — produces a ZIP of all user data (needs the `archiver` npm package —
  not currently installed; install deliberately when this task starts, same as Phase 1 did for `pdfkit`)
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

**Phase-2 implementer note**: `storage.uploadBuffer` (Firebase-backed) throws if Firebase isn't configured —
Phase 1 Task 33 hit this exact problem for invoice PDFs and established the pattern of catching the failure
and degrading gracefully rather than letting it break the caller. `runExport` should follow the same pattern:
if the ZIP upload fails, mark the job `state: 'FAILED'` with an error message rather than leaving it hung, and
don't let it throw uncaught inside whatever scheduler/worker context invokes `runExport`. Also note `Refund`
lookup "via transactions" is left as a TODO in the plan's own snippet — Phase 1 Task 33's `models/refund.js`
has a direct `booking` ref, so `Refund.find({ booking: { $in: bookingIds } })` is simpler than going through
transactions first; use that.

**Checkpoint:** PRD §6.9, §8.1, §8.3 closed.

---

## Task 45: Partner notifications v2 — assistant visit reminder + owner daily digest (§7.7)

**Why (PRD §7.7):** §7.7 FR-2 — assistants get "upcoming visit reminder (60 min before window)". §7.7 FR-3 —
owner/manager configurable "daily morning summary + end-of-day recap".

**Files:**
- Create: `scheduler/jobs/assistantReminderJob.js`
- Create: `scheduler/jobs/partnerDigestJob.js`
- Modify: `models/user.js` — add `partnerDigestPreferences` for LAB_OWNER/LAB_MANAGER users
- Register both intervals in `scheduler/index.js`

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

Partner digest job (owner/manager daily morning summary + end-of-day recap) — see the original Phase 1 plan
document's Task 45 section (around line 4715 onward, `scheduler/jobs/partnerDigestJob.js`) for the full
reference snippet; it was not re-transcribed here for brevity but is unchanged from the original plan and still
applies as-is.

**Phase-2 implementer note**: depends on Task 40 (Staff roles) for `LAB_MANAGER` to be a meaningful digest
recipient alongside `LAB_OWNER` — sequence Task 40 before this one, or scope the first pass to `LAB_OWNER` only
and extend later.

**Checkpoint:** §7.7 closed.

---

## Suggested Phase 2 sequencing

Given the dependency notes scattered above, a reasonable order:

1. **Task 41** (customer notes) — smallest, no dependencies, good warm-up.
2. **Task 31** (sample re-collection) — small, self-contained within the already-stable booking state machine.
3. **Task 34** (promo codes) — small, touches `bookingService.createBooking` (same file Task 31 also touches —
   don't parallelize these two).
4. **Task 36** (reviews v2) — needed before Task 42's quality panel.
5. **Task 40** (staff roles) — needed before Task 45's owner-digest and before any future assistant-day-view
   frontend work; also unblocks real use of the `LAB_ASSISTANT` flows Phase 1 already built.
6. **Task 45** (partner notifications v2) — after Task 40.
7. **Task 42** (analytics v2) — after Task 36.
8. **Task 38** (lab docs/verification/vacation/multi-branch) — larger, fairly self-contained.
9. **Task 39** (master test directory + slot-matrix-by-mode) — flagged above as a breaking schema change on
   par with Phase 1's report migration; budget real time for the `slotMatrix` call-site audit. Sequence this
   AFTER Task 38 if both touch `models/lab.js` heavily, to avoid a two-way merge headache (both add new
   top-level lab fields; safe to run in parallel only if carefully scoped to non-overlapping schema edits).
10. **Task 35** (notification preferences + quiet hours + SMS stub) — self-contained, can run anytime; do
    keep the "SMS is a permanent stub" constraint front of mind since it's the most safety-critical piece.
11. **Task 43** (settlements) — depends conceptually on Task 33's refund tracking (already done) and Task 32's
    report-completion trigger point (already done) — no hard Phase-2 dependency, can run in parallel with most
    others once someone identifies the exact `COMPLETED` trigger call site.
12. **Task 44** (data export + i18n) — largest scope creep risk (i18n in particular can balloon); consider
    splitting data-export and i18n into two separate task dispatches rather than one.

This is a recommendation, not a requirement — re-evaluate against whatever the user's actual Phase 2 priorities
turn out to be when that work starts.
