# Labzy — Product Requirements Document

**Product:** Labzy — Diagnostic Lab Test Booking Platform
**Apps:** Labzy Customer App · Labzy Partner App
**Document Version:** 2.0 (Expanded)
**Status:** Draft for Review
**Author:** Rehan Shaikh
**Last Updated:** 10 June 2026

---

## 1. Product Overview & Vision

Labzy is a dual-platform mobile product that connects people who need diagnostic tests with verified diagnostic labs in their area. It removes the friction of phone calls, physical visits, paper reports, and forgotten follow-up tests by making the entire journey — discover, book, get sampled, pay, receive report, repeat — digital and effortless.

**Vision:** Become the default way people in India book and manage diagnostic tests — as easy as ordering food, as trustworthy as a family doctor's referral.

**The two apps:**

| App | Audience | Core Job |
|---|---|---|
| **Labzy Customer App** | Patients / health-conscious users / caregivers | Discover labs, book tests, get samples collected, receive reports, manage recurring health checkups |
| **Labzy Partner App** | Lab owners, lab managers, lab assistants | Receive and manage bookings, assign collection staff, upload reports, track business performance |

---

## 2. Problem Statement

**For customers:**
- Finding a trustworthy, certified lab nearby requires word-of-mouth or guesswork.
- Booking means phone calls, unclear pricing, and no slot visibility.
- Reports arrive late, on paper, or via unorganized WhatsApp PDFs that get lost.
- People with chronic conditions (diabetes, thyroid, kidney) need the *same test every month* but must remember and re-book manually each time — leading to missed tests and health risks.

**For labs:**
- Small and mid-size labs have no digital booking channel; they lose customers to larger chains.
- Schedules, assistant assignments, and customer history are managed on paper or spreadsheets.
- No visibility into revenue trends, popular tests, or repeat customers.

---

## 3. Goals & Success Metrics

### Business Goals
1. Digitize the booking-to-report journey end to end for both sides of the market.
2. Drive repeat usage through recurring bookings (subscriptions) — the key differentiator.
3. Build a verified, trusted network of certified labs.

### Success Metrics (first 12 months)

| Metric | Target |
|---|---|
| Booking completion rate (started → confirmed) | ≥ 70% |
| Recurring subscription adoption among repeat users | ≥ 25% |
| Report delivery within promised TAT | ≥ 90% of bookings |
| Customer repeat booking rate (90-day window) | ≥ 35% |
| Partner booking acceptance rate | ≥ 85% |
| Average customer rating across bookings | ≥ 4.2 / 5 |
| Auto-booking success rate for active subscriptions | ≥ 95% |

---

## 4. User Personas & Roles

### 4.1 Customer Personas

**P1 — The Chronic Care Patient ("Ramesh, 52, diabetic")**
Needs HbA1c and lipid profile every 3 months, fasting sugar monthly. Forgets to book; his daughter usually reminds him. Wants home collection because of mobility issues. *Primary user of Recurring Booking.*

**P2 — The Health-Conscious Professional ("Sneha, 29, IT employee")**
Books annual full-body checkups and occasional vitamin panels. Compares prices and ratings before booking. Wants reports on her phone, fast.

**P3 — The Family Caregiver ("Imran, 35")**
Books tests for parents, spouse, and kids from one account. Needs to manage multiple patients, addresses, and report histories without mixing them up.

### 4.2 Partner Personas

**P4 — The Lab Owner ("Dr. Mehta, owns 2-branch pathology lab")**
Wants more bookings without hiring a receptionist for phone calls. Cares about daily revenue, no-shows, and his lab's rating.

**P5 — The Lab Manager / Front Desk ("Priya, manages daily operations")**
Accepts/rejects bookings, assigns lab assistants for home visits, handles rescheduling and customer queries.

**P6 — The Lab Assistant / Phlebotomist ("Arjun, field staff")**
Receives assigned home-collection visits with address, time, and test details. Marks samples as collected.

### 4.3 Role & Permission Summary

| Capability | Customer | Lab Owner | Lab Manager | Lab Assistant |
|---|---|---|---|---|
| Book / cancel own tests | ✅ | — | — | — |
| Manage subscriptions | ✅ | — | — | — |
| View own/family reports | ✅ | — | — | — |
| Accept / reject / reassign bookings | — | ✅ | ✅ | — |
| Upload reports | — | ✅ | ✅ | — |
| Manage test catalog & pricing | — | ✅ | — | — |
| Manage staff accounts | — | ✅ | — | — |
| View analytics & revenue | — | ✅ | View-only (configurable) | — |
| View assigned visits & mark sample collected | — | — | — | ✅ |

---

## 5. Scope

### In Scope (v1)
- Customer App: onboarding, lab discovery, test catalog, one-time booking, recurring booking, home/in-lab sample collection, report access, payments & invoices, profile & family members, notifications, ratings, help & support.
- Partner App: lab onboarding & verification, catalog & pricing management, order/schedule management, staff management, customer history, report upload, notifications, dashboard & analytics, earnings view.

### Out of Scope (v1)
- Tele-consultation with doctors.
- Medicine delivery or pharmacy integration.
- Insurance claim filing.
- Wearable/health-app integrations (future roadmap).
- Multi-language UI beyond English + Hindi (future).
- Web portal (mobile apps only in v1).

---

# PART A — LABZY CUSTOMER APP

---

## 6.1 Onboarding & Account Creation

### Overview
First-time users must be able to sign up in under a minute and reach lab discovery with minimal friction. Health data is sensitive, so consent is collected explicitly at signup.

### User Stories
- As a new user, I want to sign up with my mobile number and OTP so I don't need to remember a password.
- As a returning user, I want to log in on a new device and find all my bookings and reports intact.
- As a privacy-conscious user, I want to know exactly what health data Labzy stores and consent to it explicitly.

### Functional Requirements
1. Sign up via mobile number + OTP verification; email is optional and can be added later.
2. Mandatory consent checkboxes at signup: (a) Terms of Service, (b) Privacy Policy, (c) consent to store health records. Signup cannot complete without all three.
3. Collect basic profile during onboarding: full name, gender, date of birth. All other details are optional and skippable.
4. Location permission requested with a clear explanation ("to show labs near you"); the app must remain usable if denied, falling back to manual city/pincode entry.
5. Returning users log in with the same number + OTP; account data (bookings, reports, subscriptions, addresses) is fully restored.
6. A user can be logged in on a maximum of 3 devices simultaneously; logging into a 4th logs out the oldest session.
7. Account deletion option available in settings; deletion permanently removes personal data after a clearly communicated 30-day grace period and is irreversible after that.

### Acceptance Criteria
- A new user can go from app open → first lab list view in ≤ 60 seconds.
- OTP arrives within 30 seconds; resend allowed after a 30-second cooldown, max 3 resends per 15 minutes.
- Skipping optional profile fields never blocks any later flow except where the data is operationally required (e.g., date of birth required before first booking, since reports reference patient age).
- Denying location permission shows manual location entry, not a dead end.

### Edge Cases & Error Handling
- Wrong OTP entered 5 times → temporary lockout for 15 minutes with a clear message.
- OTP requested but SMS never arrives → "Get OTP on call" fallback after first resend.
- User changes mobile number → re-verification of new number required; old number released only after new one verified.
- Minor users: date of birth indicating age < 18 → account allowed only as a *family member profile* under an adult account, not a standalone account.

---

## 6.2 Lab Discovery & Search

### Overview
The home experience. Users see nearby labs ranked by relevance — distance, rating, certification, and availability — and can search or filter to find the right lab for the test they need.

### User Stories
- As a user, I want to see certified labs near my location with ratings so I can choose a trustworthy one.
- As a user, I want to search for a specific test (e.g., "HbA1c") and see which nearby labs offer it, at what price.
- As a user, I want to filter labs by home collection availability, price range, rating, and open-now status.

### Functional Requirements
1. Default lab list sorted by a relevance blend of distance, rating, and availability; user can re-sort by distance only, rating only, or price (low→high) for a searched test.
2. Each lab card shows: lab name, distance, star rating + review count, certification badge(s) (e.g., NABL, government registration), open/closed status with hours, "home collection available" tag, and starting price.
3. Search supports three intents: lab name, test name, and health-package name. Test-name search returns labs offering that test with the lab-specific price shown.
4. Filters: distance radius (1/3/5/10 km), rating (4★+, 4.5★+), home collection (yes/no), open now, price range (for a searched test), certification type.
5. Search supports common synonyms and misspellings for popular tests (e.g., "sugar test" → fasting blood glucose; "thyroid" → TSH/T3/T4 profiles).
6. Certification badges are shown only for labs whose documents have been verified by Labzy (see Partner §7.1); badge tap opens a plain-language explanation of what the certification means.
7. Empty state when no labs match: suggest widening radius or removing filters, with one-tap actions.
8. Recently viewed labs and recent searches shown for quick repeat access.

### Acceptance Criteria
- Lab list loads within 3 seconds on a typical mobile connection; skeleton loaders shown while loading.
- Distance shown is the travel-relevant point (lab entrance), accurate to within 100 m.
- A search for a test never shows a lab that doesn't currently offer that test.
- Filters combine with AND logic and the active filter count is always visible.

### Edge Cases & Error Handling
- No labs within max radius → empty state with "Notify me when a lab joins near me" option.
- Location services off mid-session → banner prompting re-enable, list falls back to last known/manual location.
- A lab pauses operations (vacation mode) → hidden from discovery but existing bookings unaffected.
- Two labs with identical names → distinguished by area name in the card subtitle.

---

## 6.3 Lab Profile & Test Catalog

### Overview
The detail page where a user evaluates a lab and browses everything it offers before booking.

### User Stories
- As a user, I want to see a lab's full test menu with clear prices and preparation instructions so there are no surprises.
- As a user, I want to read reviews from other customers before trusting a lab with my health.

### Functional Requirements
1. Lab profile contains: photos, full address with map preview and "Get directions", contact options (call via masked number), operating hours per day, certifications with verification date, average rating with distribution (5★ to 1★), and recent reviews.
2. Test catalog grouped by category (e.g., Blood, Urine, Imaging, Health Packages) with search within the lab's catalog.
3. Each test entry shows: test name, plain-language description ("what this test checks"), price, sample type, fasting/preparation requirements, and report turnaround time (TAT) committed by the lab.
4. Health packages show included tests as an expandable list, package price vs. sum-of-individual-prices savings.
5. "Book this test" CTA on every test/package row leads directly into the booking flow with that test pre-selected; multiple tests can be added to a single booking (cart-style).
6. Reviews are booking-verified only (a user can review only labs where they completed a booking); each review shows rating, optional text, and booking month (not exact date, for privacy).

### Acceptance Criteria
- Every bookable test has a price and TAT — tests missing either cannot be published by the lab (enforced on Partner side, §7.2).
- Preparation requirements (e.g., "10–12 hours fasting required") are shown both on the test page and again at booking confirmation.
- Adding multiple tests recalculates total price and shows the combined preparation requirements (most restrictive wins, e.g., fasting applies to the whole visit).

### Edge Cases & Error Handling
- Lab updates a price while user has the test in cart → user sees a clear "price updated" notice at checkout; old price never silently charged or honored.
- Test temporarily unavailable (e.g., machine down) → marked "Currently unavailable" and not bookable, but still visible.
- A test in an active subscription is discontinued by the lab → see §6.5 edge cases.

---

## 6.4 Test Booking (One-Time)

### Overview
The core transaction: select tests → choose collection mode → pick date & slot → choose patient → pay → confirmed.

### User Stories
- As a user, I want to pick a date and time slot that suits me and know it's actually reserved.
- As a caregiver, I want to specify *who* the test is for (me, my father, my child) so reports go to the right profile.
- As a user, I want a clear summary — tests, patient, address, time, price — before I pay.

### Functional Requirements
1. Booking flow steps: (1) Tests selected → (2) Collection mode: Home collection or Visit lab → (3) Date & slot → (4) Patient selection (self or family member) → (5) Address (home collection only) → (6) Review & pay → (7) Confirmation.
2. Slot picker shows the next 14 days; slots reflect the lab's real availability and capacity (a slot at capacity shows as unavailable). Home-collection and in-lab slots are managed separately by the lab.
3. Home collection may carry a separate collection fee, displayed as a distinct line item; fee may be waived above a lab-defined order value.
4. Patient selection requires name, age/DOB, and gender for the person being tested; family members saved in profile (§6.9) are one-tap selectable.
5. A slot is soft-held for 10 minutes once the user reaches payment; if payment isn't completed, the hold is released.
6. Booking confirmation screen and notification include: booking ID, tests, patient name, lab name, mode, date/time, address (if home), preparation instructions, amount paid, and cancellation policy.
7. **Booking states (visible to the user):** `Pending lab confirmation` → `Confirmed` → `Assistant assigned` (home only) → `Sample collected` → `Processing` → `Report ready` → `Completed`. Exceptional states: `Rescheduled`, `Cancelled by you`, `Cancelled by lab`, `No-show`.
8. Rescheduling: allowed up to a lab-defined cutoff (default 4 hours before slot), max 2 reschedules per booking, no fee. After cutoff, only cancellation rules apply.
9. Cancellation: free until cutoff (default 4 hours before slot); after cutoff, lab-defined cancellation fee may apply, always shown before the user confirms cancellation. Refund of the remaining amount follows §6.8 refund rules.
10. If the lab rejects a booking (e.g., cannot serve the slot), the user is notified immediately with options: pick a new slot at the same lab or cancel with full automatic refund.

### Acceptance Criteria
- A confirmed slot is never double-booked beyond lab-defined capacity.
- Preparation instructions are re-surfaced in the reminder notification the evening before and the morning of the test.
- Every state transition triggers a user-visible status update in the booking detail screen and a notification (per notification settings).
- The full price (tests + collection fee + taxes, if any) is visible before payment; no post-payment surprises.

### Edge Cases & Error Handling
- Payment succeeds but the slot was just taken (race) → booking auto-enters `Pending lab confirmation`; if the lab cannot honor it, full automatic refund + apology message + one-tap rebooking.
- User books for a family member whose age/gender conflicts with the test (e.g., a gender-specific test) → warning shown before payment.
- Lab goes offline / unresponsive and never confirms within 2 hours of booking (or by slot start, whichever is sooner) → booking auto-cancels with full refund and the user is notified with alternatives nearby.
- No-show (home collection: patient unreachable at address; in-lab: patient never arrives within grace period) → booking marked `No-show`; lab-defined no-show fee may apply per the policy the user accepted at booking.

---

## 6.5 Recurring Booking — Subscriptions ⭐ (Key Feature)

### Overview
The standout feature. Users with regular testing needs (chronic conditions, fitness tracking, doctor-mandated monitoring) set a test to repeat automatically — Labzy reminds them, books the slot, and (optionally) charges automatically. The product goal: a diabetic patient never misses a monthly sugar test again.

### User Stories
- As a chronic-care patient, I want my HbA1c test booked automatically every month so I never miss it.
- As a user, I want a reminder *before* each auto-booking happens so I can skip or reschedule that occurrence if I'm traveling.
- As a user, I want to pause my subscription for a couple of months without losing it.
- As a user, I want to choose between auto-payment and approve-each-time, because I don't always want money deducted automatically.

### Functional Requirements
1. **Creation:** From any test page or from a completed booking ("Make this recurring"), user sets: frequency (weekly / every 2 weeks / monthly / every 2 months / quarterly / custom interval in days), preferred day-of-period and time window, patient, collection mode, address (if home), and payment mode (auto-pay or approve-per-occurrence).
2. **Pre-booking reminder:** A reminder is sent N days before each scheduled occurrence (default 3 days, user-configurable 1–7). The reminder offers: *Confirm*, *Skip this one*, *Reschedule this one*, *Pause subscription*.
3. **Auto-booking:** On the scheduled date logic:
   - *Auto-pay ON:* slot is booked and payment charged automatically; user notified with full booking details.
   - *Auto-pay OFF:* a pre-filled booking is created in `Awaiting your approval`; if not approved within 48 hours, that occurrence is skipped (counted and reported to the user) and the next cycle continues.
4. **Slot intelligence:** Auto-booking targets the user's preferred time window; if unavailable, books the nearest available slot the same day; if no slot that day, tries the next day (up to +2 days) and informs the user of the shift. If nothing is available in the window, the occurrence converts to a manual-action reminder rather than failing silently.
5. **Skip:** Skipping one occurrence never affects the schedule of subsequent occurrences.
6. **Pause / Resume:** Pause indefinitely or until a chosen date; resuming recalculates the next occurrence from the original cadence anchor. Paused subscriptions send no reminders and create no bookings.
7. **Cancel:** Cancelling stops all future occurrences immediately; any already-confirmed upcoming booking remains and follows normal booking cancellation rules (user is told this explicitly).
8. **Price changes:** If the lab changes the test price, the user is notified before the next occurrence; auto-pay subscriptions require one-time re-consent if the price increased (auto-pay is suspended for that occurrence until consented).
9. **Payment failure (auto-pay):** Retry up to 2 times over 24 hours; if still failing, the occurrence converts to approve-manually mode and the user is notified. Two consecutive failed cycles → subscription auto-pauses with notification.
10. **Subscription states:** `Active` → `Paused` → `Active`; `Active` → `Cancelled` (terminal); `Active` → `Payment issue` (auto, recoverable) → `Active` or `Paused`.
11. **Management hub:** A "My Subscriptions" screen lists each subscription with test, lab, patient, frequency, next date, payment mode, status, and complete occurrence history (booked / skipped / failed / completed) with reports linked.
12. A user may hold multiple subscriptions, including the same test for different family members.

### Acceptance Criteria
- A subscription occurrence always results in exactly one of: confirmed booking, user-approved-pending booking, explicit skip, or explicit "no slot available" notification — never a silent failure.
- Pause takes effect immediately, even if the next occurrence is the same day (unless that occurrence is already a confirmed booking).
- The user can always answer "when is my next test?" within one tap from the subscriptions hub.
- Auto-pay never charges a price higher than the last user-consented price.

### Edge Cases & Error Handling
- Lab discontinues the subscribed test or leaves the platform → subscription auto-pauses; user is notified and offered the same test at the 3 nearest comparable labs as a one-tap migration.
- Lab closed on the scheduled date (holiday) → slot-shifting logic (FR-4) applies; reminder mentions the holiday.
- Patient (family member) profile is deleted → linked subscriptions are cancelled with confirmation prompt at deletion time.
- User's saved address removed/invalid for home collection → next reminder requires address confirmation before booking proceeds.
- Occurrence collides with an identical manually-made booking (same test/patient/date) → auto-booking is skipped as duplicate and the user is informed.

---

## 6.6 Sample Collection (Home & In-Lab)

### Overview
The physical step. For home collection, a lab assistant is assigned, the user can track who's coming, and the visit is verifiable. For in-lab visits, the user gets everything needed to walk in and be served.

### User Stories
- As a user, I want to know the name and photo of the assistant coming to my home, for safety and trust.
- As a user, I want live status — assigned, on the way, arrived — so I'm not waiting blindly.
- As a user, I want collection to be verified with an OTP so there's no dispute about whether it happened.

### Functional Requirements
1. **Home collection:**
   - After lab confirmation, an assistant is assigned (by the lab — §7.4); user sees assistant name, photo, and masked contact.
   - Status timeline: `Assistant assigned` → `On the way` → `Arrived` → `Sample collected`.
   - In-app masked calling between user and assistant (neither sees the other's real number).
   - Collection verification: assistant enters a 4-digit OTP shown in the user's app at the moment of collection; collection cannot be marked complete without it.
   - User can add visit notes at booking (e.g., "gate code 4521", "ring bell twice").
2. **In-lab visit:**
   - Confirmation includes lab address, map link, slot time, a unique booking code/QR for front-desk check-in, and preparation instructions.
   - Front desk checks the user in by code/QR; status moves to `Sample collected` once done.
   - Grace period for late arrival (lab-defined, default 30 minutes) after which the booking may be marked `No-show`.
3. Reminder notifications: evening before (with preparation instructions) and 2 hours before slot (home: "assistant arriving between X–Y"; in-lab: "your slot is at X").
4. If an assigned assistant is changed by the lab, the user is notified immediately with the new assistant's details.

### Acceptance Criteria
- The user always knows the current physical status of their collection without calling anyone.
- Collection OTP verification succeeds in ≥ 99% of completed home visits; OTP mismatch blocks completion and surfaces a support path.
- Assistant's real phone number is never exposed to the user, and vice versa.

### Edge Cases & Error Handling
- Assistant cannot find the address → masked call + ability for user to share precise live location pin for this visit only.
- User unreachable at home → assistant waits a lab-defined grace window (default 10 min), attempts masked call twice; then marks `Customer unavailable` → booking becomes `No-show` flow with photo-of-location proof required from assistant.
- Fasting requirement not met (user discloses on arrival) → assistant/lab can mark "collection deferred — preparation not met"; one free reschedule offered.
- Sample issue after collection (hemolyzed, insufficient quantity) → lab flags it (§7.3); user notified with apology and a free re-collection booking flow.

---

## 6.7 Report Access & Management

### Overview
Reports are the product's payoff. They must arrive on time, be easy to find forever, and be private by default.

### User Stories
- As a user, I want a notification the moment my report is ready, and to open it in one tap.
- As a caregiver, I want my father's reports under his profile and mine under mine, never mixed.
- As a user, I want to share a report with my doctor easily but securely.

### Functional Requirements
1. Report (PDF) is attached to its booking; when the lab uploads it (§7.6), the booking moves to `Report ready` and the user is notified.
2. Reports hub: all reports listed, filterable by patient, lab, test type, and date range; full-text search by test name.
3. Viewing requires app authentication (device biometric/PIN if enabled); reports are private to the account by default.
4. Download to device and share via standard share sheet; shared copies are flagged in-app as "shared on <date>" for the user's own awareness.
5. Expected report time shown on every booking ("Report expected by Thu, 6 PM" from lab TAT); if the lab misses TAT, the user is proactively notified with a revised time and the delay is recorded against the lab's TAT metric.
6. Multi-test bookings may receive partial reports (some tests ready earlier); each is accessible as it arrives, and the booking shows "2 of 3 reports ready".
7. Reports remain available for the lifetime of the account, including for cancelled subscriptions and labs that later leave the platform.

### Acceptance Criteria
- Notification → report open in ≤ 2 taps.
- A report is never visible under the wrong patient profile.
- Report list loads fast even with 100+ historical reports (pagination/lazy loading).

### Edge Cases & Error Handling
- Corrupt/unreadable PDF uploaded → user sees "report being re-issued" instead of a broken file; lab is auto-prompted to re-upload (§7.6).
- Lab uploads a report to the wrong booking and corrects it → the wrong version becomes permanently inaccessible to the previously-notified user, who receives a correction notice.
- Account deleted → user is warned during deletion that reports become unrecoverable, with a "download all reports" option offered first.

---

## 6.8 Payments, Invoices & Refunds

### Overview
Trustworthy money handling: clear prices, multiple payment methods, instant invoices, and predictable refunds.

### User Stories
- As a user, I want to pay with UPI, card, or wallet — whatever I prefer.
- As a user, I want an invoice for every payment, for insurance or employer reimbursement.
- As a user, when something is cancelled, I want to know exactly how much comes back and when.

### Functional Requirements
1. Payment methods: UPI, debit/credit cards, and major mobile wallets; user can save preferred methods for faster checkout and for subscription auto-pay.
2. Order summary always itemizes: each test price, home-collection fee (if any), discounts/offers, taxes (if applicable), and total.
3. Invoice generated automatically for every successful payment, available in booking detail and a consolidated "Payment history" screen; downloadable as PDF; includes lab details required for reimbursement claims.
4. **Refund rules (visible before every cancellation):**
   - Cancelled before cutoff → 100% refund.
   - Cancelled after cutoff → total minus lab's cancellation fee.
   - Cancelled by lab / lab no-confirmation / slot-race failure → 100% automatic refund, no user action needed.
   - Sample issue requiring re-collection → no charge for re-collection; user may instead choose full refund of affected tests.
5. Refunds initiated immediately on the triggering event; user shown expected credit timeline by payment method; refund status (`Initiated` → `Processed` → `Credited`) trackable in payment history.
6. Failed payment never creates a confirmed booking; any amount captured on a failed flow is auto-reversed.
7. Promo codes/offers: single code per order, eligibility validated before payment, discount itemized on invoice.

### Acceptance Criteria
- Price shown at review step is exactly the amount charged — always.
- 100% of successful payments produce an invoice within 1 minute.
- User can answer "where is my refund?" from within the app without contacting support.

### Edge Cases & Error Handling
- Amount debited but confirmation failed (gateway timeout) → booking auto-resolves within 30 minutes to confirmed-or-refunded; user notified either way; never silent.
- Partial cancellation of a multi-test booking → refund computed per cancelled test; collection fee retained only if a visit still occurs.
- Subscription auto-pay failures → handled per §6.5 FR-9.
- Duplicate payment for the same booking (double tap / retry) → duplicate auto-refunded with notification.

---

## 6.9 User Profile, Addresses & Family Members

### Overview
The account hub: personal details, the people the user books for, the places samples are collected, and everything the user has done on Labzy.

### User Stories
- As a caregiver, I want profiles for each family member so bookings and reports stay organized per person.
- As a user, I want saved addresses (home, office, parents' home) for quick home-collection booking.

### Functional Requirements
1. Profile fields: name, mobile (verified), email (optional, verifiable), gender, date of birth, profile photo (optional).
2. **Family members:** add up to 10; each requires name, DOB, gender, and relationship. Each member gets isolated bookings/reports/subscriptions views. Members are profiles under the account (no separate login) — including minors.
3. **Addresses:** save multiple labeled addresses (Home / Work / Other) with map-pin precision plus textual address and landmark; one default; selectable per booking and per subscription.
4. Activity views: Active bookings, Past bookings, Subscriptions (links to §6.5 hub), Reports (links to §6.7), Payment history (links to §6.8).
5. Settings: notification preferences (§6.10), app lock (biometric/PIN), language (English/Hindi v1), saved payment methods, consent & privacy center (view/withdraw consents, request data export, delete account).
6. Editing the mobile number requires OTP verification of the new number.

### Acceptance Criteria
- Switching the "viewing for" family member filters bookings/reports/subscriptions instantly and unmistakably (persistent visual indicator of whose data is shown).
- Deleting an address used by an active subscription is blocked until the subscription is repointed (clear guided flow).

### Edge Cases & Error Handling
- Deleting a family member with active bookings/subscriptions → blocked with a guided resolution (cancel or complete them first); past reports of a deleted member are retained under an archived view with explicit user confirmation at deletion.
- Two family members with identical names → allowed, disambiguated by relationship + age everywhere they're shown.

---

## 6.10 Notifications & Reminders

### Overview
Notifications drive the product's reliability promise — especially for subscriptions and report delivery — without becoming spam.

### Functional Requirements
1. Channels: push (primary), SMS (transactional fallback for critical events), email (if provided, for invoices and reports).
2. **Critical notifications (cannot be disabled):** booking confirmed/cancelled/rejected, payment success/failure/refund, report ready, assistant arrival OTP events, subscription auto-booking outcomes.
3. **Configurable notifications:** pre-booking subscription reminders (timing configurable), preparation reminders, offers & promotions (off by default), rating prompts.
4. Quiet hours (default 10 PM–7 AM) for non-critical notifications; critical ones always deliver.
5. Every notification deep-links to the exact relevant screen (booking detail, report, subscription occurrence).
6. In-app notification center retains the last 90 days of notifications.

### Acceptance Criteria
- A user who disables everything optional still receives every critical event.
- No duplicate notifications for the same event across channels within 5 minutes (channel fallback only when push is undeliverable).

### Edge Cases
- Push permission denied at OS level → app surfaces a one-time explainer; critical events fall back to SMS.

---

## 6.11 Ratings & Reviews

### Functional Requirements
1. After a booking reaches `Completed` (report delivered), the user is prompted once to rate (1–5★) the overall experience, with optional sub-ratings (assistant behavior, timeliness, report TAT) and optional text (≤ 500 chars).
2. One review per completed booking; editable for 7 days after submission.
3. Reviews are moderated against abuse (profanity, personal data like phone numbers in text) before publishing; rejected reviews notify the author with reason.
4. Lab rating = average of last 12 months of booking-verified ratings; labs can post one public reply per review (§ Partner side).
5. Users can report inappropriate reviews.

### Acceptance Criteria
- A user who never completed a booking at a lab can never review it.
- Rating prompt appears at most twice per booking (once on completion, one gentle reminder), then never again for that booking.

---

## 6.12 Help & Support

### Functional Requirements
1. Contextual help on every booking: FAQs relevant to its current state (e.g., "Where is my report?" appears in `Processing`).
2. Raise a ticket against a specific booking/payment/subscription with category selection (delay, refund, report issue, assistant behavior, other) and optional attachments.
3. Ticket states visible to user: `Open` → `In progress` → `Resolved` (with resolution note) → user can reopen within 7 days.
4. Critical categories (payment deducted/no booking, report mix-up, safety concern about a visit) are flagged priority with a faster committed first-response time shown to the user.
5. Self-serve flows for the top issues: refund status, reschedule, cancel, re-send report, change address on subscription.

---

# PART B — LABZY PARTNER APP

---

## 7.1 Lab Onboarding & Verification

### Overview
Only verified, certified labs appear to customers. Onboarding is self-serve with a Labzy verification gate before going live.

### User Stories
- As a lab owner, I want to register my lab, upload my certifications, and start receiving bookings quickly.
- As a customer (indirectly), I want certainty that every certification badge I see was actually verified.

### Functional Requirements
1. Registration: owner mobile + OTP, lab name, full address with map pin, contact details, operating hours per weekday, service modes offered (in-lab / home collection / both), service radius for home collection.
2. Document upload: lab registration/license, certification documents (e.g., NABL), owner identity proof. Each document has states: `Submitted` → `Under review` → `Verified` / `Rejected (with reason)` / `Expired`.
3. A lab goes **live** (visible in customer discovery) only after the mandatory document set is `Verified` and at least 1 test is published with price and TAT.
4. Certification badges shown to customers correspond 1:1 to verified documents; document expiry auto-removes the badge and notifies the owner 30/7/1 days before expiry.
5. **Vacation / pause mode:** owner can pause new bookings for a date range; existing confirmed bookings remain and must be honored or explicitly rescheduled/cancelled per policy.
6. Multi-branch support: an owner account can register multiple branches; each branch has its own catalog, hours, staff, bookings, and rating, with an owner-level consolidated view.
7. Profile edits to critical trust fields (lab name, address, certifications) re-enter review; non-critical edits (photos, hours) apply immediately.

### Acceptance Criteria
- No unverified lab is ever discoverable by customers.
- Verification decisions are communicated within a stated SLA (target 48 hours) with actionable rejection reasons.
- Expired certification never displays as a valid badge — automatic, not manual.

### Edge Cases & Error Handling
- Document rejected → owner can resubmit with the rejection reason visible; resubmission resets only that document's review, not the whole application.
- Lab address change to a different service area → existing home-collection subscriptions in the old radius are flagged and affected customers notified (§6.5 migration).
- Owner deactivates lab permanently → all future bookings auto-cancelled with full refunds, all subscriptions enter migration flow, reports already delivered remain accessible to customers.

---

## 7.2 Test Catalog & Pricing Management

### Overview
The lab's storefront. Owners control exactly what's bookable, at what price, with what preparation and turnaround commitments.

### User Stories
- As a lab owner, I want to add tests from a standard catalog so I don't type descriptions myself, but set my own prices and TATs.
- As an owner, I want to bundle tests into a discounted health package.

### Functional Requirements
1. Add tests from Labzy's master test directory (standard names, descriptions, sample types, default preparation guidance) — owner sets: price, TAT, availability per mode (in-lab/home), and optional custom preparation notes. Custom (non-directory) tests can be submitted for Labzy review before publishing.
2. Mandatory fields to publish a test: price > 0, TAT, sample type, at least one available mode. Missing any → test stays in `Draft`.
3. Health packages: select component tests, set package price (must be ≤ sum of components), package-level description and TAT (longest component by default).
4. Price changes: take effect for new bookings immediately; never alter already-confirmed bookings; trigger subscription re-consent flow (§6.5 FR-8) for affected subscriptions.
5. Test states: `Draft` → `Published` → `Temporarily unavailable` → `Published`; `Published` → `Discontinued` (terminal). Discontinuing a test with active subscriptions shows the impact count and triggers the customer migration flow.
6. Bulk operations: enable/disable home collection across selected tests, bulk price update with preview, CSV import/export of the catalog.
7. Slot & capacity setup: define bookable hours, slot length, and per-slot capacity separately for in-lab and home-collection; blackout specific dates (holidays).

### Acceptance Criteria
- Customer app never shows a test the lab hasn't published, and never shows a published test without price + TAT.
- A price change is reflected to customers within 1 minute, with in-cart protections per §6.3.
- Capacity settings are strictly enforced — overbooking is impossible from the customer side.

### Edge Cases
- Package component discontinued → package auto-unpublishes with owner notification until edited.
- Owner sets package price above components' sum → blocked with explanation.

---

## 7.3 Order & Schedule Management

### Overview
The lab's daily command center: see everything coming, act on each booking, keep statuses true.

### User Stories
- As a lab manager, I want today's bookings in time order — home visits and walk-ins clearly separated — so I can run the day.
- As a manager, I want to accept or reject new bookings fast, and reassign visits when an assistant calls in sick.

### Functional Requirements
1. **Today view:** chronological list split by mode (Home / In-lab), each card showing time, patient name & age, tests, status, assigned assistant (home), and payment status. Calendar views: day / week.
2. **New booking handling:** every incoming booking requires Accept or Reject within the response SLA (default 2 hours, never later than slot start). Reject requires a reason (slot unavailable, area not serviceable, test unavailable, other) — reason drives the customer-side messaging and metrics.
3. **Status controls per booking:** confirm → assign assistant (home) → mark arrived/checked-in → mark sample collected (OTP-verified for home, §6.6) → mark processing → upload report (§7.6) → completed. Partner statuses mirror exactly the customer-visible states in §6.4.
4. **Reschedule/cancel by lab:** allowed with mandatory reason; customer auto-notified with options; lab-initiated cancellations always trigger full refund and count against the lab's reliability metrics.
5. **Sample issue flow:** flag a collected sample (hemolyzed/insufficient/mislabeled) → customer auto-notified → guided free re-collection scheduling.
6. Search & filters across bookings: by booking ID, patient name, phone (masked match), date range, status, test, assistant.
7. Recurring bookings are visually badged ("Subscription") with the occurrence number, so staff recognize regular customers.
8. Walk-in entries: front desk can register a walk-in customer (with customer consent via OTP) so their report is delivered digitally — bringing offline customers into the platform.

### Acceptance Criteria
- No booking can sit unactioned past its response SLA without escalating notifications to manager and owner.
- Every lab-side status change is reflected to the customer in near-real-time.
- A booking can never skip states (e.g., cannot mark `Report ready` before `Sample collected`).

### Edge Cases
- Assistant marks collected but OTP never verified → status held in `Arrived` with a dispute path; cannot proceed to `Processing`.
- Two staff act on the same booking simultaneously → last action prompts a refresh-and-confirm instead of silently overwriting.

---

## 7.4 Lab Assistant / Staff Management

### Overview
Owners manage who works in the lab and in the field, with role-appropriate access and accountability per visit.

### Functional Requirements
1. Owner creates staff accounts: Lab Manager and Lab Assistant roles (permissions per §4.3); staff log in with their own mobile + OTP.
2. Assistant profile: name, photo (mandatory — shown to customers), verified mobile, service status (Active/Inactive).
3. **Assignment:** managers assign home-collection bookings to assistants; assistants see only their own assigned visits — never the full lab schedule or revenue.
4. **Assistant day view:** route-ordered list of assigned visits with time window, address, map link, tests, preparation status, and visit notes; actions: `Start journey` (→ customer sees "On the way"), `Arrived`, enter collection OTP, add visit remarks.
5. Reassignment mid-day: instantly updates the new assistant's list and notifies the customer (§6.6 FR-4).
6. Per-assistant performance metrics for owner/manager: visits completed, on-time arrival rate, OTP verification rate, customer sub-ratings, no-show disputes.
7. Deactivating an assistant blocks login immediately and forces reassignment of their pending visits via a guided flow.

### Acceptance Criteria
- An assistant can never see another assistant's visits, lab finances, or any customer's full history beyond their assigned visit's needs.
- Every customer-facing assistant has a photo and verified identity before first assignment.

---

## 7.5 Customer Test History

### Overview
Context that makes service personal: when a known customer books again, staff see the relationship at a glance.

### Functional Requirements
1. Customer record per lab: list of that customer's bookings *at this lab* with dates, tests, statuses, reports uploaded, and payment/invoice references. (Labs never see the customer's activity at other labs.)
2. Repeat-customer indicators: total bookings, subscription customer badge, last visit date.
3. Quick actions from a customer record: view past report (this lab only), see upcoming bookings, contact via masked call for an active booking.
4. Notes field for operational remarks (e.g., "difficult veins — senior assistant preferred") — visible to lab staff only, never to customer, and excluded from anything customer-facing.

### Acceptance Criteria
- Cross-lab privacy holds absolutely: Lab A can never infer or access bookings at Lab B.
- Staff notes never leak into reports, notifications, or customer screens.

---

## 7.6 Report Upload & Delivery

### Overview
Closing the loop. Reports must reach the right booking, the right patient, on time.

### User Stories
- As a lab manager, I want uploading a report to be one quick step that automatically notifies the customer.
- As an owner, I want to see which reports are due soon and which are overdue, so TAT promises are kept.

### Functional Requirements
1. Upload PDF report(s) against a booking; multi-test bookings allow per-test upload (customer sees partials, §6.7 FR-6).
2. Pre-upload confirmation shows patient name, age, tests — uploader must confirm match before publishing.
3. On publish: booking → `Report ready`, customer notified instantly.
4. **Replace/correct:** a published report can be replaced with a mandatory reason; customer gets a correction notice and the old file becomes inaccessible (§6.7 edge cases). All replacements are logged and visible to the owner.
5. **TAT board:** queue of bookings in `Processing` sorted by report due time, with `Due soon` (≤ 4 hours) and `Overdue` flags; overdue items notify manager and owner and prompt sending the customer a revised ETA.
6. Bulk upload supported with per-file booking matching and the same confirmation gate.

### Acceptance Criteria
- A report can only ever be attached to one booking and one patient; the confirmation gate makes a mismatch a deliberate act, not an accident.
- TAT compliance per lab is computed automatically and feeds the owner dashboard (§7.8) and internal lab quality metrics.

### Edge Cases
- Upload of a corrupt/unreadable file → rejected at upload with reason; never reaches the customer.
- Wrong-booking upload caught after publish → replacement flow with correction notice (never silent deletion).

---

## 7.7 Notifications & Alerts (Partner)

### Functional Requirements
1. **Owner & manager critical alerts (non-disablable):** new booking received, booking nearing response SLA, customer cancellation/reschedule, payment/refund events on their bookings, report overdue, certification expiring, subscription customer impacted by their catalog/price changes.
2. **Assistant alerts:** new assignment, reassignment, schedule change, upcoming visit reminder (60 min before window).
3. Configurable digest: daily morning summary (today's bookings, expected revenue, pending actions) and end-of-day recap.
4. Channels: push primary; SMS fallback for critical, time-sensitive items (e.g., new booking with imminent slot).
5. Every alert deep-links to the actionable screen.

---

## 7.8 Dashboard & Analytics

### Overview
The owner's business cockpit: how the lab is doing, what's selling, when, and who's performing.

### Functional Requirements
1. **Overview (selectable range: today / 7d / 30d / custom):** bookings (received / accepted / completed / cancelled), revenue (gross, refunds, net), average rating, TAT compliance %, acceptance rate, no-show rate.
2. **Revenue analytics:** trend over time, split by mode (home vs in-lab), by test/package, refund impact.
3. **Demand patterns:** popular tests ranking, peak booking hours/days heatmap, home-collection demand by area (to tune service radius and staffing).
4. **Customer insights:** new vs repeat ratio, subscription customers count and their revenue share, top repeat customers (count-based, privacy-respecting).
5. **Staff performance:** per-assistant metrics from §7.4 FR-6 in comparable form.
6. **Quality panel:** rating trend, review feed with reply action (one public reply per review), complaint/ticket categories trend.
7. Export any view's underlying summary as CSV/PDF for the owner's records.
8. Multi-branch owners get consolidated + per-branch toggles on every panel.

### Acceptance Criteria
- Numbers reconcile: dashboard revenue for a period matches the sum of that period's invoices minus refunds — always.
- All analytics are scoped strictly to the owner's own lab(s).

---

## 7.9 Earnings & Settlements

### Overview
Transparent money flow from customer payments to the lab's account.

### Functional Requirements
1. Earnings screen: per-booking earning breakdown (test amount + collection fee − Labzy commission − refunds/fees), aggregated per settlement cycle.
2. Settlement cycle and payout status visible (`Accrued` → `Settlement initiated` → `Paid`), with downloadable settlement statements per cycle.
3. Disputes: owner can raise a dispute on a specific booking's settlement line with reason and evidence; dispute status trackable.
4. Commission structure shown transparently in the app; any change communicated in advance with effective date.

### Acceptance Criteria
- Every rupee of a settlement is traceable to specific bookings; no unexplained adjustments.

---

# PART C — CROSS-CUTTING PRODUCT REQUIREMENTS (Feature-Level)

## 8.1 Privacy, Consent & Trust
1. Health data is private by default; nothing about a user's tests is ever visible to other users, other labs, or any third party.
2. Consent center (customer §6.9): every consent viewable and withdrawable; withdrawing health-record consent triggers the account-deletion explanation flow.
3. Labs see only what's operationally needed per booking; staff see less than managers; assistants see only their assigned visits (§4.3, §7.4).
4. Masked communication everywhere customer ↔ lab/assistant contact is needed; real numbers never exchanged.
5. Data export: customer can request a complete export of their data (profile, bookings, invoices, reports) delivered within a stated SLA.

## 8.2 Reliability Promises (Product-Level SLAs)
| Promise | Commitment |
|---|---|
| Booking response by lab | ≤ 2 hours (else escalation → auto-cancel + refund per §6.4) |
| Report by committed TAT | Tracked per booking; misses trigger proactive customer comms |
| Refund initiation | Immediate on triggering event |
| Subscription occurrence outcome | Always explicit — booked / pending approval / skipped / no-slot notice |

## 8.3 Accessibility & Inclusivity
1. Plain-language test descriptions (no unexplained medical jargon) throughout the customer app.
2. Support for larger system font sizes without layout breakage on all critical flows.
3. English + Hindi in v1; language switch without data loss.
4. Booking on behalf of others (family members, including elderly and minors) is a first-class flow, not a workaround.

## 8.4 Content & Communication Standards
1. All customer-facing communication (notifications, status texts, error messages) follows a defined tone: clear, calm, never alarmist — health context demands it.
2. Every error state shown to a user includes what happened + what happens next + what (if anything) the user should do.

---

## 9. Future Roadmap (Post-v1)

| Phase | Feature | Rationale |
|---|---|---|
| v1.1 | Health-app integrations (Apple Health / Google Fit) | Pull context, push structured results where supported |
| v1.1 | Loyalty & rewards for subscription users | Reinforce the recurring habit loop |
| v1.2 | Smart test recommendations (based on history, age, doctor inputs) | Predictive, preventive value — strictly opt-in |
| v1.2 | Trend view of results over time for recurring tests | Turn repeated PDFs into a health trendline |
| v1.3 | Doctor sharing portal (time-limited secure report links) | Safer than PDF forwarding |
| v1.3 | Corporate/family plans | Bulk annual checkups for employers and families |
| v2.0 | Web portal for customers and partners | Desktop workflows, larger labs |
| v2.0 | More languages (Gujarati, Marathi, Tamil, …) | Regional depth |

---

## 10. Open Questions & Assumptions

**Open questions (to resolve before build):**
1. Commission model: flat % per booking vs tiered by volume — affects §7.9 displays.
2. Should home-collection service radius be a hard block or allow "request anyway" with lab discretion?
3. Maximum advance-booking window — 14 days assumed; confirm with lab partners.
4. No-show fee: platform-standard cap vs fully lab-defined?
5. Should subscription auto-pay support mandate-style recurring payment consent in v1, or approve-per-occurrence only at launch with auto-pay in v1.1?
6. Walk-in digitization (§7.3 FR-8): in v1 or deferred?

**Assumptions:**
- Labzy operates as a marketplace/facilitator; medical responsibility for testing and reports remains with the certified lab.
- One country, metro-first launch; pricing in INR.
- The master test directory (§7.2) is curated by Labzy with medical review.

---

*End of document — Labzy PRD v2.0 (Expanded, feature-wise). Prepared for product review; technical/implementation planning to follow as a separate document.*
