---
name: Config Duplication - PORT and COOKIE_PASSWORD Exported Twice
description: Inconsistent configuration sources; app.js imports from env.js but config.js also exports them
type: feedback
---

**HIGH PRIORITY**: Configuration is duplicated and sourced inconsistently. PORT and COOKIE_PASSWORD are exported from TWO locations with different defaults.

**Issue Location**:
- `config/env.js` line 1 — exports PORT and others from .env
- `config/config.js` line 60-61 — exports PORT and COOKIE_PASSWORD with **different** defaults

**The Problem**:
```javascript
// env.js line 1
export const PORT = parseInt(process.env.PORT) || 3000;
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD;

// config.js line 60-61 — DUPLICATES with different behavior
export const PORT = process.env.PORT || 3000;  // Uses string, not parseInt!
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD || "cookie_gwhweshshshsfhhhshshspassword";  // Has fallback!
```

**Where Each Is Used**:
- `app.js` line 4 imports PORT from `config/config.js`
- `setup.js` line 11 imports from `config.js` (authenticate, COOKIE_PASSWORD, createSessionStore)
- Controllers never import config

**Inconsistencies**:
1. `env.js` PORT: `parseInt(process.env.PORT) || 3000`
2. `config.js` PORT: `process.env.PORT || 3000` (no parseInt!)
3. `env.js` COOKIE_PASSWORD: undefined if not set
4. `config.js` COOKIE_PASSWORD: has hardcoded fallback (INSECURE!)

**Fix**:
1. Remove duplication from `config/config.js` — keep ONLY:
```javascript
// config.js — only keep authenticate() and createSessionStore()
export { COOKIE_PASSWORD, PORT } from './env.js';
```

2. Or consolidate all config in ONE place. Choose `env.js` or `config.js` but not both.

**Why**:
- Duplication is a maintenance nightmare
- Hardcoded fallback `"cookie_gwhweshshshsfhhhshshspassword"` is a security risk
- parseInt inconsistency could cause bugs if PORT is used as string elsewhere
- Makes it unclear which source is authoritative

**How to apply**: Single source of truth for all environment-based configuration. Use `env.js` for all config exports.
