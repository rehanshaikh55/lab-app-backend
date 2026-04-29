---
name: FirebaseStorageAdapter Export Missing
description: Class is instantiated but not exported; controllers import non-existent export
type: feedback
---

**CRITICAL BUG**: `FirebaseStorageAdapter` class is not exported from `integrations/storage/storage.js`, but two controllers try to import it as a named export.

**File**: `/c/App/app/lab-booking-backend/integrations/storage/storage.js` line 37
**Affected Files**:
- `controllers/bookingController.js` line 4
- `controllers/reportController.js` line 2

**The Problem**:
```javascript
// storage.js line 37 — ONLY exports storage instance
export const storage = new FirebaseStorageAdapter();

// bookingController.js line 4 — tries to import non-existent class
import { FirebaseStorageAdapter } from '../integrations/storage/storage.js';

// Then line 144 creates a new instance
const storage = new FirebaseStorageAdapter();  // FAILS — not exported
```

**Fix**: Add named export of the class in `storage.js`:
```javascript
export class FirebaseStorageAdapter {
  // ... existing code
}
export const storage = new FirebaseStorageAdapter();
```

**Why**: This pattern allows reusability while providing a singleton instance. The class should be exported for use in controllers; both approaches are valid.

**How to apply**: Any time code needs to instantiate `FirebaseStorageAdapter`, ensure it's exported from storage.js.
