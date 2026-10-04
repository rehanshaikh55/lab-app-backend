# Labzy Registration API & Data Spec

## Overview
After OTP login, users complete a 2-step registration to capture health profile + optional family members. This document defines the data model, API contract, and implementation details for both frontend & backend.

---

## User Registration Data Model

### Primary User (Step 1)

```json
{
  "userId": "string (UUID)",
  "phoneNumber": "string (+91XXXXXXXXXX)",
  "registrationStep": "integer (1-2)",
  "primaryUser": {
    "name": "string (required, max 100 chars)",
    "age": "integer (required, 1-120)",
    "gender": "enum: 'M' | 'F' | 'O' (required)",
    "weight": "number (required, kg, 20-200)",
    "height": "number (required, cm, 100-250)",
    "bloodGroup": "enum: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-' | 'unknown' (optional)",
    "dateOfBirth": "ISO8601 date (derived from age, optional)",
    "createdAt": "ISO8601 timestamp",
    "updatedAt": "ISO8601 timestamp"
  }
}
```

### Family Members (Step 2, Optional)

```json
{
  "familyMembers": [
    {
      "id": "string (UUID)",
      "name": "string (required, max 100 chars)",
      "relation": "enum: 'father' | 'mother' | 'spouse' | 'child' | 'sibling' | 'parent' | 'other' (required)",
      "age": "integer (required, 0-120)",
      "dateOfBirth": "ISO8601 date (optional, derived from age)",
      "createdAt": "ISO8601 timestamp"
    }
  ]
}
```

---

## API Endpoints

### 1. **POST** `/api/auth/register-profile`
**Purpose:** Save primary user health info (Step 1)

**Request:**
```json
{
  "phoneNumber": "+919876543210",
  "name": "Asha Rao",
  "age": 29,
  "gender": "F",
  "weight": 65,
  "height": 165,
  "bloodGroup": "O+"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "userId": "user-12345",
  "message": "Profile created. Please add family members.",
  "data": {
    "userId": "user-12345",
    "phoneNumber": "+919876543210",
    "registrationStep": 1,
    "primaryUser": {
      "name": "Asha Rao",
      "age": 29,
      "gender": "F",
      "weight": 65,
      "height": 165,
      "bloodGroup": "O+",
      "createdAt": "2026-06-20T10:30:00Z"
    }
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Age must be between 1 and 120",
  "field": "age"
}
```

---

### 2. **POST** `/api/auth/register-family`
**Purpose:** Save family members & complete registration (Step 2)

**Request:**
```json
{
  "userId": "user-12345",
  "familyMembers": [
    {
      "name": "Rajesh Rao",
      "relation": "father",
      "age": 58
    },
    {
      "name": "Priya Rao",
      "relation": "mother",
      "age": 55
    },
    {
      "name": "Arjun Rao",
      "relation": "child",
      "age": 4
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Registration complete!",
  "registrationStep": 2,
  "data": {
    "userId": "user-12345",
    "phoneNumber": "+919876543210",
    "primaryUser": {
      "name": "Asha Rao",
      "age": 29,
      "gender": "F",
      "weight": 65,
      "height": 165,
      "bloodGroup": "O+"
    },
    "familyMembers": [
      {
        "id": "fm-uuid-1",
        "name": "Rajesh Rao",
        "relation": "father",
        "age": 58,
        "createdAt": "2026-06-20T10:32:00Z"
      },
      {
        "id": "fm-uuid-2",
        "name": "Priya Rao",
        "relation": "mother",
        "age": 55,
        "createdAt": "2026-06-20T10:32:00Z"
      },
      {
        "id": "fm-uuid-3",
        "name": "Arjun Rao",
        "relation": "child",
        "age": 4,
        "createdAt": "2026-06-20T10:32:00Z"
      }
    ],
    "registrationCompletedAt": "2026-06-20T10:32:15Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "INVALID_FAMILY",
  "message": "Family member age must be 0-120",
  "memberIndex": 0
}
```

---

### 3. **GET** `/api/user/profile`
**Purpose:** Fetch user's complete profile (for editing/viewing later)

**Request:**
```
GET /api/user/profile
Headers: Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user-12345",
    "phoneNumber": "+919876543210",
    "registrationStep": 2,
    "registrationCompletedAt": "2026-06-20T10:32:15Z",
    "primaryUser": { ... },
    "familyMembers": [ ... ]
  }
}
```

---

### 4. **PUT** `/api/user/profile`
**Purpose:** Update user profile (name, weight, height, etc.)

**Request:**
```json
{
  "name": "Asha Rao",
  "weight": 66,
  "height": 165,
  "bloodGroup": "O++"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated",
  "data": { ... }
}
```

---

### 5. **POST** `/api/user/family-members`
**Purpose:** Add a single family member after registration

**Request:**
```json
{
  "userId": "user-12345",
  "name": "Neha Rao",
  "relation": "sibling",
  "age": 26
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "fm-uuid-4",
    "name": "Neha Rao",
    "relation": "sibling",
    "age": 26,
    "createdAt": "2026-06-20T11:00:00Z"
  }
}
```

---

### 6. **DELETE** `/api/user/family-members/{familyMemberId}`
**Purpose:** Remove a family member

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Family member removed"
}
```

---

## Database Schema (PostgreSQL/MongoDB examples)

### PostgreSQL

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  registration_step INTEGER DEFAULT 1,
  registration_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Primary user health info
CREATE TABLE user_health_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 1 AND age <= 120),
  gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F', 'O')),
  weight DECIMAL(5,2) NOT NULL CHECK (weight >= 20 AND weight <= 200),
  height DECIMAL(5,2) NOT NULL CHECK (height >= 100 AND height <= 250),
  blood_group VARCHAR(5),
  date_of_birth DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Family members
CREATE TABLE family_members (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  relation VARCHAR(20) NOT NULL CHECK (relation IN ('father', 'mother', 'spouse', 'child', 'sibling', 'parent', 'other')),
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 120),
  date_of_birth DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id)
);
```

### MongoDB

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["phoneNumber", "registrationStep"],
      properties: {
        _id: { bsonType: "objectId" },
        phoneNumber: { bsonType: "string", pattern: "^\\+91[0-9]{10}$" },
        registrationStep: { bsonType: "int", minimum: 1, maximum: 2 },
        registrationCompletedAt: { bsonType: "date" },
        primaryUser: {
          bsonType: "object",
          properties: {
            name: { bsonType: "string", maxLength: 100 },
            age: { bsonType: "int", minimum: 1, maximum: 120 },
            gender: { enum: ["M", "F", "O"] },
            weight: { bsonType: "double", minimum: 20, maximum: 200 },
            height: { bsonType: "double", minimum: 100, maximum: 250 },
            bloodGroup: { enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", "unknown"] },
            dateOfBirth: { bsonType: "date" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" }
          }
        },
        familyMembers: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              id: { bsonType: "objectId" },
              name: { bsonType: "string", maxLength: 100 },
              relation: { enum: ["father", "mother", "spouse", "child", "sibling", "parent", "other"] },
              age: { bsonType: "int", minimum: 0, maximum: 120 },
              dateOfBirth: { bsonType: "date" },
              createdAt: { bsonType: "date" }
            }
          }
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});
```

---

## Frontend Integration

### Save Data to LocalStorage (for offline capability)

```javascript
const saveRegistrationData = (data) => {
  localStorage.setItem('labzy_registration', JSON.stringify({
    userId: data.userId,
    step: data.registrationStep,
    primary: data.primaryUser,
    family: data.familyMembers,
    savedAt: new Date().toISOString()
  }));
};

const loadRegistrationData = () => {
  const saved = localStorage.getItem('labzy_registration');
  return saved ? JSON.parse(saved) : null;
};
```

### API Call Example (React/Axios)

```javascript
import axios from 'axios';

const API_BASE = 'https://api.labzy.com';

// Step 1: Register primary user
const registerPrimaryUser = async (phoneNumber, primaryUserData) => {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/register-profile`, {
      phoneNumber,
      ...primaryUserData
    });
    saveRegistrationData(response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('Registration failed:', error.response.data);
    throw error;
  }
};

// Step 2: Register family members
const registerFamilyMembers = async (userId, familyMembers) => {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/register-family`, {
      userId,
      familyMembers
    });
    saveRegistrationData(response.data.data);
    return response.data.data;
  } catch (error) {
    console.error('Family registration failed:', error.response.data);
    throw error;
  }
};
```

---

## Validation Rules

### Primary User
| Field | Type | Min | Max | Notes |
|-------|------|-----|-----|-------|
| name | string | 2 | 100 | No special chars except space, dash, apostrophe |
| age | integer | 1 | 120 | |
| gender | enum | - | - | M / F / O only |
| weight | number | 20 | 200 | kg; decimals allowed (e.g., 65.5) |
| height | number | 100 | 250 | cm; decimals allowed (e.g., 165.5) |
| bloodGroup | enum | - | - | A+ / A- / B+ / B- / O+ / O- / AB+ / AB- / unknown |

### Family Members
| Field | Type | Min | Max | Notes |
|-------|------|-----|-----|-------|
| name | string | 2 | 100 | No special chars except space, dash, apostrophe |
| relation | enum | - | - | Enum only; no free text |
| age | integer | 0 | 120 | 0 = newborn; 120 = elderly |

---

## Error Codes

| Code | HTTP | Message | Action |
|------|------|---------|--------|
| VALIDATION_ERROR | 400 | Field validation failed | Check `field` key for which field failed; show user-friendly error |
| INVALID_FAMILY | 400 | Family member validation failed | Check `memberIndex` to identify which family member has the error |
| USER_NOT_FOUND | 404 | User doesn't exist | Redirect to login / registration |
| PHONE_ALREADY_REGISTERED | 409 | Phone number already registered | Suggest login or recovery flow |
| UNAUTHORIZED | 401 | Token expired or invalid | Re-authenticate user |
| INTERNAL_ERROR | 500 | Server error | Show generic error; log to Sentry |

---

## Frontend → Backend Flow

```
1. User completes Step 1 (name, age, gender, weight, height, blood group)
   ↓
   POST /api/auth/register-profile
   ← Receives userId + saved data
   
2. User adds family members (optional) or skips
   ↓
   POST /api/auth/register-family
   ← Registration complete; userId + all data returned
   
3. Frontend redirects to home / book test screen
   ↓
   GET /api/user/profile (on next app open)
   ← Verifies registration step = 2; prevents re-entering registration
```

---

## Testing Checklist

- [ ] **Step 1 validation:** Name (empty, special chars), Age (1-120), Weight (20-200), Height (100-250)
- [ ] **Step 2 validation:** Family member name & age validation
- [ ] **Family member optional:** Allow skipping family members and going straight to onboarding
- [ ] **LocalStorage persistence:** Close app mid-registration; re-open and verify data is still there
- [ ] **Error handling:** Network error on POST → show toast; allow retry
- [ ] **Success screen:** Display user name + family count; button to edit
- [ ] **Profile fetch:** After registration, GET /api/user/profile should return step=2
- [ ] **Family member CRUD:** Add/delete family members post-registration
- [ ] **Sensitive data:** Do NOT log full user data; only log IDs and success/failure

---

## Notes for Backend Teams

1. **Always validate server-side** — never trust client-side validation alone
2. **Phone number uniqueness:** Enforce `UNIQUE` constraint on `phone_number` column
3. **Age calculation:** If frontend sends `age`, backend should calculate & store `dateOfBirth` as `NOW() - interval '${age} years'`
4. **Blood group:** Allow `null` for users who don't know; don't force selection
5. **Soft delete family members:** Instead of hard delete, set `deleted_at` timestamp to preserve referential integrity with test records
6. **Rate limit:** `/api/auth/register-*` endpoints to prevent spam (e.g., 5 requests/minute per IP)
7. **Audit logging:** Log all registration attempts (success + failures) for compliance & debugging

---

## Notes for Frontend Teams

1. **Form state management:** Use React Context or Redux to persist form across navigation
2. **Unsaved changes warning:** Before leaving Step 1, warn user if they have unsaved data
3. **Accessibility:** Use `<label htmlFor="">` for all inputs; add `aria-invalid` on error states
4. **Mobile keyboard:** Use `inputMode="numeric"` for age/weight/height inputs to show numeric keyboard
5. **Spinner on submit:** Disable CTA button + show loading state while API is in flight
6. **Error toasts:** Use non-blocking toast/snackbar for network errors; allow retry
7. **Offline support:** Cache registration data locally; sync when connection restores
8. **Analytics:** Track which registration steps users complete / abandon for funnel analysis

---

**Last Updated:** June 20, 2026  
**Version:** 1.0  
**Author:** Labzy Design System
