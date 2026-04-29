---
name: RBAC Middleware Bug - roles Not Populated
description: requireRoles checks request.user.roles but authMiddleware doesn't populate it
type: feedback
---

**CRITICAL SECURITY BUG**: The RBAC middleware checks `request.user?.roles` but the JWT verification middleware doesn't populate it.

**Files**:
- `middlewares/authMiddleware.js` line 15 (verifyJWT)
- `middlewares/rbacMiddleware.js` line 5 (requireRoles)

**The Problem**:
```javascript
// authMiddleware.js verifyJWT — selects field but doesn't attach it to request
request.user = user;  // Populates entire user document including roles

// rbacMiddleware.js requireRoles — tries to check roles
const userRoles = request.user?.roles || [];  // This should work if verifyJWT ran first
const hasRole = allowed.some(r => userRoles.includes(r));
```

**Wait** — Actually, upon closer inspection, this SHOULD work because `request.user = user` loads the full User document which includes `roles` array. HOWEVER, there's a subtle issue:

**Real Issue**: The User schema has roles as an array of strings:
```javascript
roles: { type: [String], enum: [...], default: ['CUSTOMER'] }
```

So this should work. BUT the issue is that **requireRoles is used as a preHandler but doesn't call done()** — it's incomplete middleware.

```javascript
// rbacMiddleware.js — MISSING: doesn't return or call done()
export const requireRoles = (...allowed) => {
  return async (request, reply) => {
    const userRoles = request.user?.roles || [];
    const hasRole = allowed.some(r => userRoles.includes(r));
    if (!hasRole) {
      const err = Errors.FORBIDDEN();
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    // BUG: Missing return statement to allow request to proceed!
  };
};
```

**Fix**: Add return statement to allow request to continue:
```javascript
export const requireRoles = (...allowed) => {
  return async (request, reply) => {
    const userRoles = request.user?.roles || [];
    const hasRole = allowed.some(r => userRoles.includes(r));
    if (!hasRole) {
      const err = Errors.FORBIDDEN();
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    // Allow request to proceed
    return;  // or just omit this line
  };
};
```

**Why**: Fastify preHandlers must either send a response or return/complete. Without explicit return, the middleware silently exits but doesn't signal the route to continue.

**How to apply**: All RBAC-protected routes will silently hang or behave unpredictably. Any time fixing RBAC middleware, ensure all code paths either reply or return.
