## Goals

* Establish a modular, testable backend that cleanly serves Customer and Partner apps

* Align with existing stack (Fastify + Mongoose), fix geospatial and auth gaps, add payments, storage, notifications, and recurring subscriptions

* Enforce security, RBAC, observability, and predictable background job scheduling

## Tech Stack & Standards

* Runtime: Node.js (ESM), Fastify for HTTP

* DB: MongoDB + Mongoose (GeoJSON for location)

* Validation: Fastify JSON Schema per route (AJV)

* Auth: JWT for API, role-based authorization; optional Firebase token verification behind an adapter

* Jobs/Scheduler: Agenda (Mongo-backed) for recurring subscriptions; cron-based triggers

* Logging: pino (Fastify native), request logging, error boundaries

* Storage: provider adapter (AWS S3 or Firebase Storage) with signed URLs

* Payments: provider adapter (Razorpay/Stripe/Paytm) with webhooks

* Notifications: provider adapters (FCM, Twilio, SendGrid)

## Project Structure (feature-first)

```
src/
  app.ts            // fastify instance, plugins, global error handler
  server.ts         // bootstrapping
  config/           // env, db, provider configs
  common/           // types, errors, result, constants
  middleware/       // auth, rbac, rate limit, cors, helmet
  modules/
    users/
      model.ts repo.ts service.ts controller.ts routes.ts validators.ts
    labs/
      model.ts repo.ts service.ts controller.ts routes.ts validators.ts
    tests/
    bookings/
    subscriptions/
    assistants/
    reports/
    payments/
    notifications/
  integrations/     // storage, payment, notify, maps
  jobs/             // agenda definitions, processors
  admin/            // AdminJS setup & resources
  utils/            // crypto, dates, id, pagination
  test/             // unit/integration tests
```

* Keep ESM everywhere; remove legacy CommonJS (`models/prescription.js`) and stray Express imports

## Domain Models (MongoDB)

* User: profile, roles (`CUSTOMER`, `LAB_OWNER`, `LAB_ASSISTANT`, `ADMIN`), addresses, `location.coordinates` (2dsphere), auth fields

* Lab: details, certifications, opening hours, `location.coordinates` (2dsphere), slot matrix, rating

* Test: lab reference, name/description, price, sample requirements, turnaround time

* Booking: user, lab, test(s), scheduled date/time, slot, status (Pending/Confirmed/Collected/Completed/Cancelled), labAssistant, totalAmount, report refs

* Subscription: `subscription_id`, user, lab, test, frequency (monthly/weekly/custom), next\_booking\_date, auto\_payment, status (Active/Paused/Cancelled), last\_run\_at, retry\_count

* LabAssistant: profile, lab linkage, availability

* Report: booking, test, file object (uri, storageProvider, checksum), issuedAt, secure access flags

* Transaction: payment provider, transactionId, amount, currency, status, method, invoice ref, metadata, webhook events

* Invoice: number, booking/subscription link, line items, tax, pdf url

* Notification: type, channels, payload, user/lab destinations, delivery status

* AuditLog: actor, action, resource, before/after, ip, timestamp

## Geospatial & Indexing

* Normalize `Lab` to GeoJSON `location.coordinates: [lng, lat]` with `2dsphere` index (fix query mismatch with `controllers/profileController.js` expecting `$near`)

* Add compound indexes: bookings by `lab + scheduledDate`, subscriptions by `user + status + next_booking_date`, transactions by `provider + transactionId`

## Key Workflows

* Lab Discovery: `$near` queries on `Lab.location.coordinates`, filter by certifications, opening hours, supported tests, rating

* Test Booking: slot availability check, hold/reserve window, confirm booking upon payment (if required), update lab assistant assignment

* Recurring Booking: Agenda job finds `Subscription.status = Active` and `next_booking_date <= now`, creates booking(s), triggers auto-payment if enabled, schedules next date per frequency

* Sample Collection: assignment service picks an available `LabAssistant` near user/lab; status transitions tracked

* Report Access: upload by partner, store securely, issue signed URL, enforce download authorization and expiry

* Payment: create payment intent, handle provider webhook, update `Transaction` and `Booking` status; generate invoice

* Notifications: event bus emits domain events (BookingConfirmed, ReportReady, PaymentFailed); adapters deliver via FCM/SMS/Email

## API Surface (selected)

* Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`

* Profile: `GET /me`, `PUT /profile`, `POST /addresses`, `POST /location`

* Labs: `GET /labs/nearby`, `GET /labs/:id`, `GET /labs/:id/tests`

* Tests: `GET /tests?labId=...`

* Bookings (Customer): `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel`

* Subscriptions: `POST /subscriptions`, `GET /subscriptions`, `PUT /subscriptions/:id`, `POST /subscriptions/:id/pause`, `POST /subscriptions/:id/cancel`

* Reports: `GET /reports/:id` (signed URL), `GET /bookings/:id/report`

* Payments: `POST /payments/intent`, `POST /webhooks/payments` (provider), `GET /payments/:id`

* Partner (Lab Owner): `GET /partner/bookings/daily`, `POST /partner/bookings/:id/accept`, `POST /partner/bookings/:id/reject`, `POST /partner/bookings/:id/reassign`

* Partner Reports: `POST /partner/reports/upload` (multipart), `POST /partner/bookings/:id/report`

* Assistants: `GET /partner/assistants`, `POST /partner/assistants`, `PUT /partner/assistants/:id`

* Analytics: `GET /partner/analytics/overview`, `GET /partner/analytics/revenue`, `GET /partner/analytics/slots`

## Validation & Schemas

* Define JSON Schemas per route (Fastify), including enums for statuses and `frequency`

* Reject inconsistent data early, sanitize inputs, normalize dates/time zones (UTC

## Integrations

* Storage: pluggable adapter (`S3Storage`, `FirebaseStorage`), presigned URLs, MIME validation, size limits

* Payment: pluggable `PaymentProvider` (`RazorpayProvider`, `StripeProvider`, `PaytmProvider`), intents, capture, refund, webhook signature verification

* Notifications: `FcmNotifier`, `TwilioNotifier`, `SendGridNotifier`; channel selection per event

* Maps: Google Maps geocoding via existing `services/locationService` behind an adapter

## Background Jobs (Agenda)

* Queue: `subscriptions:run`, `reports:post-upload`, `notifications:dispatch`, `payments:webhook-retry`

* Scheduler: daily check for due subscriptions; backoff/retries; idempotency keys; outbox pattern for reliable delivery

## Security & Compliance

* Transport: HTTPS-only, HSTS, `@fastify/helmet`, strict CORS

* Data: encrypt sensitive PII (e.g., report URIs, address elements) with app-level crypto where needed

* Auth: JWT with short-lived access + refresh tokens; RBAC middleware; optional Firebase verification adapter

* Secrets: `.env` only; remove hardcoded credentials (e.g., Nodemailer) and move to provider config

* Access: signed URLs with expiry for report download; audit logs on sensitive reads/writes

* Governance: certification verification fields on `Lab`; document validation procedures

## Observability

* Logging: pino structured logs, request log with redaction (tokens, emails)

* Metrics: basic process metrics; later Prometheus integration

* Error Handling: centralized error mapper -> consistent problem details

## Admin Panel (AdminJS)

* Keep AdminJS; migrate admin auth to bcrypt-hashed passwords, enforce RBAC for resources

* Register new resources: `Subscriptions`, `Transactions`, `Reports`, `Assistants`, `Invoices`

## Migration & Refactor (align with existing code)

* Normalize geospatial: add `Lab.location.coordinates` + 2dsphere index; update nearby labs query in `controllers/profileController.js`

* Unify ESM; remove `express` usage; register `@fastify/cors`

* Add role-check middleware and route guards

* Replace hardcoded email creds; introduce email adapter

* Add pino, route schemas, and global error handler

* Wire AdminJS with secure session and hashed admin passwords

## Milestones

1. Foundation: pino, CORS/Helmet, route schemas, error handler, RBAC middleware
2. Geospatial fix + Lab Discovery endpoints
3. Booking and Slot management + Lab Assistant assignment
4. Subscriptions + Agenda scheduler
5. Payments (provider + webhook) + Invoice
6. Reports upload + storage + signed access
7. Notifications (event bus + adapters)
8. AdminJS hardening + resources
9. Security hardening + audit logs + analytics

## Notes on Current Codebase

* User geospatial index exists (`models/user.js:67`), Lab model lacks `coordinates`/index; fix to make `$near` work in discovery

* JWT auth present; add RBAC checks across routes

* Firebase `firebase-admin` referenced but not initialized; wrap into optional adapter

* Nodemailer uses hardcoded Gmail creds; move to env/provider

* Unused deps (multer, ws, twilio) — either wire properly per plan or remove later

* Add structured logging and validation to replace console prints

