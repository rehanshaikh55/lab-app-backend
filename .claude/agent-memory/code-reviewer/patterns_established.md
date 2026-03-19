---
name: Established Code Patterns in Labzy Backend
description: Architecture patterns and conventions used throughout the codebase
type: reference
---

## Error Handling Pattern
All errors use RFC 7807 format via `common/errors.js`:
```javascript
const err = Errors.NOT_FOUND('Resource', '/route');
return reply.code(err.statusCode).send(err.toRFC7807());
```

Response structure:
```json
{
  "type": "https://labzy.in/errors/NOT_FOUND",
  "title": "Not Found",
  "status": 404,
  "detail": "Resource not found",
  "instance": "/route"
}
```

## Auth Flow Pattern
1. Register → generates access + refresh tokens
2. Both tokens stored as bcrypt hashes in user.refreshToken
3. Login → validates credentials, hashes new refresh token
4. Routes use `verifyJWT` preHandler to populate `request.user`
5. RBAC via `requireRoles()` checks `request.user.roles`

## JWT Token Pattern
- Access: 15 minutes expiry, signed with JWT_SECRET
- Refresh: 7 days expiry, signed with JWT_REFRESH_SECRET
- Refresh token endpoint hashes the old refresh token before storing

## Booking State Machine
Valid transitions stored in VALID_TRANSITIONS object:
```javascript
const VALID_TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
```

## Mongoose Usage Pattern
- Models use subdocuments for embedded data (addressSchema)
- 2dsphere indexes for geospatial queries
- Proper field selection with .select() to exclude sensitive fields
- Populate with specific field selection for efficiency
- Sparse unique indexes for optional fields (idempotencyKey)

## Route Organization
- Routes file registers controllers
- Controllers handle business logic
- Models via Mongoose
- Middleware for auth/RBAC
- Schemas via JSON schema in route definitions

## Geospatial Pattern
Coordinates stored as [longitude, latitude] and queried with:
```javascript
location: {
  $near: {
    $geometry: { type: 'Point', coordinates: [lng, lat] },
    $maxDistance: radiusInMeters
  }
}
```

## Pagination Pattern
- Query params: `page` (1-indexed), `limit` (default 20)
- Skip calculation: `(parseInt(page) - 1) * parseInt(limit)`
- Always return `{ items, total, page, limit }`

## Fastify Prehandler Pattern
Routes use array of preHandlers executed in order:
```javascript
const customerAuth = { preHandler: [verifyJWT, requireRoles('CUSTOMER')] };
fastify.post('/bookings', { ...customerAuth, schema }, controller);
```

## Idempotency Pattern
Subscription job uses idempotencyKey to prevent duplicate bookings:
```javascript
const idempotencyKey = `sub_${sub._id}_${dateStr}`;
const exists = await Booking.exists({ idempotencyKey });
if (exists) continue;
```

## Logging Pattern
- App-level logs: use `app.log` in jobs/services
- Route-level logs: use `request.log` in controllers
- Error logs use: `request.log.error({ err: error }, 'message')`

## Address/Location Pattern
User addresses stored as subdocuments with coordinates
Lab location stored as Point geometry for geospatial queries
Booking captures address snapshot at time of booking (immutable history)

## Slot Calculation Pattern
1. Get lab opening hours for day
2. Iterate from open time with intervalMinutes step
3. Stop when current + duration > close time
4. Count existing bookings for each slot
5. Mark available if count < maxBookingsPerSlot
