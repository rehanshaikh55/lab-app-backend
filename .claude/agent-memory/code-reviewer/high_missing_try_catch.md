---
name: Multiple Routes Missing Try/Catch Error Handling
description: Routes not wrapped in try/catch will crash unhandled, bypassing RFC7807 error format
type: feedback
---

**HIGH PRIORITY**: Multiple controller functions lack try/catch blocks, meaning any uncaught error will bypass the global error handler and may leak internal details.

**Affected Routes** (all in controllers):

1. `profileController.js`:
   - `getProfile()` line 6 — no try/catch
   - `updateProfile()` line 16 — no try/catch
   - `addAddress()` line 29 — no try/catch
   - `updateAddress()` line 41 — no try/catch
   - `deleteAddress()` line 65 — no try/catch
   - `updateLocation()` line 77 — no try/catch
   - `getNearbyLabs()` line 105 — no try/catch

2. `subscriptionController.js`:
   - `listSubscriptions()` line 28 — no try/catch
   - All other functions also lack try/catch

3. `labController.js`:
   - `getNearbyLabs()` line 6 — no try/catch
   - `getLabById()` line 23 — no try/catch
   - `getLabTests()` line 34 — no try/catch
   - `getLabSlots()` line 39 — no try/catch

4. `partnerController.js`:
   - Most analytics functions lack try/catch

**Example Problem**:
```javascript
// profileController.js line 6 — if User.findById() fails, unhandled error
export const getProfile = async (request, reply) => {
  const user = await User.findById(request.user._id)  // No try/catch!
    .select('-passwordHash -refreshToken -resetToken -resetTokenExpiry');
  // ...
};
```

**Fix Pattern**:
```javascript
export const getProfile = async (request, reply) => {
  try {
    const user = await User.findById(request.user._id)
      .select('-passwordHash -refreshToken -resetToken -resetTokenExpiry');
    if (!user) {
      const err = Errors.NOT_FOUND('User');
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    return reply.code(200).send({ user });
  } catch (error) {
    request.log.error({ err: error }, 'Failed to fetch profile');
    const err = Errors.NOT_FOUND('User');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
};
```

**Why**: Without try/catch, database errors, connection issues, or serialization errors will crash the request and potentially leak stack traces or internal errors to clients.

**How to apply**: Wrap all async DB operations in try/catch. Let the global error handler (in app.js) catch anything that escapes.
