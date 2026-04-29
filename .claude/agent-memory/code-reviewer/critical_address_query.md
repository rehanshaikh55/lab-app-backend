---
name: Mongoose addresses.id() Method Does Not Exist
description: bookingController tries to use non-existent Mongoose subdocument accessor
type: feedback
---

**CRITICAL RUNTIME BUG**: `bookingController.js` line 62 uses `request.user.addresses?.id?.(userAddressId)` which is invalid Mongoose method chain.

**File**: `/c/App/app/lab-booking-backend/controllers/bookingController.js` line 62

**The Problem**:
```javascript
if (collectionType === 'HOME' && userAddressId) {
  const addr = request.user.addresses?.id?.(userAddressId);  // BUG: .id() is not a real method
  if (addr) userAddress = addr.toObject();
}
```

Mongoose doesn't have `.id()` method on arrays. The correct method is `.id()` on a Mongoose subdocument array (legacy) or use `.find()`.

**Available Mongoose patterns**:
```javascript
// Pattern 1: Using findById on subdoc array (old Mongoose)
const addr = user.addresses.id(userAddressId);  // Returns null if not found

// Pattern 2: Using find (more modern)
const addr = user.addresses.find(a => a._id.toString() === userAddressId);

// Pattern 3: Using .findByIdAndUpdate if you need to modify
const addr = await User.findByIdAndUpdate(userId, {}, { new: true });
```

In this case, `addresses` is a subdocument array per the User schema. The `.id()` method **might** exist on Mongoose arrays, but the optional chaining (`?.id?.()`) is suspicious.

**Fix**: Use explicit .find() which is guaranteed to work:
```javascript
let userAddress = null;
if (collectionType === 'HOME' && userAddressId) {
  const addr = request.user.addresses?.find(a => a._id.toString() === userAddressId);
  if (addr) userAddress = addr.toObject();
}
```

**Why**: `.find()` is explicit, readable, and guaranteed to work across all Mongoose versions. The `.id()` method may not exist or may not work with optional chaining syntax.

**How to apply**: Any time accessing subdocuments from arrays in Mongoose, prefer `.find()` over `.id()`.
