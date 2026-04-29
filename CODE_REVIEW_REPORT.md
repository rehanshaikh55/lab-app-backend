# Comprehensive Code Review — Labzy Backend
**Date**: 2026-03-20
**Reviewer**: Claude Code Reviewer (Haiku)
**Scope**: All 36 files (config, models, routes, controllers, middleware, services, jobs, integrations)

---

## VERDICT: ⚠️ APPROVED WITH CRITICAL FIXES REQUIRED

The codebase is well-structured and follows Fastify + Mongoose patterns correctly. However, **3 critical bugs** and **several high-priority issues** must be fixed before production deployment.

---

## 🚨 CRITICAL ISSUES (Must Fix Immediately)

### 1. FirebaseStorageAdapter Not Exported
**Severity**: CRITICAL | **Impact**: Runtime failure
**File**: `integrations/storage/storage.js` line 37
**Problem**: Class is not exported as named export, but controllers try to import it:
```javascript
// storage.js — only exports instance
export const storage = new FirebaseStorageAdapter();

// bookingController.js:4 — tries to import class
import { FirebaseStorageAdapter } from '../integrations/storage/storage.js';  // ❌ FAILS
const storage = new FirebaseStorageAdapter();  // Line 144 — will crash
```
**Affected**:
- `controllers/bookingController.js` line 144
- `controllers/reportController.js` line 16

**Fix**:
```javascript
// storage.js line 3 — add export keyword
export class FirebaseStorageAdapter {
  // ...
}
export const storage = new FirebaseStorageAdapter();
```

---

### 2. RBAC Middleware Missing Return Statement
**Severity**: CRITICAL | **Impact**: Protected routes silently hang
**File**: `middlewares/rbacMiddleware.js` line 11
**Problem**: Fastify preHandler must return or call done(). Missing return allows request to silently hang:
```javascript
export const requireRoles = (...allowed) => {
  return async (request, reply) => {
    const userRoles = request.user?.roles || [];
    const hasRole = allowed.some(r => userRoles.includes(r));
    if (!hasRole) {
      const err = Errors.FORBIDDEN();
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    // ❌ Missing: needs explicit return to signal success
  };
};
```
**Affected**: All routes using `requireRoles()` as preHandler:
- `/partner/bookings/*` routes
- `/partner/assistants` routes
- `/partner/analytics/*` routes
- `/subscriptions` (POST, PUT)
- `/bookings` (POST)

**Fix**: Add explicit return:
```javascript
export const requireRoles = (...allowed) => {
  return async (request, reply) => {
    const userRoles = request.user?.roles || [];
    const hasRole = allowed.some(r => userRoles.includes(r));
    if (!hasRole) {
      const err = Errors.FORBIDDEN();
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    return;  // ✅ Signal success
  };
};
```

---

### 3. Mongoose Subdocument Query Bug
**Severity**: CRITICAL | **Impact**: HOME collection bookings fail
**File**: `controllers/bookingController.js` line 62
**Problem**: Uses non-existent Mongoose method chain:
```javascript
if (collectionType === 'HOME' && userAddressId) {
  const addr = request.user.addresses?.id?.(userAddressId);  // ❌ .id() not a real method
  if (addr) userAddress = addr.toObject();
}
```
**Impact**: Any HOME booking will crash when trying to fetch user address

**Fix**: Use `.find()` instead:
```javascript
let userAddress = null;
if (collectionType === 'HOME' && userAddressId) {
  const addr = request.user.addresses?.find(a => a._id.toString() === userAddressId);
  if (addr) userAddress = addr.toObject();
}
```

---

## ⚠️ HIGH-PRIORITY ISSUES (Should Fix)

### 4. Missing Try/Catch in 20+ Routes
**Severity**: HIGH | **Impact**: Unhandled errors crash requests
**Files Affected**:
- `profileController.js`: All 7 functions lack try/catch
- `subscriptionController.js`: All 7 functions lack try/catch
- `labController.js`: All 4 functions lack try/catch
- `partnerController.js`: Analytics functions lack try/catch
- `reportController.js`: getReport() line 5

**Example Problem**:
```javascript
export const getProfile = async (request, reply) => {
  const user = await User.findById(request.user._id)  // ❌ No try/catch
    .select('-passwordHash -refreshToken...');
  // If DB fails, unhandled error → request crashes
};
```

**Fix Pattern**:
```javascript
export const getProfile = async (request, reply) => {
  try {
    const user = await User.findById(request.user._id)
      .select('-passwordHash -refreshToken...');
    if (!user) {
      const err = Errors.NOT_FOUND('User');
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    return reply.code(200).send({ user });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to fetch profile');
    // Let global error handler catch it, or respond directly
    const err = Errors.NOT_FOUND('User');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
};
```

---

### 5. Configuration Duplication and Inconsistency
**Severity**: HIGH | **Impact**: Config management nightmare, security risk
**Files**: `config/env.js` vs `config/config.js`

**Problem**:
- PORT exported from both files with different parsing (one uses parseInt, one doesn't)
- COOKIE_PASSWORD has insecure hardcoded fallback in config.js:
```javascript
// config.js line 61 — HARDCODED PASSWORD!
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD || "cookie_gwhweshshshsfhhhshshspassword";
```
- `env.js` uses proper fallback to undefined
- Duplication makes it unclear which is authoritative

**Affected**:
- `app.js` imports PORT from config/config.js
- `setup.js` imports from config/config.js

**Fix**: Single source of truth — remove duplication:
```javascript
// config/config.js — remove exports, import from env.js instead
export { COOKIE_PASSWORD, PORT } from './env.js';
export { createSessionStore, authenticate } from './config.js';
```

And fix the hardcoded fallback:
```javascript
// env.js — remove hardcoded fallback
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD;  // Will be undefined if not set
```

Then ensure .env always has COOKIE_PASSWORD set.

---

### 6. JWT Verification Doesn't Check Token Expiry Properly
**Severity**: HIGH | **Impact**: Expired tokens might be accepted
**File**: `middlewares/authMiddleware.js` line 14
**Problem**: `jwt.verify()` checks expiry, but if JWT_SECRET is wrong or missing, it silently fails:
```javascript
const decoded = jwt.verify(token, JWT_SECRET);  // If JWT_SECRET is undefined, throws error
```

**Check**: Ensure JWT_SECRET is always set in .env:
```javascript
// env.js line 3
export const JWT_SECRET = process.env.JWT_SECRET;  // ❌ No fallback — will be undefined in dev!
```

If JWT_SECRET is undefined, this will throw and be caught, but better to fail-fast:

**Fix**:
```javascript
// In app.js startup or env.js validation
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

---

## 💡 MEDIUM-PRIORITY ISSUES (Nice to Have)

### 7. Console.log Used Instead of request.log
**Severity**: MEDIUM | **Impact**: Inconsistent logging
**Files**:
- `config/config.js` line 16, 33, 38
- `config/firebase.js` line 14, 25, 28
- `integrations/storage/storage.js` line 21

**Issue**: Mixes console.log with request.log, making logs unsearchable:
```javascript
// config.js
console.log("Session store skipped: SRV URI detected...");  // ❌ Should use logger

// firebase.js
console.warn('Firebase not initialized...');  // ❌ Should use app.log
```

**Fix**: Use injected logger where available:
```javascript
// In route handlers — use request.log
request.log.info('message');

// In jobs or services — use app.log or create logger
app.log.info('message');
```

---

### 8. Missing Input Validation on Several Routes
**Severity**: MEDIUM | **Impact**: Potential injection or bad data
**Routes**:
- `partnerRoutes.js` line 73 (uploadReport) — no file validation schema
- `partnerRoutes.js` line 116 (updateAssistant) — no body schema
- `partnerRoutes.js` line 123 (setAssistantAvailability) — no body schema
- `profileRoutes.js` line 15 (getProfile) — GET with no params is fine, but no validation

**Example**:
```javascript
// partnerRoutes.js line 73 — no validation schema
fastify.post('/partner/reports/upload', { ...ownerAuth }, uploadReport);  // ❌ No schema

// Should be:
fastify.post('/partner/reports/upload', {
  ...ownerAuth,
  schema: {
    consumes: ['multipart/form-data'],
    // Schema for file upload
  }
}, uploadReport);
```

**Fix**: Add JSON schemas for all unvalidated routes

---

### 9. Firebase Initialization Race Condition
**Severity**: MEDIUM | **Impact**: Multiple Firebase initializations possible
**File**: `config/firebase.js` line 6-9
**Problem**: `initialized` flag doesn't prevent race condition with concurrent requests:
```javascript
export const initFirebase = () => {
  if (initialized || admin.apps.length > 0) {  // ❌ Race condition
    initialized = true;
    return admin;
  }
  // ... init code ...
};
```

Two concurrent calls might both pass the check and call `initializeApp` twice.

**Fix**:
```javascript
let initPromise = null;

export const initFirebase = () => {
  if (admin.apps.length > 0) {
    return admin;
  }
  if (initPromise) {
    return initPromise;  // Return pending promise
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.warn('Firebase not initialized: FIREBASE_SERVICE_ACCOUNT_PATH not set');
    return null;
  }

  initPromise = (async () => {
    try {
      const serviceAccount = JSON.parse(readFileSync(...));
      admin.initializeApp({ ... });
      return admin;
    } catch (err) {
      console.warn('Firebase initialization failed:', err.message);
      return null;
    }
  })();

  return initPromise;
};
```

---

### 10. Subscription Job Doesn't Validate Lab Exists
**Severity**: MEDIUM | **Impact**: Bookings created for deleted labs
**File**: `jobs/subscriptions.js` line 65-66
**Problem**:
```javascript
const lab = await Lab.findById(sub.lab);
const slot = lab ? pickFirstAvailableSlot(lab, sub.nextBookingDate) : { start: '09:00', end: '09:30' };
// Creates booking even if lab is null/deleted
```

If lab is deleted, booking is created with null lab reference.

**Fix**:
```javascript
const lab = await Lab.findById(sub.lab);
if (!lab) {
  app.log.warn({ subId: sub._id }, 'Lab deleted, cancelling subscription');
  sub.status = 'CANCELLED';
  await sub.save();
  continue;
}
```

---

## ✅ WHAT'S DONE WELL

### Code Quality Highlights
1. **Excellent error handling with RFC 7807 format** — `common/errors.js` provides standardized error responses
2. **Proper JWT auth patterns** — Tokens use 15m access + 7d refresh, tokens are hashed before storage
3. **RBAC is well-structured** — Role-based access control is clean and consistent
4. **Good use of Mongoose** — Models use proper indexing, subdocuments, and references
5. **Comprehensive route validation** — Most routes have JSON schema validation with additionalProperties: false
6. **Booking state machine is solid** — VALID_TRANSITIONS in both bookingController and partnerController prevent invalid state transitions
7. **Geospatial queries are correct** — Uses proper 2dsphere indexes and $near operators
8. **Async/await patterns** — Proper use of async/await with Promise.all for parallel queries
9. **Mongoose population is efficient** — Routes populate only needed fields (name, email, etc.)
10. **Idempotency keys for subscriptions** — Subscription job uses idempotencyKey to prevent duplicate bookings

### Security Highlights
1. **Passwords properly hashed** — bcryptjs with salt rounds 10-12
2. **Refresh tokens are hashed before storage** — Good pattern for token compromise mitigation
3. **Password reset has expiry** — Tokens expire in 1 hour
4. **Auth middleware validates user exists** — Prevents using deleted account tokens
5. **RBAC checks are present** — Routes check roles before granting access
6. **Email enumeration prevented** — forgotPassword returns same message whether email exists or not
7. **Booking access is verified** — Controllers check user owns booking before allowing operations
8. **Report access is restricted** — Only booking owner can view reports

---

## 📊 CODE METRICS

| Category | Count | Status |
|----------|-------|--------|
| **Total Files Reviewed** | 36 | ✅ Complete |
| **Controllers** | 6 | ⚠️ Missing try/catch |
| **Routes** | 8 | ✅ Good |
| **Models** | 8 | ✅ Excellent |
| **Middleware** | 2 | ⚠️ 1 has bug |
| **Config Files** | 5 | ⚠️ Duplicated |
| **Integrations** | 1 | ⚠️ Export missing |
| **Services/Jobs** | 2 | ⚠️ 1 missing validation |
| **Critical Bugs** | 3 | 🚨 Must fix |
| **High Issues** | 3 | ⚠️ Should fix |
| **Medium Issues** | 4 | 💡 Nice to fix |

---

## 🎯 PRIORITY FIX CHECKLIST

```
[ ] 1. Export FirebaseStorageAdapter from storage.js
[ ] 2. Add return statement to requireRoles middleware
[ ] 3. Fix Mongoose addresses query to use .find()
[ ] 4. Add try/catch to 20+ routes in controllers
[ ] 5. Remove config duplication (keep only env.js)
[ ] 6. Ensure JWT_SECRET is always set in .env
[ ] 7. Replace console.log with request.log/app.log
[ ] 8. Add validation schemas to 3 unvalidated routes
[ ] 9. Fix Firebase initialization race condition
[ ] 10. Validate lab exists in subscription job
```

---

## DEPLOYMENT READINESS

**Before Production**: Fix all CRITICAL issues (1-3) and HIGH issues (4-6)
**Before Beta**: Also fix MEDIUM issues (7-10)
**Recommended**: Run full test suite covering all error paths with try/catch

**Estimated Effort**: 4-6 hours for all fixes
