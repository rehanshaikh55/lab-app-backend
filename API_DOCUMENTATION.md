# Labzy Backend — API Integration Guide

> This document is intended as a complete reference for AI-assisted frontend integration. Every endpoint, request shape, response shape, authentication requirement, and error code is described here.

---

## Table of Contents

1. [Server Configuration](#1-server-configuration)
2. [Authentication & Token Management](#2-authentication--token-management)
3. [Request / Response Conventions](#3-request--response-conventions)
4. [Error Handling](#4-error-handling)
5. [Auth Endpoints](#5-auth-endpoints)
6. [Profile Endpoints](#6-profile-endpoints)
7. [Lab Endpoints](#7-lab-endpoints)
8. [Test Endpoints](#8-test-endpoints)
9. [Booking Endpoints](#9-booking-endpoints)
10. [Report Endpoints](#10-report-endpoints)
11. [Subscription Endpoints](#11-subscription-endpoints)
12. [Partner (Lab Owner) Endpoints](#12-partner-lab-owner-endpoints)
13. [Role Reference](#13-role-reference)
14. [Common Data Shapes](#14-common-data-shapes)

---

## 1. Server Configuration

| Property | Value |
|---|---|
| Base URL (dev) | `http://localhost:3000` |
| API prefix | `/api` |
| Framework | Fastify 5.x |
| Database | MongoDB |
| File storage | Firebase Storage |
| Default content-type | `application/json` |

All routes below are relative to `/api`. Example: `POST /api/auth/login`.

---

## 2. Authentication & Token Management

### Token Types

| Token | Lifetime | Header/Field |
|---|---|---|
| Access token | 15 minutes | `Authorization: Bearer <accessToken>` |
| Refresh token | 7 days | Body field `refreshToken` |

- Access token payload: `{ id: userId }`
- Algorithm: HS256
- Refresh token is hashed and stored server-side; only one valid refresh token per user at a time.

### Token Usage

Every **protected** endpoint requires:

```
Authorization: Bearer <accessToken>
```

When the access token expires, call `POST /api/auth/refresh` with the refresh token to get a new pair. If the refresh token has also expired, the user must log in again.

### CORS

| Environment | Allowed origins |
|---|---|
| Development | All (`*`) |
| Production | `FRONTEND_URL` env value only |

---

## 3. Request / Response Conventions

- All request bodies must be `Content-Type: application/json` unless noted (file upload uses `multipart/form-data`).
- Dates in requests: ISO 8601 string, e.g. `"2024-06-15"` or `"2024-06-15T09:00:00Z"`.
- ObjectIds in responses: 24-char hex strings.
- Pagination uses `page` (1-based) and `limit` query params; responses include `total`, `page`, `limit`, `pages`.

---

## 4. Error Handling

All errors follow [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807) Problem Details format:

```json
{
  "type": "https://labzy.in/errors/ERROR_CODE",
  "title": "Human-Readable Title",
  "status": 400,
  "detail": "Detailed message explaining what went wrong",
  "instance": "/api/path/that/failed"
}
```

### Error Code Reference

| Code | HTTP Status | When |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing, expired, or invalid JWT |
| `FORBIDDEN` | 403 | Authenticated but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Invalid request body / params |
| `CONFLICT` | 409 | General business logic violation |
| `SLOT_UNAVAILABLE` | 409 | Slot is fully booked |
| `LAB_CLOSED` | 422 | Lab is not open on the requested date |
| `INVALID_BOOKING_TRANSITION` | 409 | Booking status change not allowed |
| `INVALID_SUBSCRIPTION_STATE` | 409 | Subscription state change not allowed |
| `REPORT_ACCESS_DENIED` | 403 | User is not authorised to view this report |
| `FILE_TOO_LARGE` | 413 | Uploaded file exceeds 10 MB |
| `INVALID_FILE_TYPE` | 415 | Only PDF files are accepted |

---

## 5. Auth Endpoints

### 5.1 Register

```
POST /api/auth/register
```

**Auth:** None

**Request body:**
```json
{
  "name": "string (required, minLength: 2)",
  "email": "string (required, valid email)",
  "password": "string (required, minLength: 6)",
  "phone": "string (optional)",
  "role": "CUSTOMER | LAB_OWNER (optional, default: CUSTOMER)"
}
```

**Response 201:**
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": {
    "id": "ObjectId",
    "name": "string",
    "email": "string",
    "roles": ["CUSTOMER"]
  }
}
```

---

### 5.2 Login

```
POST /api/auth/login
```

**Auth:** None

**Request body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response 200:**
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": {
    "id": "ObjectId",
    "name": "string",
    "email": "string",
    "roles": ["string"]
  }
}
```

---

### 5.3 Refresh Token

```
POST /api/auth/refresh
```

**Auth:** None

**Request body:**
```json
{
  "refreshToken": "string (required)"
}
```

**Response 200:**
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

---

### 5.4 Forgot Password

```
POST /api/auth/forgot-password
```

**Auth:** None

**Request body:**
```json
{
  "email": "string (required)"
}
```

**Response 200:** (always the same regardless of whether the email exists — prevents enumeration)
```json
{
  "message": "If that email exists, a reset link was sent"
}
```

---

### 5.5 Reset Password

```
POST /api/auth/reset-password/:token
```

**Auth:** None

**URL params:**
- `token` — the token embedded in the reset-password email link

**Request body:**
```json
{
  "newPassword": "string (required, minLength: 6)"
}
```

**Response 200:**
```json
{
  "message": "Password reset successfully"
}
```

---

### 5.6 Logout

```
POST /api/auth/logout
```

**Auth:** Required

**Response 200:**
```json
{
  "message": "Logged out successfully"
}
```

---

## 6. Profile Endpoints

### 6.1 Get My Profile

```
GET /api/me
```

**Auth:** Required

**Response 200:**
```json
{
  "user": {
    "_id": "ObjectId",
    "name": "string",
    "email": "string",
    "phone": "string",
    "roles": ["string"],
    "gender": "male | female | other | prefer_not_to_say",
    "birthDate": "ISO date string",
    "fcmToken": "string",
    "addresses": [
      {
        "_id": "ObjectId",
        "label": "string",
        "line1": "string",
        "line2": "string",
        "city": "string",
        "state": "string",
        "zipCode": "string",
        "country": "string"
      }
    ],
    "location": {
      "type": "Point",
      "coordinates": [longitude, latitude]
    },
    "createdAt": "ISO date string",
    "updatedAt": "ISO date string"
  }
}
```

---

### 6.2 Update Profile

```
PUT /api/profile
```

**Auth:** Required

**Request body:** (all fields optional)
```json
{
  "name": "string",
  "phone": "string",
  "fcmToken": "string",
  "gender": "male | female | other | prefer_not_to_say",
  "birthDate": "ISO date string"
}
```

**Response 200:** Updated user object (same shape as `GET /api/me`)

---

### 6.3 Add Address

```
POST /api/addresses
```

**Auth:** Required

**Request body:**
```json
{
  "label": "string (optional, default: 'Home')",
  "line1": "string (required)",
  "line2": "string (optional)",
  "city": "string (required)",
  "state": "string (required)",
  "zipCode": "string (required)",
  "country": "string (optional, default: 'India')"
}
```

**Response 201:**
```json
{
  "addresses": [
    {
      "_id": "ObjectId",
      "label": "string",
      "line1": "string",
      "line2": "string",
      "city": "string",
      "state": "string",
      "zipCode": "string",
      "country": "string"
    }
  ]
}
```

---

### 6.4 Update Address

```
PUT /api/addresses/:id
```

**Auth:** Required

**URL params:** `id` — address `_id`

**Request body:** (all fields optional)
```json
{
  "label": "string",
  "line1": "string",
  "line2": "string",
  "city": "string",
  "state": "string",
  "zipCode": "string",
  "country": "string"
}
```

**Response 200:** `{ "addresses": [...] }`

---

### 6.5 Delete Address

```
DELETE /api/addresses/:id
```

**Auth:** Required

**URL params:** `id` — address `_id`

**Response 200:** `{ "addresses": [...] }` (remaining addresses)

---

### 6.6 Update Location

```
POST /api/location
```

**Auth:** Required

**Request body:** (provide either `address` OR `latitude`+`longitude`)
```json
{
  "address": "string (optional — geocoded to coordinates)",
  "latitude": "number (optional)",
  "longitude": "number (optional)"
}
```

**Response 200:**
```json
{
  "user": { /* full user object */ },
  "resolvedAddress": "string"
}
```

---

## 7. Lab Endpoints

### 7.1 Get All Labs

```
GET /api/labs
```

**Auth:** Required

**Query params:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `search` | string | No | Case-insensitive name search |
| `city` | string | No | Filter by city |
| `isActive` | string | No | `true` \| `false` |
| `isVerified` | string | No | `true` \| `false` |
| `sortBy` | string | No | `name` \| `rating` \| `createdAt` (default: `createdAt`) |
| `order` | string | No | `asc` \| `desc` (default: `desc`) |
| `page` | integer | No | Default 1 |
| `limit` | integer | No | Default 20, max 100 |

**Response 200:**
```json
{
  "labs": [
    {
      "_id": "ObjectId",
      "owner": { "_id": "ObjectId", "name": "string", "email": "string", "phone": "string" },
      "name": "string",
      "address": { /* address object */ },
      "location": { "type": "Point", "coordinates": [lng, lat] },
      "phone": "string",
      "email": "string",
      "certifications": ["string"],
      "openingHours": { /* day map */ },
      "slotMatrix": { "duration": "number", "intervalMinutes": "number", "maxBookingsPerSlot": "number" },
      "rating": "number",
      "totalRatings": "number",
      "isActive": "boolean",
      "isVerified": "boolean",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ],
  "total": "number",
  "page": "number",
  "limit": "number",
  "pages": "number"
}
```

---

### 7.3 Get Nearby Labs

```
GET /api/labs/nearby
```

**Auth:** Required

**Query params:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `lat` | number | Yes | User latitude |
| `lng` | number | Yes | User longitude |
| `radius` | integer | No | Metres, default 5000 |
| `minRating` | number | No | Minimum rating filter |
| `page` | integer | No | Default 1 |
| `limit` | integer | No | Default 20 |

**Response 200:**
```json
{
  "labs": [
    {
      "_id": "ObjectId",
      "owner": "ObjectId",
      "name": "string",
      "address": { /* address object */ },
      "location": { "type": "Point", "coordinates": [lng, lat] },
      "phone": "string",
      "email": "string",
      "certifications": ["string"],
      "openingHours": {
        "monday": { "open": "HH:MM", "close": "HH:MM", "isClosed": false },
        "tuesday": { "open": "HH:MM", "close": "HH:MM", "isClosed": false },
        "wednesday": { "open": "HH:MM", "close": "HH:MM", "isClosed": false },
        "thursday": { "open": "HH:MM", "close": "HH:MM", "isClosed": false },
        "friday": { "open": "HH:MM", "close": "HH:MM", "isClosed": false },
        "saturday": { "open": "HH:MM", "close": "HH:MM", "isClosed": true },
        "sunday": { "open": "HH:MM", "close": "HH:MM", "isClosed": true }
      },
      "slotMatrix": {
        "duration": "number (minutes)",
        "intervalMinutes": "number",
        "maxBookingsPerSlot": "number (default: 5)"
      },
      "rating": "number",
      "totalRatings": "number",
      "isActive": "boolean",
      "isVerified": "boolean",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ],
  "count": "number"
}
```

---

### 7.4 Get Lab by ID

```
GET /api/labs/:id
```

**Auth:** Required

**URL params:** `id` — lab `_id`

**Response 200:**
```json
{
  "lab": { /* same shape as labs array item above, owner field populated */ }
}
```

---

### 7.5 Get Lab Tests

```
GET /api/labs/:id/tests
```

**Auth:** Required

**URL params:** `id` — lab `_id`

**Response 200:**
```json
{
  "tests": [
    {
      "_id": "ObjectId",
      "lab": "ObjectId",
      "name": "string",
      "category": "string",
      "description": "string",
      "price": "number",
      "sampleRequirements": "string",
      "turnaroundHours": "number",
      "isActive": "boolean",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ]
}
```

---

### 7.6 Get Lab Available Slots

```
GET /api/labs/:id/slots
```

**Auth:** Required

**URL params:** `id` — lab `_id`

**Query params:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `date` | string | Yes | Format: `YYYY-MM-DD` |

**Response 200:**
```json
{
  "date": "YYYY-MM-DD",
  "slots": [
    {
      "start": "HH:MM",
      "end": "HH:MM",
      "available": "boolean",
      "booked": "number",
      "capacity": "number"
    }
  ]
}
```

> **Frontend note:** Only show slots where `available === true`. If the lab is closed on the selected date the server returns `LAB_CLOSED` (422).

---

## 8. Test Endpoints

### 8.1 Search / List All Tests

```
GET /api/tests
```

**Auth:** Required

**Query params:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | No | Full-text search on name and category |
| `category` | string | No | Case-insensitive category filter |
| `minPrice` | number | No | |
| `maxPrice` | number | No | |
| `sortBy` | string | No | `price` \| `name` \| `turnaroundHours` \| `createdAt` (default: `price`) |
| `order` | string | No | `asc` \| `desc` (default: `asc`) |
| `page` | integer | No | Default 1 |
| `limit` | integer | No | Default 20, max 100 |

**Response 200:**
```json
{
  "tests": [
    {
      "_id": "ObjectId",
      "lab": {
        "_id": "ObjectId",
        "name": "string",
        "address": { /* address object */ },
        "rating": "number",
        "certifications": ["string"],
        "isActive": "boolean"
      },
      "name": "string",
      "category": "string",
      "description": "string",
      "price": "number",
      "sampleRequirements": "string",
      "turnaroundHours": "number",
      "isActive": "boolean",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ],
  "total": "number",
  "page": "number",
  "limit": "number",
  "pages": "number"
}
```

---

## 9. Booking Endpoints

### Booking Status Flow

```
PENDING ──► CONFIRMED ──► COLLECTED ──► COMPLETED
    │            │
    └────────────┴──► CANCELLED
```

- Pending bookings expire after 15 minutes (slot hold released).
- CUSTOMER can cancel from PENDING or CONFIRMED.
- LAB_OWNER can accept (PENDING → CONFIRMED) or reject (PENDING/CONFIRMED → CANCELLED).

---

### 9.1 Create Booking

```
POST /api/bookings
```

**Auth:** Required | **Role:** CUSTOMER

**Request body:**
```json
{
  "labId": "string (required)",
  "testIds": ["string"] (required, at least 1 test ID)",
  "scheduledDate": "YYYY-MM-DD (required)",
  "slot": {
    "start": "HH:MM (required)"
  },
  "collectionType": "HOME | IN_LAB (required)",
  "userAddressId": "string (required when collectionType is HOME)"
}
```

**Response 201:**
```json
{
  "booking": {
    "_id": "ObjectId",
    "user": "ObjectId",
    "lab": "ObjectId",
    "tests": ["ObjectId"],
    "subscription": "ObjectId | null",
    "scheduledDate": "ISO date string",
    "slot": { "start": "HH:MM", "end": "HH:MM" },
    "status": "PENDING",
    "collectionType": "HOME | IN_LAB",
    "userAddress": { /* address snapshot */ },
    "totalAmount": "number",
    "labAssistant": "ObjectId | null",
    "report": "ObjectId | null",
    "cancelReason": "string | null",
    "slotHoldExpiry": "ISO date string",
    "createdAt": "ISO date string",
    "updatedAt": "ISO date string"
  }
}
```

**Common errors:** `SLOT_UNAVAILABLE` (409), `LAB_CLOSED` (422), `NOT_FOUND` (404)

---

### 9.2 List My Bookings

```
GET /api/bookings
```

**Auth:** Required

**Query params:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | string | No | `PENDING` \| `CONFIRMED` \| `COLLECTED` \| `COMPLETED` \| `CANCELLED` |
| `page` | integer | No | Default 1 |
| `limit` | integer | No | Default 20 |

**Response 200:**
```json
{
  "bookings": [
    {
      "_id": "ObjectId",
      "lab": { "_id": "ObjectId", "name": "string", "address": { /* ... */ } },
      "tests": [ { "_id": "ObjectId", "name": "string", "price": "number" } ],
      "scheduledDate": "ISO date string",
      "slot": { "start": "HH:MM", "end": "HH:MM" },
      "status": "string",
      "collectionType": "string",
      "totalAmount": "number",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ],
  "total": "number",
  "page": "number",
  "limit": "number"
}
```

---

### 9.3 Get Booking by ID

```
GET /api/bookings/:id
```

**Auth:** Required

**URL params:** `id` — booking `_id`

**Response 200:**
```json
{
  "booking": {
    "_id": "ObjectId",
    "lab": {
      "_id": "ObjectId",
      "name": "string",
      "address": { /* ... */ },
      "phone": "string"
    },
    "tests": [
      {
        "_id": "ObjectId",
        "name": "string",
        "price": "number",
        "sampleRequirements": "string"
      }
    ],
    "labAssistant": { "_id": "ObjectId", "name": "string", "phone": "string" },
    "report": { /* report object or null */ },
    "status": "string",
    "slot": { "start": "HH:MM", "end": "HH:MM" },
    "totalAmount": "number",
    "collectionType": "string",
    "userAddress": { /* ... */ },
    "cancelReason": "string | null",
    "createdAt": "ISO date string",
    "updatedAt": "ISO date string"
  }
}
```

---

### 9.4 Cancel Booking

```
POST /api/bookings/:id/cancel
```

**Auth:** Required

**URL params:** `id` — booking `_id`

**Request body:**
```json
{
  "reason": "string (optional)"
}
```

**Response 200:**
```json
{
  "booking": { /* updated booking with status: CANCELLED */ }
}
```

**Allowed from:** PENDING, CONFIRMED  
**Error:** `INVALID_BOOKING_TRANSITION` (409) if status is COLLECTED, COMPLETED, or already CANCELLED

---

### 9.5 Get Booking Report

```
GET /api/bookings/:id/report
```

**Auth:** Required

**URL params:** `id` — booking `_id`

**Response 200:**
```json
{
  "signedUrl": "string (Firebase Storage signed URL, valid for limited time)",
  "issuedAt": "ISO date string"
}
```

> Use `signedUrl` to download/display the PDF report. The URL expires; do not store it long-term.

---

## 10. Report Endpoints

### 10.1 Get Report by ID

```
GET /api/reports/:id
```

**Auth:** Required

**URL params:** `id` — report `_id`

**Response 200:**
```json
{
  "signedUrl": "string",
  "issuedAt": "ISO date string"
}
```

**Error:** `REPORT_ACCESS_DENIED` (403) if the authenticated user does not own the associated booking.

---

## 11. Subscription Endpoints

### Subscription Status Flow

```
ACTIVE ──► PAUSED ──► ACTIVE
  │
  └──► CANCELLED (terminal)
```

---

### 11.1 Create Subscription

```
POST /api/subscriptions
```

**Auth:** Required | **Role:** CUSTOMER

**Request body:**
```json
{
  "labId": "string (required)",
  "testId": "string (required)",
  "frequency": "WEEKLY | MONTHLY | CUSTOM (required)",
  "customIntervalDays": "integer >= 1 (required when frequency is CUSTOM)",
  "autoPayment": "boolean (optional)",
  "startDate": "YYYY-MM-DD (optional)"
}
```

**Response 201:**
```json
{
  "subscription": {
    "_id": "ObjectId",
    "user": "ObjectId",
    "lab": "ObjectId",
    "test": "ObjectId",
    "frequency": "string",
    "customIntervalDays": "number | null",
    "nextBookingDate": "ISO date string",
    "autoPayment": "boolean",
    "status": "ACTIVE",
    "lastRunAt": "ISO date string | null",
    "retryCount": "number",
    "createdAt": "ISO date string",
    "updatedAt": "ISO date string"
  }
}
```

---

### 11.2 List My Subscriptions

```
GET /api/subscriptions
```

**Auth:** Required

**Response 200:**
```json
{
  "subscriptions": [
    {
      "_id": "ObjectId",
      "lab": { "_id": "ObjectId", "name": "string" },
      "test": { "_id": "ObjectId", "name": "string", "price": "number" },
      "frequency": "string",
      "nextBookingDate": "ISO date string",
      "autoPayment": "boolean",
      "status": "ACTIVE | PAUSED | CANCELLED",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ]
}
```

---

### 11.3 Get Subscription by ID

```
GET /api/subscriptions/:id
```

**Auth:** Required

**URL params:** `id` — subscription `_id`

**Response 200:** `{ "subscription": { /* full subscription object */ } }`

---

### 11.4 Update Subscription

```
PUT /api/subscriptions/:id
```

**Auth:** Required

**URL params:** `id` — subscription `_id`

**Request body:** (all optional)
```json
{
  "frequency": "WEEKLY | MONTHLY | CUSTOM",
  "customIntervalDays": "integer >= 1",
  "autoPayment": "boolean"
}
```

**Response 200:** `{ "subscription": { /* updated object */ } }`

---

### 11.5 Pause Subscription

```
POST /api/subscriptions/:id/pause
```

**Auth:** Required

**URL params:** `id` — subscription `_id`

**Response 200:** `{ "subscription": { /* status: PAUSED */ } }`

**Error:** `INVALID_SUBSCRIPTION_STATE` (409) if not currently ACTIVE

---

### 11.6 Resume Subscription

```
POST /api/subscriptions/:id/resume
```

**Auth:** Required

**URL params:** `id` — subscription `_id`

**Response 200:** `{ "subscription": { /* status: ACTIVE */ } }`

**Error:** `INVALID_SUBSCRIPTION_STATE` (409) if not currently PAUSED

---

### 11.7 Cancel Subscription

```
POST /api/subscriptions/:id/cancel
```

**Auth:** Required

**URL params:** `id` — subscription `_id`

**Response 200:** `{ "subscription": { /* status: CANCELLED */ } }`

**Note:** This is a terminal state — a cancelled subscription cannot be resumed.

---

## 12. Partner (Lab Owner) Endpoints

All endpoints in this section require:
- **Auth:** Required
- **Role:** LAB_OWNER

The authenticated lab owner only sees data for their own lab.

---

### 12.1 Get Today's Bookings

```
GET /api/partner/bookings/daily
```

**Response 200:**
```json
{
  "date": "YYYY-MM-DD",
  "bookings": [
    {
      "_id": "ObjectId",
      "user": { "_id": "ObjectId", "name": "string", "phone": "string", "email": "string" },
      "tests": [ { "_id": "ObjectId", "name": "string", "price": "number" } ],
      "labAssistant": { "_id": "ObjectId", "name": "string", "phone": "string" },
      "slot": { "start": "HH:MM", "end": "HH:MM" },
      "status": "string",
      "collectionType": "string",
      "totalAmount": "number"
    }
  ]
}
```

---

### 12.2 List All Bookings (Paginated)

```
GET /api/partner/bookings
```

**Query params:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | string | No | `PENDING` \| `CONFIRMED` \| `COLLECTED` \| `COMPLETED` \| `CANCELLED` |
| `page` | integer | No | Default 1 |
| `limit` | integer | No | Default 20 |

**Response 200:** `{ "bookings": [...], "total", "page", "limit" }`

---

### 12.3 Accept Booking

```
POST /api/partner/bookings/:id/accept
```

**URL params:** `id` — booking `_id`

**Response 200:** `{ "booking": { /* status: CONFIRMED */ } }`

**Transition:** PENDING → CONFIRMED  
**Error:** `INVALID_BOOKING_TRANSITION` (409) if not PENDING

---

### 12.4 Reject Booking

```
POST /api/partner/bookings/:id/reject
```

**URL params:** `id` — booking `_id`

**Request body:**
```json
{
  "reason": "string (optional)"
}
```

**Response 200:** `{ "booking": { /* status: CANCELLED */ } }`

**Transition:** PENDING or CONFIRMED → CANCELLED

---

### 12.5 Reassign Lab Assistant

```
POST /api/partner/bookings/:id/reassign
```

**URL params:** `id` — booking `_id`

**Request body:**
```json
{
  "assistantId": "string (required)"
}
```

**Response 200:** `{ "booking": { /* updated with new labAssistant */ } }`

---

### 12.6 Upload Report File

```
POST /api/partner/reports/upload
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | file | Yes | PDF only, max 10 MB |
| `bookingId` | string | No | |

**Response 200:**
```json
{
  "uri": "string (Firebase Storage path — save this for the next step)",
  "checksum": "string (SHA256 hex)"
}
```

> This endpoint only uploads the file. You must then call **12.7** to attach it to a booking.

---

### 12.7 Link Report to Booking

```
POST /api/partner/bookings/:id/report
```

**URL params:** `id` — booking `_id`

**Request body:**
```json
{
  "uri": "string (required — the Firebase Storage path from 12.6)",
  "checksum": "string (required — SHA256 hex from 12.6)",
  "testId": "string (optional — defaults to first test in booking)"
}
```

**Response 201:**
```json
{
  "report": {
    "_id": "ObjectId",
    "booking": "ObjectId",
    "test": "ObjectId",
    "file": {
      "uri": "string",
      "storageProvider": "FIREBASE",
      "checksum": "string"
    },
    "issuedAt": "ISO date string",
    "isAccessible": "boolean",
    "createdAt": "ISO date string",
    "updatedAt": "ISO date string"
  }
}
```

**Side effect:** Booking status is automatically set to COMPLETED.

---

### 12.8 List Lab Assistants

```
GET /api/partner/assistants
```

**Response 200:**
```json
{
  "assistants": [
    {
      "_id": "ObjectId",
      "lab": "ObjectId",
      "name": "string",
      "phone": "string",
      "availability": {
        "monday": "boolean",
        "tuesday": "boolean",
        "wednesday": "boolean",
        "thursday": "boolean",
        "friday": "boolean",
        "saturday": "boolean",
        "sunday": "boolean"
      },
      "isActive": "boolean",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ]
}
```

---

### 12.9 Create Lab Assistant

```
POST /api/partner/assistants
```

**Request body:**
```json
{
  "name": "string (required)",
  "phone": "string (optional)",
  "userId": "string (optional)"
}
```

**Response 201:** `{ "assistant": { /* assistant object */ } }`

---

### 12.10 Update Lab Assistant

```
PUT /api/partner/assistants/:id
```

**URL params:** `id` — assistant `_id`

**Request body:** (all optional)
```json
{
  "name": "string",
  "phone": "string"
}
```

**Response 200:** `{ "assistant": { /* updated object */ } }`

---

### 12.11 Set Assistant Availability

```
PUT /api/partner/assistants/:id/availability
```

**URL params:** `id` — assistant `_id`

**Request body:**
```json
{
  "monday": "boolean",
  "tuesday": "boolean",
  "wednesday": "boolean",
  "thursday": "boolean",
  "friday": "boolean",
  "saturday": "boolean",
  "sunday": "boolean"
}
```

**Response 200:** `{ "assistant": { /* updated object */ } }`

---

### 12.12 Analytics — Overview

```
GET /api/partner/analytics/overview
```

**Response 200:**
```json
{
  "totalBookings": "number",
  "completedBookings": "number",
  "cancelledBookings": "number",
  "totalRevenue": "number",
  "topTests": [
    { "name": "string", "count": "number" }
  ]
}
```

---

### 12.13 Analytics — Revenue Over Time

```
GET /api/partner/analytics/revenue
```

**Query params:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `from` | string | No | `YYYY-MM-DD` |
| `to` | string | No | `YYYY-MM-DD` |

**Response 200:**
```json
{
  "revenue": [
    {
      "_id": "YYYY-MM-DD",
      "revenue": "number",
      "count": "number"
    }
  ]
}
```

---

### 12.14 Analytics — Peak Slots

```
GET /api/partner/analytics/slots
```

**Response 200:**
```json
{
  "peakSlots": [
    { "_id": "HH:MM", "count": "number" }
  ]
}
```

---

### 12.15 Customer Booking History

```
GET /api/partner/customers/:customerId/history
```

**URL params:** `customerId` — user `_id`

**Response 200:**
```json
{
  "bookings": [
    {
      "_id": "ObjectId",
      "tests": [ { "_id": "ObjectId", "name": "string", "price": "number" } ],
      "report": { /* report object or null */ },
      "status": "string",
      "createdAt": "ISO date string",
      "updatedAt": "ISO date string"
    }
  ]
}
```

---

## 13. Role Reference

| Role | Description | Key Permissions |
|---|---|---|
| `CUSTOMER` | End-user booking tests | Create bookings, manage subscriptions, view own reports |
| `LAB_OWNER` | Lab administrator | Accept/reject bookings, upload reports, manage assistants, view analytics |
| `LAB_ASSISTANT` | Field staff | (Assigned to bookings; limited API access) |
| `ADMIN` | Platform administrator | Full access |

A user can hold multiple roles simultaneously (e.g., a user could be both CUSTOMER and LAB_OWNER).

---

## 14. Common Data Shapes

### Address Object
```json
{
  "_id": "ObjectId",
  "label": "string (e.g. Home, Office)",
  "line1": "string",
  "line2": "string",
  "city": "string",
  "state": "string",
  "zipCode": "string",
  "country": "string"
}
```

### GeoJSON Point
```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}
```
> Note: GeoJSON stores coordinates as `[longitude, latitude]`, not `[latitude, longitude]`.

### Slot Object
```json
{
  "start": "HH:MM",
  "end": "HH:MM"
}
```

### Booking Statuses
`PENDING` → `CONFIRMED` → `COLLECTED` → `COMPLETED`  
`PENDING` or `CONFIRMED` → `CANCELLED`

### Subscription Frequencies
| Value | Next booking calculated as |
|---|---|
| `WEEKLY` | +7 days |
| `MONTHLY` | +1 calendar month |
| `CUSTOM` | +`customIntervalDays` days |

### Report Upload Flow (two-step)
1. `POST /api/partner/reports/upload` — uploads PDF, returns `{ uri, checksum }`
2. `POST /api/partner/bookings/:id/report` — links file to booking using `uri` + `checksum`

---

*Generated for AI-assisted frontend integration — Labzy Backend v1*
