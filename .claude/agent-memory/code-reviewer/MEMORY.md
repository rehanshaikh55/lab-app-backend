# Code Review Memory Index

## Quick Reference
- **Status**: Comprehensive review completed 2026-03-20
- **Verdict**: ⚠️ Approved with critical fixes required (3 bugs, 6 high-priority, 4 medium)
- **Deployment**: Do NOT deploy without fixing critical bugs
- **Effort**: 5-9 hours to fix all issues

## Critical Bugs (MUST FIX)
1. [FirebaseStorageAdapter not exported](critical_exports_issue.md) — storage.js line 37
2. [RBAC middleware missing return](critical_rbac_bug.md) — rbacMiddleware.js line 11
3. [Mongoose addresses.id() bug](critical_address_query.md) — bookingController.js line 62

## High-Priority Issues
1. [Missing try/catch (20+ routes)](high_missing_try_catch.md) — profileController, subscriptionController, labController, etc.
2. [Config duplication](high_config_duplication.md) — env.js vs config.js, hardcoded cookie password
3. JWT_SECRET not validated on startup — env.js line 3

## Medium-Priority Issues
1. console.log instead of request.log — config/*.js, storage.js
2. Missing validation schemas — partnerRoutes, profileRoutes
3. Firebase initialization race condition — firebase.js
4. Subscription job doesn't validate lab exists — jobs/subscriptions.js

## Established Patterns
- [Code patterns used throughout](patterns_established.md)
- Error handling: RFC 7807 via Errors object
- Auth: verifyJWT middleware + requireRoles RBAC
- Booking state machine: VALID_TRANSITIONS object
- Mongoose: proper indexes, subdocuments, population

## User Profile
- [Review style and preferences](user_role.md)
- Direct, specific, severity-focused
- Provides code examples with exact fixes
- Acknowledges good patterns
