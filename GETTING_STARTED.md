# Getting Started — Labzy Backend

How to run the Labzy lab-booking backend (Node.js + Fastify + MongoDB) locally.

## Prerequisites

- **Node.js** v18+ (v20 recommended) — the project uses ES modules and `node --test`
- **npm** (comes with Node)
- **MongoDB** — either:
  - a real MongoDB instance / Atlas cluster, **or**
  - nothing at all — `npm run start:local` spins up a local MongoDB for you (see below)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Create a `.env` file in the project root (one already exists in this repo — check it before overwriting):

```env
# App
PORT=3000
NODE_ENV=development

# JWT (required)
JWT_SECRET=your-long-random-secret

# MongoDB (required)
MONGO_URI=mongodb://localhost:27017/labzy
DB_NAME=labzy

# Admin Panel (required)
COOKIE_PASSWORD=another-long-random-secret

# Email — Gmail App Password (needed for OTP / password-reset emails)
EMAIL_USER=you@gmail.com
EMAIL_PASS=your-gmail-app-password

# Frontend URL (CORS in production + password-reset links)
FRONTEND_URL=http://localhost:5173

# Firebase Storage (file uploads / push notifications)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com

# Optional
GOOGLE_MAPS_API_KEY=
FCM_ENABLED=false
```

**Required to boot:** `JWT_SECRET`, `MONGO_URI`, `COOKIE_PASSWORD` — the server exits at startup with `FATAL: missing required env vars` if any of these are absent (see `config/env.js`). Everything else is optional but disables the related feature when missing.

## 3. Start the server

Pick one of the three modes:

### A. Local dev with zero MongoDB setup (easiest)

```bash
npm run start:local
```

Boots an on-disk MongoDB via `mongodb-memory-server` on port 27017 (no MongoDB install needed), then starts the backend against it. Data persists in `./.local-mongo-data` across restarts. The mongod binary downloads once on first run (needs internet). Your `MONGO_URI` in `.env` is ignored in this mode — the script overrides it.

### B. Dev with your own MongoDB (auto-reload)

```bash
npm start
```

Runs `nodemon app.js` — connects to the `MONGO_URI` from `.env` and restarts automatically when you edit files.

### C. Production

```bash
npm run start:prod
```

Plain `node app.js`, no auto-reload. Set `NODE_ENV=production` so CORS locks to `FRONTEND_URL` and error details are hidden.

## 4. Verify it's running

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "ok", "uptime": 1.23, "db": "connected" }
```

- API routes are registered under `routes/` (see `API_DOCUMENTATION.md` for the full endpoint reference)
- AdminJS admin panel is mounted by `config/setup.js`
- `api-tester.html` in the repo root can be opened in a browser to poke the API manually

## Running tests

```bash
npm test
```

Runs `node --test` over `tests/**/*.test.js`. Tests use `mongodb-memory-server`, so no real database is needed.

## Docker

A `Dockerfile` is included:

```bash
docker build -t labzy-backend .
docker run -p 3000:3000 --env-file .env labzy-backend
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `FATAL: missing required env vars: ...` | Add the listed keys to `.env` (`JWT_SECRET`, `MONGO_URI`, `COOKIE_PASSWORD`) |
| Port already in use | Change `PORT` in `.env` or stop the process using 3000 |
| `start:local` hangs on first run | It's downloading the mongod binary — wait, or check your internet connection |
| DB shows `disconnected` in `/health` | Verify `MONGO_URI` is reachable (Atlas IP allowlist, local mongod running) |
| Emails not sending | `EMAIL_USER`/`EMAIL_PASS` must be a Gmail address + [App Password](https://myaccount.google.com/apppasswords), not your normal password |
