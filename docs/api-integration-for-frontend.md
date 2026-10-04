# Labzy Backend — Frontend Integration Guide

> Companion doc for the `labzy frotend helper/` design-system skill. Maps every screen in the Customer/Partner UI kits to the backend endpoints, payloads, error envelopes, and websocket events. Generated from `routes/`, `services/`, `models/`, and the Phase-1 hardening plan `docs/superpowers/plans/2026-05-28-backend-architecture-hardening-phase1.md` (Tasks 1–30, 32, 33, 37 are shipped; see `docs/superpowers/plans/2026-07-17-backend-architecture-hardening-phase2.md` for what's deferred).

Last verified: 2026-07-17 against branch `new-updated-branch`.

---

## 0. What's new since the last version of this doc

If you integrated against an earlier version of this doc, the highlights:

- **Booking status enum expanded from 6 to 11 states**, with a richer 6-step timeline (was 4 steps) and a new per-booking event log endpoint. See §1.6 and §2.6.
- **Sessions are now per-device** (max 3 concurrent), and accounts support a 30-day soft-delete/restore flow. See §1.2 and §2.2a.
- **Lab discovery got relevance search, synonym-aware `q`, recent searches, and "notify me when a lab joins nearby."** See §2.3.
- **Lab profiles now carry photos, a description, amenities, and a rating distribution; health packages show savings.** See §2.4.
- **Sample-collection visit-OTP + a masked-call stub + visit notes.** See §2.6a. (Masked calling is intentionally a non-functional stub in this build — see the note there.)
- **Subscriptions moved to occurrence-based scheduling** with an approval flow, skip/pause-until, and slot intelligence. See §2.8.
- **Reports now support multiple partial reports per booking** (one per test) plus a lab-side replace-with-reason flow and a TAT board. See §2.7 and §3.4.
- **Payments v2**: invoices (PDF), payment history, refund tracking (including partial refunds), automatic double-charge reversal. See §2.11.
- **Help & support tickets.** See §2.12.
- **Auth is still email + password only for every role, including future lab staff.** No SMS/phone OTP exists anywhere in this backend, and none is planned for this build — see §1.2.

---

## 1. Conventions

### 1.1 Base URL & versioning

```
Production : https://api.labzy.in
Staging    : https://api.staging.labzy.in
Local      : http://localhost:3000
```

All REST routes are prefixed with `/api`. The WebSocket endpoint is `/ws` (no `/api` prefix). The `GET /health` endpoint is used for readiness/liveness probes only — never call it from the customer app.

### 1.2 Auth

- **Every role uses email + password.** There is no SMS/phone OTP anywhere in this backend, for any role, and none is planned — do not build an OTP screen. The phone field is collected as unverified contact-only data.
- The only difference between customer and partner is the `role` field on register: omit it (or send `"CUSTOMER"`) for the patient app; send `"LAB_OWNER"` from the partner signup. The server enforces role-based access on every protected route.
- **Register** requires `consents` (see §2.1) for customers, and rejects customers under 18 if `birthDate` is supplied.
- **Sessions are per-device.** Pass `deviceId` (a stable client-generated identifier, e.g. a UUID persisted in secure storage) and an optional human-readable `deviceLabel` on `register`, `login`, and `refresh`. A user may have at most **3 concurrent sessions**; logging in on a 4th device evicts the oldest. Re-authenticating with the same `deviceId` replaces that device's session instead of adding a new one — always send the same `deviceId` for the same physical device/install across app restarts.
- Both `register` and `login` return `{ accessToken, refreshToken, user }`.
- Send the access token on every authenticated request: `Authorization: Bearer <accessToken>`.
- The access token expires in ~15 minutes (configurable). When you see a 401 with `type: ".../UNAUTHORIZED"`, call `/api/auth/refresh` with `{ refreshToken, deviceId }` and retry the original request **once**. The old refresh token is invalidated on rotation — never re-use it.
- Logout: `POST /api/auth/logout` with an optional `{ refreshToken }` body. If you pass the current device's refresh token, only that device's session is ended (other devices stay logged in). If you omit it, **every** session for the user is ended (all devices logged out). Also discard both tokens locally either way.
- Forgot/reset password: `POST /api/auth/forgot-password { email }` → email link → `POST /api/auth/reset-password/:token { newPassword }`. (Email send requires `EMAIL_USER`/`EMAIL_PASS` env vars; without them the call silently succeeds — by design, to avoid leaking which emails exist.)

### 1.3 Error envelope (RFC 7807)

Every failure — validation, domain, or unhandled — returns:

```json
{
  "type":   "https://labzy.in/errors/SLOT_UNAVAILABLE",
  "title":  "Slot Unavailable",
  "status": 409,
  "detail": "The 10:00 slot on 2026-06-04 is fully booked",
  "instance": "/bookings"
}
```

Switch on the trailing segment of `type` (the error `code`). Catalog:

| Code                          | HTTP | Frontend copy hint                                                    |
|-------------------------------|------|-------------------------------------------------------------------------|
| `VALIDATION_ERROR`            | 400  | "Check the highlighted fields and try again."                         |
| `UNAUTHORIZED`                | 401  | Refresh or kick user back to onboarding.                              |
| `WEBHOOK_SIGNATURE_INVALID`   | 401  | Internal — do not surface.                                            |
| `PAYMENT_FAILED`              | 402  | "Your payment didn't go through. Try another method."                 |
| `FORBIDDEN`                   | 403  | "You don't have access to this. Switch account?"                      |
| `REPORT_ACCESS_DENIED`        | 403  | "This report is private."                                             |
| `NOT_FOUND` / `BOOKING_NOT_FOUND` | 404 | "We couldn't find this — it may have been removed."               |
| `SLOT_UNAVAILABLE`            | 409  | "This slot just filled up. Pick another time or another lab."         |
| `INVALID_BOOKING_TRANSITION`  | 409  | "That action isn't available for this booking right now."             |
| `INVALID_SUBSCRIPTION_STATE`  | 409  | Use `detail` verbatim — it's already user-readable.                   |
| `RESCHEDULE_CUTOFF_PASSED`    | 409  | "Too close to your appointment to reschedule — try cancelling instead." |
| `RESCHEDULE_LIMIT_REACHED`    | 409  | "You've used up your reschedules for this booking."                   |
| `CANCELLATION_FEE_APPLICABLE` | 200  | Informational, not a rejection — see note below.                      |
| `CONFLICT`                    | 409  | Use `detail` verbatim.                                                |
| `ASSISTANT_UNAVAILABLE`       | 409  | "No assistant is free for this slot."                                 |
| `FILE_TOO_LARGE`              | 413  | "Files must be under 10 MB."                                          |
| `INVALID_FILE_TYPE`           | 415  | "Only PDF files are accepted."                                        |
| `LAB_CLOSED`                  | 422  | Use `detail` verbatim ("Lab is closed on Sunday").                    |
| `SERVICE_UNAVAILABLE`         | 503  | "This feature isn't available right now." (masked calling, mostly)    |
| `INTERNAL_ERROR`              | 500  | Generic retry; log to crash reporter.                                 |

> Never display "Something went wrong." (per the design-system writing rules). Use `detail` when human-readable; fall back to the per-code copy above.

`CANCELLATION_FEE_APPLICABLE` is a **200-status** `DomainError` — it's not currently thrown by any endpoint as a rejection. Today, if a lab has a configured cancellation fee and the customer cancels inside the cutoff window, `POST /bookings/:id/cancel` still succeeds (200) and simply appends a note to the returned booking's `cancelReason` (e.g. "Cancelled by customer (cancellation fee of 50 applies — inside 4h cutoff)"). Render that string as-is; there's no separate fee-charge flow yet.

### 1.4 Pagination

List endpoints accept `?page` (1-based) and `?limit` (max 100, default 20) and return:

```json
{ "items": [...], "total": 137, "page": 1, "limit": 20, "pages": 7 }
```

(Some legacy endpoints use the field name from the resource — e.g. `bookings`, `labs`, `tests`, `tickets` — instead of `items`. The shape is otherwise identical. `GET /labs/nearby` is the one exception: it returns `{ labs, count }`, no `page`/`pages`/`total` — it's a capped nearby-radius query, not a general paginated list.)

### 1.5 Dates & money

- Dates are ISO 8601 in UTC. `scheduledDate` and `slot.start` are sent as `YYYY-MM-DD` and `HH:MM` respectively (server local time of the lab).
- Money is integer rupees (`299`, never `2.99`). The wallet symbol `₹` is a display concern.

### 1.6 Booking status & timeline

The `status` enum is now:

```
PENDING → CONFIRMED → ASSISTANT_ASSIGNED → ON_THE_WAY → ARRIVED → COLLECTED → PROCESSING → COMPLETED
                                                                              ↘ RESCHEDULED
                                          (any of the above) → CANCELLED / NO_SHOW
```

Every booking response includes a computed `timeline` array — **always render from this, never compute it client-side**:

```json
"timeline": [
  { "label": "Booked",           "state": "done" },
  { "label": "Confirmed",        "state": "done" },
  { "label": "On the way",       "state": "active" },
  { "label": "Sample collected", "state": "pending" },
  { "label": "Processing",       "state": "pending" },
  { "label": "Report ready",     "state": "pending" }
]
```

`state` is one of `done` / `active` / `pending`; a `CANCELLED` or `NO_SHOW` booking has every step `pending` except the current one shows as the terminal state — check `booking.status` directly for those two, don't infer from `timeline`.

Status → UI copy mapping:

| Backend status         | Suggested label              |
|-------------------------|-------------------------------|
| `PENDING`               | "Pending lab confirmation"   |
| `CONFIRMED`              | "Confirmed"                  |
| `ASSISTANT_ASSIGNED`     | "Assistant assigned"         |
| `ON_THE_WAY`             | "On the way"                 |
| `ARRIVED`                | "Assistant has arrived"      |
| `COLLECTED`              | "Sample collected"           |
| `PROCESSING`             | "Processing"                 |
| `COMPLETED`              | "Report ready"                |
| `RESCHEDULED`            | "Rescheduled"                |
| `NO_SHOW`                | "No-show"                    |
| `CANCELLED`              | Use `cancelReason` (see `cancelBy`: `CUSTOMER`/`LAB`/`SYSTEM` to phrase "Cancelled by you" vs "Cancelled by lab" vs a system auto-cancel) |

Every status change is now audit-logged — see `GET /bookings/:id/events` in §2.6.

---

## 2. Customer app flows

### 2.1 Onboarding (email + password)

#### Register (customer)

```
POST /api/auth/register
{
  "name":     "Asha Rao",
  "email":    "asha@labzy.in",
  "password": "atLeast6Chars",
  "phone":    "+919999990000",       // optional, contact-only — never used for OTP
  "deviceId":    "a1b2c3-uuid",      // recommended: persist per-install
  "deviceLabel": "Asha's iPhone 15",
  "gender":    "female",             // optional
  "birthDate": "1992-04-15",         // optional — under-18 customers are rejected (400)
  "consents": [
    { "kind": "TOS",            "given": true, "version": "1.0" },
    { "kind": "PRIVACY",        "given": true, "version": "1.0" },
    { "kind": "HEALTH_RECORDS", "given": true, "version": "1.0" },
    { "kind": "MARKETING",      "given": false }
  ]
}
→ 201 {
    "accessToken":  "...",
    "refreshToken": "...",
    "user": { "id":"...", "name":"Asha Rao", "email":"asha@labzy.in", "phone":"+91...", "roles":["CUSTOMER"] }
  }

Errors:
 409 CONFLICT          — email already in use
 400 VALIDATION_ERROR  — name < 2 chars, email malformed, password < 6 chars,
                          missing a required consent (TOS/PRIVACY/HEALTH_RECORDS — MARKETING is optional),
                          or birthDate implies age < 18
```

To register a partner from a separate signup screen, send `"role": "LAB_OWNER"` in the same payload (consents/age-gate are customer-only checks and are skipped for `LAB_OWNER`).

If a logged-in user needs to record/update consents later (e.g. re-consenting after a ToS version bump), use:
```
POST /api/auth/consents
Authorization: Bearer <accessToken>
{ "consents": [{ "kind":"TOS", "given":true, "version":"1.1" }] }
→ 200 { "recorded": 1 }
```

#### Login

```
POST /api/auth/login
{ "email":"asha@labzy.in", "password":"atLeast6Chars", "deviceId":"a1b2c3-uuid", "deviceLabel":"Asha's iPhone 15" }
→ 200 {
    "accessToken":  "...",
    "refreshToken": "...",
    "user": { "id":"...", "name":"Asha Rao", "email":"asha@labzy.in", "roles":["CUSTOMER"] }
  }

Errors:
 401 UNAUTHORIZED — wrong email or password (intentionally generic — don't leak which)
```

Logging in from a 4th device silently evicts the oldest of the user's existing 3 sessions — no error, no warning needed in the UI (this is expected background behavior, not a user-facing event).

#### Refresh tokens

```
POST /api/auth/refresh
{ "refreshToken": "...", "deviceId": "a1b2c3-uuid" }
→ 200 { "accessToken": "...", "refreshToken": "..." }
```

The old refresh token is invalidated on success — store only the new pair. Always send the same `deviceId` you used at login.

#### Logout

```
POST /api/auth/logout
Authorization: Bearer <accessToken>
{ "refreshToken": "..." }              // optional — omit to log out ALL devices
→ 200 { "message": "Logged out successfully" }
```

A "Log out of all devices" settings option should call this with no body.

#### Forgot / reset password

```
POST /api/auth/forgot-password
{ "email":"asha@labzy.in" }
→ 200 { "message": "If that email exists, a reset link was sent" }
```

This always returns 200 regardless of whether the email is registered — that's deliberate, to avoid leaking which emails exist. The user clicks the link in the email, which deep-links to a reset screen the app implements with the token from the URL.

```
POST /api/auth/reset-password/:token
{ "newPassword":"newAtLeast6Chars" }
→ 200 { "message": "Password reset successfully" }

Errors:
 400 VALIDATION_ERROR — token invalid or expired (1 hour TTL)
```

### 2.2 Location + profile

#### Get current user

```
GET /api/me
→ 200 { "user": {
   "id":"...", "name":"Asha Rao", "phone":"+91...", "email":null,
   "roles":["CUSTOMER"], "addresses":[{...}], "dependents":[{...}],
   "location":{ "type":"Point", "coordinates":[77.64, 12.97] },
   "isVerified":true, "deletionScheduledAt": null
} }
```

`deletionScheduledAt` is non-null only if the user has requested account deletion (§2.2a) — show a persistent banner ("Your account will be deleted on {date}. Undo?") when it's set.

#### Update profile (name / fcmToken / gender / birthDate)

```
PUT /api/profile
{ "name":"Asha Rao", "fcmToken":"...", "gender":"female", "birthDate":"1992-04-15" }
→ 200 { "user": {...} }
```

#### Address book

```
GET    /api/me            (addresses come back inside user)
POST   /api/addresses     body: { label, line1, line2, city, state, zipCode, country? }
PUT    /api/addresses/:id
DELETE /api/addresses/:id
```

All return `{ "addresses": [...] }` so the client can re-render the saved-addresses list with one assign.

#### Set current location (used by Home chip "Indiranagar")

```
POST /api/location
{ "address":"Indiranagar, Bengaluru" }     // OR
{ "latitude":12.97, "longitude":77.64 }
→ 200 { "user": {...}, "resolvedAddress":"Indiranagar, Bengaluru, KA" }
```

### 2.2a Account deletion (Settings → Delete account)

```
DELETE /api/me
Authorization: Bearer <accessToken>
→ 200 { "deletionScheduledAt": "2026-08-16T00:00:00.000Z" }
```

This immediately logs the user out on **every** device (all sessions dropped) — after this call, the current app instance should treat itself as logged out too (clear local tokens, navigate to onboarding), even though the account isn't deleted yet. The account enters a 30-day grace period; the user can still log back in during that window (email+password still works) and undo:

```
POST /api/me/restore
Authorization: Bearer <accessToken>
→ 200 { "message": "Account deletion cancelled" }

Errors:
 400 VALIDATION_ERROR — no deletion was scheduled, or the 30-day grace period already elapsed (irreversible past that point)
```

Show the restore option prominently if `GET /api/me`'s `deletionScheduledAt` is set and still in the future.

### 2.3 Home screen

The Home screen makes 3–4 parallel calls on mount.

#### Banners + categories (CMS)

```
GET /api/content/home_banners
→ 200 { "payload": [
   { "tag":"Flash deal · Today only", "h":"50% OFF", "sub":"On all health packages",
     "cta":"Book now", "ctaC":"#0C6055", "g":"linear-gradient(125deg,#107A6C,#1DB69F)" }, ...
] }

GET /api/content/home_categories
→ 200 { "payload": [
   { "key":"blood",    "label":"Blood Test", "icon":"droplet", "bg":"#FEF2F2", "color":"#DC2626" }, ...
] }
```

Cache for 5 minutes; expect `Cache-Control: public, max-age=300`.

#### Search bar (tests + labs in one query)

```
GET /api/tests?q=lipid&minPrice=100&maxPrice=900&page=1&limit=20
→ 200 { "tests":[{...}], "total":12, "page":1, "limit":20, "pages":1 }

GET /api/labs?search=healthfirst&page=1&limit=10
→ 200 { "labs":[{...}], "total":3, ... }
```

#### Health packages strip

```
GET /api/packages?category=Diabetes&page=1&limit=10
→ 200 { "packages":[{
   "_id":"...", "name":"Diabetes Panel", "slug":"diabetes-panel",
   "category":"Diabetes", "icon":"zap",
   "tests":[{ "_id":"...", "name":"HbA1c", "price":449 }, ...],
   "price":649, "sumOfTests":898, "savings":249
}], ... }
```

`savings` is `sumOfTests - price` (floored at 0), computed server-side on both the list and `GET /api/packages/:slug` (note: fetched by `slug`, not `_id` — returns `{ "package": {...} }`) — render it as "Save ₹249" rather than computing it client-side.

#### Nearby labs (relevance search)

```
GET /api/labs/nearby?lat=12.97&lng=77.64&radius=5000&minRating=4.0&sortBy=relevance&q=sugar
→ 200 { "labs":[{
   "_id":"...", "name":"HealthFirst Diagnostics",
   "rating":4.8, "totalRatings":1247,
   "address":{ "line1":"...", "city":"Bengaluru" },
   "location":{ "type":"Point", "coordinates":[77.64,12.97] },
   "certifications":["NABL"], "isVerified":true,
   "distanceMeters": 812
}], "count":3 }
```

`sortBy` is `relevance` (default — a distance+rating blend), `distance`, or `rating`. `q` (optional) filters to labs offering a test matching the term **or one of its synonyms** (e.g. `q=sugar` also matches "Fasting Blood Glucose" tests — synonym expansion is server-side and admin-configurable, don't try to replicate it client-side). Note this endpoint returns `{ labs, count }`, not the standard pagination envelope — see §1.4.

**Note:** `GET /labs/nearby` results are plain objects (not full Mongoose documents) due to the relevance-scoring aggregation — this only matters if you're diffing raw shapes; every documented field above is present and typed normally in JSON.

#### Recent searches ("Recently viewed" chips)

```
GET /api/me/recent-searches
→ 200 { "searches": [
   { "_id":"...", "kind":"LAB", "value":"HealthFirst Diagnostics", "ref":"<labId>", "createdAt":"..." },
   { "_id":"...", "kind":"QUERY", "value":"lipid profile", "createdAt":"..." }
]}

POST /api/me/recent-searches
{ "kind":"LAB", "value":"HealthFirst Diagnostics", "ref":"<labId>" }   // kind: LAB|TEST|PACKAGE|QUERY, ref optional
→ 201 { "search": {...} }
```

Call `POST` whenever the user taps into a lab/test/package detail screen or submits a free-text search — capped server-side at 20 per user (oldest silently evicted), no client-side management needed.

#### "Notify me when a lab joins nearby" (empty-state action)

```
POST /api/me/lab-watches
{ "lat":12.97, "lng":77.64, "radiusMeters":5000 }
→ 201 { "watch": { "_id":"...", "radiusMeters":5000, "notifiedAt":null } }
```

Show this as an action on the "No labs found nearby" empty state. The user gets a push/WS notification (`LAB_JOINED_NEARBY`, see §2.9/§4.2) the first time a lab activates within that radius — it fires once per watch, not repeatedly.

#### Banner card "Report ready" (Home top)

The dark-teal card uses the latest **COMPLETED** booking. Reuse the bookings list:
```
GET /api/bookings?status=COMPLETED&limit=1
→ 200 { "bookings":[{ "code":"LBZ-48104", "status":"COMPLETED", "reports":[{...}], ... }] }
```

#### Notifications bell

```
GET /api/notifications/unread-count
→ 200 { "unread": 1 }
```
Display a red dot when `unread > 0`. Tap → push to the Notifications screen (§ 2.9).

### 2.4 Lab detail screen

#### Lab profile

```
GET /api/labs/:id
→ 200 { "lab": { "_id":"...", "name":"HealthFirst Diagnostics",
  "rating":4.8, "totalRatings":1247, "certifications":["NABL"],
  "address":{...}, "phone":"+91...", "openingHours":{ "monday":{...} },
  "slotMatrix":{ "duration":30, "intervalMinutes":30, "maxBookingsPerSlot":3 },
  "photos":[{ "url":"https://...", "caption":"Reception" }, ...],
  "description":"NABL-accredited diagnostics center serving Bengaluru since 2015.",
  "amenities":["Parking","Wheelchair accessible","AC waiting area"],
  "ratingDistribution": { "1":2, "2":3, "3":10, "4":80, "5":420 }
}}
```

`ratingDistribution` is a count per star rating (1–5) across every review on this lab — render it as the horizontal bar breakdown under the average-rating headline.

#### Tests offered by this lab

```
GET /api/labs/:id/tests
→ 200 { "tests": [{ "_id":"...", "name":"Lipid Profile", "category":"Blood",
  "price":549, "description":"8 parameters · fasting serum",
  "plainLanguageDescription":"A simple blood test that checks your cholesterol levels.",
  "turnaroundHours":6, "fastingHours":10, "sampleType":"Blood",
  "isActive":true }, ...] }
```

`plainLanguageDescription` is the customer-facing copy (use this over `description`, which is more clinical); `fastingHours` and `sampleType` drive the prep-instructions card ("Fast for 10 hours before your blood draw").

The frontend overlays `mrp` (display-only strikethrough) from the `HealthPackage` or a fixed +30% rule — the test model does not store MRP.

#### Slots for a date

```
GET /api/labs/:id/slots?date=2026-06-15
→ 200 { "date":"2026-06-15", "slots":[
   { "start":"06:30", "end":"07:00", "available":true,  "booked":0, "capacity":3 },
   { "start":"07:00", "end":"07:30", "available":false, "booked":3, "capacity":3 },
   ...
]}
```

Render only slots where `available === true` as tappable; the rest are visually disabled.

#### Reviews (preview on lab detail; full screen optional)

```
GET /api/labs/:id/reviews?page=1&limit=10
→ 200 { "reviews":[{ "rating":5, "comment":"Quick & clean", "user":{ "name":"Ravi K." },
   "createdAt":"2026-05-22T..." }, ...], "total":1247 }
```

### 2.5 Booking creation

#### Create

```
POST /api/bookings
Authorization: Bearer <accessToken>
{
  "labId":"...",
  "testIds":["...","..."],            // OR "packageId":"..."
  "scheduledDate":"2026-06-15",
  "slot": { "start":"07:00" },
  "collectionType":"HOME",            // "HOME" | "IN_LAB"
  "userAddressId":"...",              // required when collectionType === "HOME"
  "dependentId":"...",                // optional — book for a family member
  "paymentMethod":"ONLINE"            // "ONLINE" | "PAY_AT_LAB"
}
→ 201 { "booking": {
   "_id":"...", "code":"LBZ-48291", "status":"PENDING",
   "scheduledDate":"2026-06-15T00:00:00.000Z",
   "slot":{ "start":"07:00", "end":"07:30" },
   "totalAmount":848, "homeCollectionFee":50, "collectionType":"HOME",
   "slotHoldExpiry":"2026-06-15T07:10:00.000Z",
   "timeline":[
     {"label":"Booked","state":"active"},
     {"label":"Confirmed","state":"pending"},
     {"label":"On the way","state":"pending"},
     {"label":"Sample collected","state":"pending"},
     {"label":"Processing","state":"pending"},
     {"label":"Report ready","state":"pending"}
   ]
} }
```

The slot hold is now **10 minutes** (was 15) — if `paymentMethod: "ONLINE"`, get the customer to the payment sheet promptly; show a countdown from `slotHoldExpiry` if payment is delayed. `homeCollectionFee` is non-zero only for `collectionType: "HOME"` bookings on labs that charge one (some labs waive it above a minimum order value — this is all resolved server-side, just render the field if present).

Possible failures:
- `409 SLOT_UNAVAILABLE` — show toast "This slot just filled up. Pick another time."
- `422 LAB_CLOSED`        — show inline form error.
- `400 VALIDATION_ERROR`  — at least one test isn't valid for this lab.

#### Payment intent (only when `paymentMethod: "ONLINE"`)

```
POST /api/bookings/:id/payment-intent
→ 200 { "providerOrderId":"order_...", "amount":848, "currency":"INR",
       "key":"rzp_test_..." }
```

Hand `providerOrderId` + `key` to the Razorpay JS/Android SDK. On success, the SDK posts to Razorpay's webhook (configured in dashboard) — backend confirms the booking, generates an invoice (§2.11), and broadcasts a `BOOKING_STATUS` event. The client should:

1. Optimistically navigate to the Bookings tab with a "Booking confirmed" banner.
2. Listen on the WebSocket for `BOOKING_STATUS` with `data.bookingId === booking._id` and `status === 'CONFIRMED'`.
3. If not received in 30 s, poll `GET /api/bookings/:id` once.

For `PAY_AT_LAB`, skip steps 1-3; the partner confirms via Accept.

### 2.6 Bookings tab

#### List

```
GET /api/bookings?status=PENDING&page=1&limit=20         (status optional — any of the 11 states in §1.6)
→ 200 { "bookings":[{
   "_id":"...", "code":"LBZ-48291",
   "lab":{ "_id":"...", "name":"HealthFirst Diagnostics", "address":{...} },
   "tests":[{ "_id":"...", "name":"Lipid Profile", "price":549 }, ...],
   "status":"ON_THE_WAY",
   "scheduledDate":"2026-06-15T00:00:00.000Z",
   "slot":{ "start":"07:00", "end":"07:30" },
   "collectionType":"HOME",
   "totalAmount":848,
   "labAssistant":{ "name":"Ravi P.", "phone":"+91..." },
   "timeline":[ ... see §1.6 ... ]
 }, ...], "total":12, "page":1, "limit":20 }
```

See §1.6 for the status → label mapping table (now 11 states) and how to read `timeline`.

#### Detail (lab phone, assistant info, reports)

```
GET /api/bookings/:id
→ 200 { "booking":{
   ..., "lab":{ "...", "phone":"+91..." },
   "labAssistant":{ "name":"Ravi P.", "phone":"+91..." },   // null until ASSISTANT_ASSIGNED
   "reports":[{ "test":"<testId>", "report":{ "_id":"...", "issuedAt":"..." } }]  // populated per-test as reports land
} }
```

`reports` is now an **array** — a multi-test booking gets partial reports as they're ready (e.g. one test's report can be `COMPLETED` while another test is still `PROCESSING` — the booking as a whole only flips to `COMPLETED` once every test has a report). Use `GET /bookings/:id/report` (below) to get signed download URLs for all accessible reports at once, rather than trying to resolve `reports[].report` yourself.

#### Booking event history ("What happened" / audit trail)

```
GET /api/bookings/:id/events
→ 200 { "events": [
   { "fromStatus":"PENDING", "toStatus":"CONFIRMED", "actorType":"LAB_OWNER", "createdAt":"..." },
   { "fromStatus":"CONFIRMED", "toStatus":"ASSISTANT_ASSIGNED", "actorType":"LAB_OWNER", "createdAt":"..." },
   { "fromStatus":"ASSISTANT_ASSIGNED", "toStatus":"ON_THE_WAY", "actorType":"LAB_ASSISTANT", "createdAt":"..." }
]}
```

Useful for a "booking history" expandable section or for support/debugging views — not required for the primary booking-status UI (use `timeline` for that).

#### Cancel

```
POST /api/bookings/:id/cancel
{ "reason":"Travelling" }       // optional
→ 200 { "booking": { "...", "status":"CANCELLED", "cancelBy":"CUSTOMER", "cancelReason":"Travelling" } }
```

A 409 means the booking is past the cancellable stage — disable the button. If the lab has a configured cancellation fee and you're inside the cutoff window, the call still succeeds (200) but `cancelReason` gets a fee note appended — see §1.3's note on `CANCELLATION_FEE_APPLICABLE`.

#### Reschedule

```
POST /api/bookings/:id/reschedule
{ "scheduledDate":"2026-06-18", "slot":{ "start":"08:30" } }
→ 200 { "booking": { ..., "scheduledDate":"...", "slot":{...}, "rescheduleCount":1 } }
```

Possible failures:
- `409 SLOT_UNAVAILABLE` (new slot full)
- `409 INVALID_BOOKING_TRANSITION` (already collected; can only reschedule PENDING/CONFIRMED)
- `409 RESCHEDULE_CUTOFF_PASSED` — too close to the current slot time (lab-configured cutoff, default 4h before). Show "Too close to your appointment — try cancelling instead."
- `409 RESCHEDULE_LIMIT_REACHED` — the booking has already been rescheduled the lab's configured max number of times (default 2). Disable the Reschedule button once `rescheduleCount` reaches this (you won't know the lab's exact limit client-side without a lookup, so just handle the 409 gracefully rather than trying to pre-disable based on a guessed threshold).

#### "Call lab" / "Call assistant"

These are pure native calls — `tel:` URI from `lab.phone` or `booking.labAssistant.phone`. No backend hit. (A masked-calling feature exists as a backend stub — see §2.6a — but it is not yet wired to a real telephony provider; keep using direct `tel:` links for now.)

### 2.6a Sample-collection visit: OTP, notes, masked call

Once a booking reaches `ASSISTANT_ASSIGNED`, a 4-digit visit OTP is generated server-side. The customer reads this OTP out loud (or shows it) to the assistant on arrival — the assistant enters it in their app to confirm they're at the right address before marking the sample collected.

```
GET /api/bookings/:id/visit-otp
→ 200 { "otp": "4821" }

Errors:
 404 NOT_FOUND — no assistant assigned yet (OTP doesn't exist until ASSISTANT_ASSIGNED)
```

Show this prominently once the booking status is `ASSISTANT_ASSIGNED` or later (e.g. a large centered 4-digit display, "Share this code with your collection agent on arrival").

```
POST /api/bookings/:id/visit-notes
{ "notes": "Gate code 4521, ring twice" }
→ 200 { "booking": { ..., "visitNotes": "Gate code 4521, ring twice" } }
```

Expose this as a free-text field during/after booking creation for `HOME` collections — think "Delivery instructions."

```
POST /api/bookings/:id/calls/connect
{ "side": "customer" }        // or "lab" — which side is initiating
→ 200 { "callId": "stub_...", "virtualNumber": "+910000000000" }
```

**Masked calling is currently a non-functional stub** — it returns a fake call ID and a placeholder number, it does not place a real call. Do not build the "connect call" UI around this endpoint expecting a working phone bridge yet; if/when a real telephony provider is wired up server-side, this doc will be updated and the response shape will stay the same (just backed by a real provider). For now, keep the "Call lab"/"Call assistant" buttons on direct `tel:` links (§2.6).

### 2.7 Reports tab

#### List

```
GET /api/bookings?status=COMPLETED&page=1&limit=20
→ same shape as Bookings list; render `lab.name`, `tests[0].name`, formatted date.
```

For "Pending" tab, query `?status=PROCESSING`. For "All", omit `status`.

#### Inline result table (expand row)

```
GET /api/bookings/:id/report
→ 200 {
   "reports": [
     {
       "testId": "<testId>",
       "signedUrl": "https://storage.googleapis.com/...",   // PDF download (expires in 15 min)
       "issuedAt": "2026-06-15T14:02:11.330Z",
       "parameters": [
         { "name":"Total cholesterol", "value":"186", "unit":"mg/dL", "refLow":null, "refHigh":200, "flag":"NORMAL" },
         { "name":"LDL", "value":"128", "unit":"mg/dL", "refHigh":100, "flag":"HIGH" }
       ]
     }
   ]
}
```

**This response shape changed** — it's now `{ reports: [...] }` (one entry per test with an accessible report), not a single flat object. A multi-test booking can have multiple entries here; group them by `testId` and render one expandable result table per test. A report a lab has since replaced (see §3.4) is automatically excluded — only the current/latest version per test appears.

Render rule per parameter (matches PatientReports.jsx):
- `flag === "HIGH"`  → mono red with " ↑"
- `flag === "LOW"`   → mono red with " ↓"
- otherwise          → mono primary

Download button → open `signedUrl` (it's short-lived; refetch if expired).

#### "Remind me to re-test in 3 months" toggle

```
POST /api/reports/:reportId/retest-reminder
{ "intervalDays": 90 }                  // 30/60/90 from preset
→ 200 { "remindRetestAt":"2026-09-13T..." }
```
Toggling off → POST with `intervalDays: 0` (backend treats as clear). Note `reportId` here is a specific `Report._id`, not a booking id — get it from a `reports[]` entry above (each `Report` document has its own `_id`, not shown in the `/report` response above but available via `GET /bookings/:id` → `booking.reports[].report._id` when populated).

### 2.8 Subscriptions (recurring tests)

Subscriptions now run occurrence-by-occurrence with slot intelligence (auto-shifts to the nearest available slot within your preferred time window, across up to 3 days) and an optional per-occurrence approval step.

```
POST /api/subscriptions
{
  "labId":"...", "testId":"...", "frequency":"MONTHLY",      // "WEEKLY"|"MONTHLY"|"CUSTOM"
  "customIntervalDays":30,                                   // only when CUSTOM
  "autoPayment":true,
  "startDate":"2026-07-01"
}
→ 201 { "subscription": { "_id":"...", "status":"ACTIVE",
   "frequency":"MONTHLY", "nextBookingDate":"2026-07-01T...",
   "approvalMode":"APPROVE_EACH_TIME",                        // default — see below
   "preferredTimeWindow": { "start":"09:00", "end":"12:00" } } }

GET    /api/subscriptions               → list
GET    /api/subscriptions/:id
PUT    /api/subscriptions/:id           body: { frequency?, customIntervalDays?, autoPayment? }
POST   /api/subscriptions/:id/pause     → status: PAUSED
POST   /api/subscriptions/:id/resume    → status: ACTIVE, next date recomputed
POST   /api/subscriptions/:id/cancel    → status: CANCELLED
```

New endpoints:

```
POST /api/subscriptions/:id/skip-next
→ 200 { "subscription": {...} }         // skips the upcoming occurrence, advances nextBookingDate

POST /api/subscriptions/:id/pause-until
{ "until": "2026-08-01" }
→ 200 { "subscription": { "status":"PAUSED", "pauseUntil":"2026-08-01T..." } }

GET /api/subscriptions/:id/occurrences
→ 200 { "occurrences": [
   { "_id":"...", "scheduledFor":"...", "state":"BOOKED", "booking":"<bookingId>" },
   { "_id":"...", "scheduledFor":"...", "state":"SKIPPED", "reason":"Skipped by user" },
   { "_id":"...", "scheduledFor":"...", "state":"AWAITING_APPROVAL" }
]}                                       // full occurrence history — good for a "subscription activity" screen

POST /api/subscription-occurrences/:occId/approve
→ 200 { "occurrence": { "state":"BOOKED", "booking":"<bookingId>" } }

Errors:
 409 SLOT_UNAVAILABLE — no slot found in the preferred window; occurrence flips to NO_SLOT server-side
```

**Approval flow**: if `approvalMode` is `APPROVE_EACH_TIME` (the default), the backend creates an `AWAITING_APPROVAL` occurrence a few days before `nextBookingDate` and sends a `SUBSCRIPTION_AWAITING_APPROVAL` notification (§2.9/§4.2) instead of auto-booking. The user must call the approve endpoint above to actually reserve the slot. There's no explicit `AUTO_PAY` toggle endpoint yet in this build — `approvalMode` is currently fixed at creation-time default; treat it as informational for now rather than building a settings toggle for it.

Two consecutive failed payments on a subscription auto-pause it — the user gets a `SUBSCRIPTION_PAUSED_PAYMENT` notification and the subscription's `status` flips to `PAUSED`; surface a "Update payment method" CTA when you see that event.

### 2.9 Notifications

```
GET  /api/notifications?page=1&limit=20
→ 200 { "items":[{
    "_id":"...", "event":"BOOKING_STATUS",
    "title":"Report ready", "body":"Your report is ready to view.",
    "data":{ "bookingId":"...", "status":"COMPLETED" },
    "readAt":null, "createdAt":"..."
}], "total":12, "unread":1, "page":1, "limit":20 }

POST /api/notifications/:id/read       → { "_id":"...", "readAt":"..." }
POST /api/notifications/read-all       → { "matched":12, "modified":7 }
GET  /api/notifications/unread-count   → { "unread":1 }
```

See §4.2 for the full `event` catalog (now includes subscription, lab-watch, account-deletion, and report-replacement events alongside the original booking/payment ones).

### 2.10 Family members / dependents

```
GET    /api/me/dependents              → { "dependents":[{ "_id":"...","name":"Ravi","relation":"father", ... }] }
POST   /api/me/dependents              body: { name, relation, gender?, birthDate? }
PUT    /api/me/dependents/:id
DELETE /api/me/dependents/:id
```

`dependentId` is passed into `POST /api/bookings`. The booking response carries the patient snapshot at `booking.patient`.

### 2.11 Payments, invoices & refunds

```
GET /api/me/payments
→ 200 { "invoices": [{ "_id":"...", "number":"LBZ-INV-2026-000042",
           "lines":[{ "description":"Lipid Profile","amount":549,"qty":1 }],
           "subtotal":549, "total":549, "pdfUri":"invoices/LBZ-INV-2026-000042.pdf" }],
         "transactions": [{ "_id":"...", "amount":848, "status":"CAPTURED", "provider":"RAZORPAY" }],
         "refunds": [{ "_id":"...", "amount":848, "state":"INITIATED", "reason":"Cancelled by customer" }] }
```

This is the "Payment history" screen's single data source — render three sections (Invoices / Transactions / Refunds) or merge/sort them by `createdAt` into one activity feed, whichever fits the design better.

```
GET /api/invoices/:id
→ 200 { "invoice": {...}, "signedUrl": "https://storage.googleapis.com/..." | null }
```

`signedUrl` can be `null` if the PDF hasn't been generated yet (a rare backend-storage edge case) — fall back to rendering the invoice's `lines`/`total` from the `invoice` object itself rather than showing a broken download link when it's null.

```
POST /api/bookings/:id/refund
{ "reason": "Cancelled before collection" }               // full refund of the captured amount
{ "testIds": ["<testId>"], "reason": "Partial cancel" }   // partial refund — only these tests' price
→ 201 { "refund": { "_id":"...", "amount":549, "state":"INITIATED", "expectedAt":"2026-06-20T..." } }

Errors:
 404 NOT_FOUND — no captured payment exists for this booking to refund
 400 VALIDATION_ERROR — requested refund amount would exceed what's left refundable on this booking
```

Refund `state` progresses `INITIATED → PROCESSED → CREDITED` (or `FAILED`) — there's no customer-facing "cancel a refund" action; render it as a read-only status chip. `expectedAt` is a rough ETA (5 days from initiation in this build) — show it as "Expected by {date}", not a guarantee.

**Double-payment protection**: if a booking somehow gets charged twice (e.g. a flaky client retry), the backend auto-detects the duplicate capture and automatically issues a refund for it — no customer action needed, but you may see a `Refund` with `reason: "duplicate payment"` appear in the payment history without the customer having requested one. That's expected/correct behavior, not a bug to report.

### 2.12 Help & support tickets

```
POST /api/tickets
{ "bookingId":"...", "category":"REPORT_ISSUE", "subject":"Wrong test on my report", "message":"..." }
→ 201 { "ticket": { "_id":"...", "state":"OPEN", "priority":"HIGH", ... } }
```

`category` is one of `DELAY`, `REFUND`, `REPORT_ISSUE`, `ASSISTANT_BEHAVIOR`, `PAYMENT`, `SAFETY`, `OTHER`. `bookingId` is optional (omit for general support). `priority` is set automatically server-side — `HIGH` for `REFUND`/`REPORT_ISSUE`/`SAFETY`/`PAYMENT`, `NORMAL` otherwise; don't expose a manual priority picker.

```
GET /api/tickets?state=OPEN&page=1&limit=20        → { "tickets":[...], "total":..., "page":..., "limit":... }
GET /api/tickets/:id                                → { "ticket": {...} }   (includes the full messages[] thread)

POST /api/tickets/:id/messages
{ "text": "Any update on this?", "attachments": [{ "uri": "..." }] }
→ 200 { "ticket": {...} }                            // appends to the thread; OPEN tickets flip to IN_PROGRESS

POST /api/tickets/:id/reopen
→ 200 { "ticket": { "state":"OPEN" } }

Errors:
 400 VALIDATION_ERROR — ticket isn't RESOLVED, or it's been more than 7 days since it was resolved
```

Render `ticket.messages[]` as a chat-style thread; `fromRole` is `CUSTOMER` or `SUPPORT`. Show the "Reopen" action only when `state === 'RESOLVED'` and it's been under 7 days (you can compute this client-side from `resolvedAt` for UI purposes, but always let the actual button tap hit the endpoint and handle the 400 gracefully in case of clock skew).

---

## 3. Partner app flows

### 3.1 Login

```
POST /api/auth/login
{ "email":"owner@healthfirst.in", "password":"..." }
→ 200 { "accessToken", "refreshToken", "user":{ "roles":["LAB_OWNER"] } }
```

Same email+password mechanics, session cap, and refresh flow as the customer app — see §1.2 and §2.1. (Lab Assistant login uses the same endpoint too, with `roles: ["LAB_ASSISTANT"]` — see §3.7 — though bulk assistant account creation by the owner isn't built yet in this phase; assistant `User`/`LabAssistant` records currently need to be created via `POST /partner/assistants`, see §3.5.)

### 3.2 Today screen

```
GET /api/partner/today
Authorization: Bearer <accessToken>
→ 200 {
   "lab":{ "id":"...", "name":"HealthFirst Diagnostics" },
   "stats":{ "total":18, "pending":3, "inProgress":11, "done":4 },
   "requests":[{
      "_id":"...", "code":"LBZ-48291",
      "user":{ "name":"Asha Rao", "phone":"+91..." },
      "tests":[{ "name":"Lipid Profile", "price":549 }, ...],
      "collectionType":"HOME",
      "slot":{ "start":"07:00", "end":"07:30" },
      "totalAmount":848
   }]
}
```

Accept / decline:

```
POST /api/partner/bookings/:id/accept           → 200 { "booking":{ "status":"CONFIRMED" } }
POST /api/partner/bookings/:id/reject
{ "reason":"Out-of-area home collection" }      → 200 { "booking":{ "status":"CANCELLED", "cancelBy":"LAB" } }
```

### 3.3 Orders screen (advance stage)

```
GET /api/partner/bookings?status=CONFIRMED&page=1&limit=20
GET /api/partner/bookings?status=ASSISTANT_ASSIGNED&page=1&limit=20
GET /api/partner/bookings?status=ON_THE_WAY&page=1&limit=20
GET /api/partner/bookings?status=ARRIVED&page=1&limit=20
GET /api/partner/bookings?status=COLLECTED&page=1&limit=20
GET /api/partner/bookings?status=PROCESSING&page=1&limit=20
```

> Note: `GET /api/partner/bookings`'s `status` filter enum on this route hasn't been widened to the full 11-value set yet in this build (it still only accepts the original 6: `PENDING/CONFIRMED/COLLECTED/PROCESSING/COMPLETED/CANCELLED`). Filtering by `ASSISTANT_ASSIGNED`, `ON_THE_WAY`, `ARRIVED`, `RESCHEDULED`, or `NO_SHOW` will currently be rejected by schema validation (400) — this is a known gap flagged during Phase 1 review, likely to be fixed early in Phase 2. Until then, fetch by the accepted statuses and/or `status`-omitted (returns all) and filter client-side for the newer intermediate states if you need them in a partner list view.

UI stage → backend action:

| Card shows           | Button label              | Endpoint                                              |
|-----------------------|----------------------------|---------------------------------------------------------|
| Stage `booked`        | "Assign assistant"        | `POST /api/partner/bookings/:id/reassign`             |
| Stage `assigned`      | (assistant self-serves via their app — see §3.7) | n/a                              |
| Stage `sampled`       | "Start processing"        | `POST /api/partner/bookings/:id/mark-processing`      |
| Stage `processing`    | "Upload report"           | `POST /api/partner/bookings/:id/report` (link doc)    |
| Stage `ready`         | — (display "Delivered")   | n/a                                                     |

`POST /api/partner/bookings/:id/mark-collected` still exists and works (`CONFIRMED → COLLECTED` directly) for labs/flows that don't use the assistant-assignment/visit-OTP path — the assistant-mediated path (`ASSISTANT_ASSIGNED → ON_THE_WAY → ARRIVED → COLLECTED`, via visit-OTP verification, §3.7) is additive, not a replacement.

#### Assign assistant

```
POST /api/partner/bookings/:id/reassign
{ "assistantId":"..." }
→ 200 { "booking":{ "labAssistant":"...", "status":"ASSISTANT_ASSIGNED", "visitOtp":"4821" } }
```

This also generates the customer-facing visit OTP (§2.6a) the first time it's called for a booking, and (if the booking was `CONFIRMED`) advances its status to `ASSISTANT_ASSIGNED`. Calling it again to re-assign a different assistant to the same booking does NOT regenerate the OTP (it stays stable for that booking) and does not re-trigger the status transition if already past `CONFIRMED`.

### 3.4 Report upload (multipart) + replace + TAT board

```
POST /api/partner/reports/upload
Content-Type: multipart/form-data
fields:
   file        : <pdf binary> (≤ 10 MB)
   bookingId   : "<bookingId>"
→ 200 { "uri":"reports/<bookingId>/<ts>.pdf", "checksum":"sha256:..." }

POST /api/partner/bookings/:id/report
{
  "uri":"reports/.../1729...pdf",
  "checksum":"sha256:...",
  "testId":"...",                                  // optional — defaults to first test; REQUIRED for multi-test bookings, see below
  "parameters":[                                    // optional — drives PatientReports inline table
    { "name":"Total cholesterol", "value":"186", "unit":"mg/dL", "refHigh":200, "flag":"NORMAL" },
    { "name":"LDL", "value":"128", "unit":"mg/dL", "refHigh":100, "flag":"HIGH" }
  ]
}
→ 201 { "report":{ "_id":"...", "issuedAt":"..." } }
```

**Multi-test bookings now get per-test reports.** Always pass `testId` explicitly when a booking has more than one test — omitting it links the report to the booking's first test only, which is almost never what you want for a multi-test order. The booking's overall `status` only advances to `COMPLETED` once every one of its tests has a linked report; until then it stays `PROCESSING` even with 1 of N reports in. Build the partner-side "upload report" UI as a per-test action (one upload button per test row on a multi-test booking), not a single booking-level button, once a booking has 2+ tests.

#### Replace a report (correction, with mandatory reason)

```
PUT /api/partner/bookings/:id/reports/:reportId
{
  "uri":"reports/.../corrected.pdf", "checksum":"sha256:...", "reason":"Transcription error in LDL value",
  "parameters":[...]
}
→ 200 { "report": { "_id":"...(new)...", "issuedAt":"..." } }

Errors:
 400 VALIDATION_ERROR — reason is missing/empty
 404 NOT_FOUND — report doesn't exist, or doesn't belong to a booking owned by this lab
```

The **old** report becomes permanently inaccessible to the customer the moment this succeeds (it's excluded from `GET /bookings/:id/report`, §2.7) — there is no undo. Show a confirmation dialog with the reason field before calling this; the customer gets a `REPORT_REPLACED` notification automatically.

#### TAT (turnaround-time) board

```
GET /api/partner/tat-board
→ 200 { "items": [
   { "_id":"...", "code":"LBZ-...", "status":"PROCESSING", "expectedAt":"...", "dueSoon":true, "overdue":false },
   { "_id":"...", "code":"LBZ-...", "status":"PROCESSING", "expectedAt":"...", "dueSoon":false, "overdue":true }
]}
```

Every `PROCESSING` booking for the lab, sorted by `expectedAt` ascending. `dueSoon` = due within the next 4 hours; `overdue` = past its expected turnaround. Render as a worklist (e.g. red row for `overdue`, amber for `dueSoon`) — this is the natural "what needs attention" view for a partner dashboard.

### 3.5 Staff (assistants)

```
GET    /api/partner/assistants                        → { "assistants":[...] }
POST   /api/partner/assistants  { name, phone, userId? }
PUT    /api/partner/assistants/:id     body: any updatable field
PUT    /api/partner/assistants/:id/availability      body: { weekdays:[...], homeRadiusKm }
```

> A dedicated "create staff login with email+password" endpoint and a Lab-Assistant-specific day-view/metrics screen are planned for Phase 2 (Task 40) — not yet available. For now, an assistant needs a `User` account created through the normal register flow with `roles` manually set to include `LAB_ASSISTANT` (an admin/ops task today, not self-serve from the partner app), then linked via `POST /api/partner/assistants` above.

### 3.6 Assistant app — visit flow

Once a booking is `ASSISTANT_ASSIGNED` and assigned to a given assistant (see §3.3), that assistant's app calls:

```
POST /api/assistant/bookings/:id/start-journey
→ 200 { "booking": { "status":"ON_THE_WAY", ... } }

POST /api/assistant/bookings/:id/arrived
→ 200 { "booking": { "status":"ARRIVED", ... } }

POST /api/assistant/bookings/:id/verify-otp
{ "otp": "4821" }
→ 200 { "booking": { "status":"COLLECTED", "visitOtpVerifiedAt":"..." } }

Errors:
 401 UNAUTHORIZED — wrong OTP (booking status unchanged; let the assistant retry)
 404 BOOKING_NOT_FOUND — this booking isn't assigned to the calling assistant
 403 FORBIDDEN — calling user has no active LabAssistant record at all
```

All three require `Authorization: Bearer <accessToken>` for a user with the `LAB_ASSISTANT` role, and are scoped strictly to bookings assigned to that specific assistant (an assistant can never see or act on another assistant's bookings via these routes). The OTP is read from the customer's app (§2.6a) — have the assistant ask the customer to read/show it, not auto-fill it from anywhere.

### 3.7 Analytics

```
GET /api/partner/analytics/overview
→ 200 { "totalBookings":1247, "completedBookings":1102, "cancelledBookings":48,
         "totalRevenue":984500, "topTests":[{ "name":"CBC", "count":312 }, ...] }

GET /api/partner/analytics/revenue?from=2026-05-01&to=2026-05-31
→ 200 { "revenue":[{ "_id":"2026-05-01", "revenue":3450, "count":7 }, ...] }

GET /api/partner/analytics/slots
→ 200 { "peakSlots":[{ "_id":"07:00", "count":86 }, ...] }

GET /api/partner/customers/:customerId/history
→ 200 { "bookings":[...] }
```

> Richer analytics (acceptance rate, no-show rate, TAT compliance %, peak-hours heatmap, ratings/quality panel) are planned for Phase 2 (Task 42) — not yet available.

---

## 4. WebSocket — live updates

```
ws(s)://<host>/ws?token=<accessToken>
```

Authentication is via the `token` query param (the access token, not refresh). The server validates it against `JWT_SECRET` and binds the socket to the user. Re-open the socket after token refresh.

### 4.1 Message shape

Every message is a JSON string of this envelope:

```json
{
  "id":    "65f...notificationId",
  "event": "BOOKING_STATUS",
  "title": "Sample collected",
  "body":  "Your sample has been collected.",
  "data":  { "bookingId":"...", "status":"COLLECTED" },
  "at":    "2026-06-15T07:35:11.420Z"
}
```

### 4.2 Event catalog

Every event below both (a) creates a persisted `Notification` row (visible via `GET /api/notifications`, §2.9) and (b) broadcasts live over the WebSocket to that user if connected — the two channels are always in sync, so it's safe to rely on either.

| `event`                          | When emitted                                                       | `data`                                     |
|-----------------------------------|----------------------------------------------------------------------|----------------------------------------------|
| `BOOKING_STATUS`                  | Any booking status transition (incl. CANCELLED/COMPLETED/NO_SHOW)   | `{ bookingId, status }`                    |
| `RETEST_DUE`                      | Scheduler fires a stored retest reminder                            | `{ reportId }`                              |
| `PAYMENT_CONFIRMED`               | Razorpay webhook verified a capture                                  | `{ bookingId, transactionId }`             |
| `SUBSCRIPTION_AWAITING_APPROVAL`  | A subscription occurrence needs the customer's explicit approval    | `{ subscriptionId }`                       |
| `SUBSCRIPTION_NO_SLOT`            | No slot found in the preferred window for a due subscription        | `{ subscriptionId }`                       |
| `SUBSCRIPTION_PAUSED_PAYMENT`     | 2 consecutive payment failures auto-paused a subscription            | `{ subscriptionId }`                       |
| `ACCOUNT_DELETION_REQUESTED`      | User requested account deletion (30-day grace begins)               | `{}`                                         |
| `LAB_JOINED_NEARBY`               | A lab activated within a user's watched radius                      | `{ labId }`                                  |
| `REPORT_REPLACED`                 | A lab replaced a previously-issued report                            | (booking/report context in `title`/`body`) |

Frontend should:
1. Re-fetch the relevant resource (`/api/bookings/:id`, `/api/reports/:id`, `/api/subscriptions/:id`) on any matching event — the WS payload is **a hint, not the truth**. This keeps reducers idempotent and tolerant of dropped frames.
2. Increment the notification badge by 1 on each message and refetch `unread-count` lazily.

### 4.3 Reconnection

- On `close(1008)` ("unauthorized"), refresh access token and reconnect.
- On any other close/error, back off `1s, 2s, 5s, 10s, 30s` capped — never spam.
- Always set `?token=` on the URL; do not send tokens in headers (browsers can't).

---

## 5. Frontend helper module (drop-in)

A minimal TypeScript wrapper that handles auth, retries on 401, and exposes typed helpers. Drop into the React Native / web project under `src/api/labzy.ts`.

```ts
const BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000';

type Tokens = { accessToken: string; refreshToken: string };
let tokens: Tokens | null = null;
let refreshing: Promise<Tokens> | null = null;
let deviceId: string | null = null; // set once at app start from secure storage, e.g. a persisted UUID

export const setTokens = (t: Tokens | null) => { tokens = t; };
export const getTokens = () => tokens;
export const setDeviceId = (id: string) => { deviceId = id; };

async function refresh(): Promise<Tokens> {
  if (!tokens?.refreshToken) throw new Error('UNAUTHORIZED');
  refreshing ??= fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken, deviceId }),
  }).then(async (r) => {
    if (!r.ok) throw await r.json();
    const next = await r.json();
    tokens = next;
    return next;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && tokens?.refreshToken) {
    await refresh();
    headers.set('Authorization', `Bearer ${tokens!.accessToken}`);
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  }
  if (!res.ok) throw await res.json();         // RFC 7807 body
  return res.json() as Promise<T>;
}

// Typed helpers (extend as you build screens)
export const Auth = {
  register: (body: { name: string; email: string; password: string; phone?: string; role?: 'CUSTOMER' | 'LAB_OWNER'; deviceId?: string; deviceLabel?: string; consents?: Consent[] }) =>
    api<Tokens & { user: User }>('/api/auth/register', { method:'POST', body: JSON.stringify(body) }),
  login: (email: string, password: string, deviceId?: string, deviceLabel?: string) =>
    api<Tokens & { user: User }>('/api/auth/login', { method:'POST', body: JSON.stringify({ email, password, deviceId, deviceLabel }) }),
  forgotPassword: (email: string) =>
    api('/api/auth/forgot-password', { method:'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    api(`/api/auth/reset-password/${token}`, { method:'POST', body: JSON.stringify({ newPassword }) }),
  logout: (refreshToken?: string) => api('/api/auth/logout', { method:'POST', body: JSON.stringify({ refreshToken }) }),
};

export const Account = {
  requestDeletion: () => api<{ deletionScheduledAt: string }>('/api/me', { method: 'DELETE' }),
  restore:         () => api('/api/me/restore', { method: 'POST' }),
};

export const Bookings = {
  list:        (status?: BookingStatus, page = 1) => api<BookingsList>(`/api/bookings?${new URLSearchParams({ ...(status && { status }), page: String(page) })}`),
  create:      (body: CreateBookingBody) => api<{ booking: Booking }>('/api/bookings', { method:'POST', body: JSON.stringify(body) }),
  detail:      (id: string) => api<{ booking: Booking }>(`/api/bookings/${id}`),
  events:      (id: string) => api<{ events: BookingEvent[] }>(`/api/bookings/${id}/events`),
  cancel:      (id: string, reason?: string) => api(`/api/bookings/${id}/cancel`, { method:'POST', body: JSON.stringify({ reason }) }),
  reschedule:  (id: string, scheduledDate: string, slot: { start: string }) =>
    api(`/api/bookings/${id}/reschedule`, { method:'POST', body: JSON.stringify({ scheduledDate, slot }) }),
  report:      (id: string) => api<{ reports: ReportEntry[] }>(`/api/bookings/${id}/report`),
  visitOtp:    (id: string) => api<{ otp: string }>(`/api/bookings/${id}/visit-otp`),
  setVisitNotes: (id: string, notes: string) => api(`/api/bookings/${id}/visit-notes`, { method:'POST', body: JSON.stringify({ notes }) }),
  refund:      (id: string, body: { testIds?: string[]; reason?: string }) =>
    api(`/api/bookings/${id}/refund`, { method:'POST', body: JSON.stringify(body) }),
};

export const Labs = {
  nearby:  (lat: number, lng: number, opts: { radius?: number; sortBy?: 'relevance'|'distance'|'rating'; q?: string } = {}) =>
    api<{ labs: Lab[]; count: number }>(`/api/labs/nearby?${new URLSearchParams({ lat: String(lat), lng: String(lng), ...opts as any })}`),
  detail:  (id: string) => api<{ lab: Lab }>(`/api/labs/${id}`),
  tests:   (id: string) => api<{ tests: Test[] }>(`/api/labs/${id}/tests`),
  slots:   (id: string, date: string) => api<{ date: string; slots: Slot[] }>(`/api/labs/${id}/slots?date=${date}`),
  reviews: (id: string, page = 1) => api<{ reviews: Review[]; total: number }>(`/api/labs/${id}/reviews?page=${page}`),
};

export const Discovery = {
  recentSearches: () => api<{ searches: RecentSearch[] }>('/api/me/recent-searches'),
  recordSearch:   (body: { kind: 'LAB'|'TEST'|'PACKAGE'|'QUERY'; value: string; ref?: string }) =>
    api('/api/me/recent-searches', { method:'POST', body: JSON.stringify(body) }),
  watchNearby:    (lat: number, lng: number, radiusMeters?: number) =>
    api('/api/me/lab-watches', { method:'POST', body: JSON.stringify({ lat, lng, radiusMeters }) }),
};

export const Subscriptions = {
  list:        () => api<{ subscriptions: Subscription[] }>('/api/subscriptions'),
  detail:      (id: string) => api<{ subscription: Subscription }>(`/api/subscriptions/${id}`),
  occurrences: (id: string) => api<{ occurrences: Occurrence[] }>(`/api/subscriptions/${id}/occurrences`),
  skipNext:    (id: string) => api(`/api/subscriptions/${id}/skip-next`, { method:'POST' }),
  pauseUntil:  (id: string, until: string) => api(`/api/subscriptions/${id}/pause-until`, { method:'POST', body: JSON.stringify({ until }) }),
  approveOccurrence: (occId: string) => api(`/api/subscription-occurrences/${occId}/approve`, { method:'POST' }),
};

export const Payments = {
  history:    () => api<{ invoices: Invoice[]; transactions: Transaction[]; refunds: Refund[] }>('/api/me/payments'),
  invoice:    (id: string) => api<{ invoice: Invoice; signedUrl: string | null }>(`/api/invoices/${id}`),
};

export const Tickets = {
  list:    (state?: 'OPEN'|'IN_PROGRESS'|'RESOLVED') => api<{ tickets: Ticket[] }>(`/api/tickets${state ? `?state=${state}` : ''}`),
  create:  (body: { bookingId?: string; category: TicketCategory; subject: string; message?: string }) =>
    api<{ ticket: Ticket }>('/api/tickets', { method:'POST', body: JSON.stringify(body) }),
  detail:  (id: string) => api<{ ticket: Ticket }>(`/api/tickets/${id}`),
  addMessage: (id: string, text: string) => api(`/api/tickets/${id}/messages`, { method:'POST', body: JSON.stringify({ text }) }),
  reopen:  (id: string) => api(`/api/tickets/${id}/reopen`, { method:'POST' }),
};

export const Notifications = {
  list:        (page = 1) => api<NotificationsList>(`/api/notifications?page=${page}`),
  unreadCount: () => api<{ unread: number }>('/api/notifications/unread-count'),
  markRead:    (id: string) => api(`/api/notifications/${id}/read`, { method: 'POST' }),
  readAll:     () => api('/api/notifications/read-all', { method: 'POST' }),
};
```

### WebSocket helper

```ts
export function connectLive(onEvent: (e: LiveEvent) => void) {
  const t = getTokens();
  if (!t?.accessToken) return null;
  const url = `${BASE.replace(/^http/, 'ws')}/ws?token=${t.accessToken}`;
  const ws = new WebSocket(url);
  ws.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch {} };
  ws.onclose = (e) => {
    if (e.code === 1008) { refresh().then(() => connectLive(onEvent)); return; }
    setTimeout(() => connectLive(onEvent), 2000);
  };
  return ws;
}
```

---

## 6. Mapping the UI kit to endpoints (quick reference)

| Screen / component                            | File                                  | Endpoints used                                              |
|-------------------------------------------------|------------------------------------------|-----------------------------------------------------------------|
| `PatientHome.jsx` — top header (location, bell) | `ui_kits/patient_app/PatientHome.jsx` | `GET /api/me`, `GET /api/notifications/unread-count`        |
| Home banner card "Report ready"               | same                                  | `GET /api/bookings?status=COMPLETED&limit=1`                |
| Home categories chips                          | same                                  | `GET /api/content/home_categories`                          |
| Home "Labs near you"                           | same                                  | `GET /api/labs/nearby`                                      |
| Home "Popular tests"                           | same                                  | `GET /api/tests?sortBy=rating`                              |
| Search bar                                    | `components/forms/SearchBar`          | `GET /api/tests?q=`, `GET /api/labs?search=`, `POST /api/me/recent-searches` |
| "No labs nearby" empty state                   | same                                  | `POST /api/me/lab-watches`                                  |
| `PatientLabDetail.jsx`                        | `ui_kits/patient_app/PatientLabDetail.jsx` | `GET /api/labs/:id`, `/tests`, `/slots?date=`, `/reviews` |
| Add-to-cart + Book CTA                         | same                                  | `POST /api/bookings` → `POST /api/bookings/:id/payment-intent` |
| `PatientBookings.jsx` — Active booking card    | `ui_kits/patient_app/PatientBookings.jsx` | `GET /api/bookings?status=...` (use `timeline`)          |
| Reschedule button                              | same                                  | `POST /api/bookings/:id/reschedule`                         |
| Cancel button                                  | same                                  | `POST /api/bookings/:id/cancel`                             |
| Visit-OTP display / notes                      | same (booking detail)                 | `GET /api/bookings/:id/visit-otp`, `POST /api/bookings/:id/visit-notes` |
| `PatientReports.jsx` — list                    | `ui_kits/patient_app/PatientReports.jsx` | `GET /api/bookings?status=COMPLETED`                     |
| Expanded result table                          | same                                  | `GET /api/bookings/:id/report` → `reports[]`                |
| "Remind in 3 months" switch                    | same                                  | `POST /api/reports/:id/retest-reminder`                     |
| Payment history screen                         | (new — build against §2.11)           | `GET /api/me/payments`, `GET /api/invoices/:id`             |
| Support / help center                          | (new — build against §2.12)           | `POST /api/tickets`, `GET /api/tickets`, `/:id`, `/:id/messages`, `/:id/reopen` |
| Account settings — delete account              | (new — build against §2.2a)           | `DELETE /api/me`, `POST /api/me/restore`                     |
| `PartnerToday.jsx`                            | `ui_kits/partner_app/PartnerToday.jsx`| `GET /api/partner/today`                                    |
| Accept / Decline                              | same                                  | `POST /api/partner/bookings/:id/accept` `/reject`           |
| `PartnerOrders.jsx` — advance stage           | `ui_kits/partner_app/PartnerOrders.jsx` | `mark-collected`, `mark-processing`, `report` (upload), `reassign` |
| TAT board (new)                                | (new — build against §3.4)            | `GET /api/partner/tat-board`                                 |
| Report replace (correction) flow (new)         | (new — build against §3.4)            | `PUT /api/partner/bookings/:id/reports/:reportId`            |
| Assistant app — visit flow (new)               | (new — build against §3.6)            | `POST /api/assistant/bookings/:id/start-journey` `/arrived` `/verify-otp` |

---

## 7. Roll-out checklist for the frontend team

- [ ] Set `EXPO_PUBLIC_API_BASE` (or equivalent) per environment; never hard-code `localhost`.
- [ ] Wire the `api()` helper into a single Axios/fetch interceptor; do not call `fetch` directly from screens.
- [ ] Persist tokens **and a stable per-install `deviceId`** in `expo-secure-store` / `Keychain` — never `AsyncStorage`. Generate `deviceId` once (e.g. `uuid.v4()`) and reuse it for every login/register/refresh call from that install.
- [ ] Open the WebSocket once at app start (post-login). Re-open on token refresh and on app foreground.
- [ ] Subscribe to FCM push and post the token via `PUT /api/profile { fcmToken }` every cold start.
- [ ] Cache `GET /api/content/*` for 5 minutes.
- [ ] Cache `GET /api/labs/:id` for 60 seconds; the `slots` endpoint must always be live.
- [ ] Treat any `LBZ-…` code as opaque — sort by `createdAt`, never by code.
- [ ] All status badges must read from `booking.status` + the `timeline` array — never compute timeline locally (now 6 steps, not 4 — see §1.6).
- [ ] On `409 SLOT_UNAVAILABLE`, refetch `GET /api/labs/:id/slots` before retrying.
- [ ] On `409 RESCHEDULE_CUTOFF_PASSED` / `RESCHEDULE_LIMIT_REACHED`, don't retry — surface the specific copy from §1.3 and disable further reschedule attempts on that booking.
- [ ] Email + password is the only credential today, for **every** role including future lab staff — do **not** build any OTP UI. There is no `/auth/otp/*` endpoint and none is planned; treat any such requirement in the source PRD as superseded by this decision.
- [ ] Don't build a working "in-app call" UI around `POST /bookings/:id/calls/connect` yet — it's a stub. Keep using `tel:` links.
- [ ] A multi-test booking's report screen must handle `reports[]` having 0, 1, or N entries (partial completion) — don't assume exactly one report per booking.
- [ ] `GET /api/partner/bookings`'s `status` filter doesn't yet accept the newer intermediate statuses (`ASSISTANT_ASSIGNED`/`ON_THE_WAY`/`ARRIVED`/`RESCHEDULED`/`NO_SHOW`) — see the note in §3.3.
