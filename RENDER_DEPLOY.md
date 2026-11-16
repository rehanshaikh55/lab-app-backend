# Deploying the Labzy backend on Render

Stack: one Render web service (Node) + MongoDB Atlas. No Redis, no SQL, no Docker needed.

## 1. MongoDB Atlas

1. Use your existing Atlas cluster (or create a free M0 in a Mumbai/Singapore region).
2. **Database Access** → create a user with read/write on the `labzy` database.
3. **Network Access** → add `0.0.0.0/0`. Render's outbound IPs aren't fixed on the free plan,
   so Atlas has to accept any IP (the password still protects it). On a paid Render plan you can
   instead allow-list the IPs shown under your service's **Connect → Outbound**.
4. Copy the connection string (`mongodb+srv://...`). That is `MONGO_URI`.

## 2. Create the service

1. Push `main` to GitHub (`render.yaml` must be on the branch).
2. Render dashboard → **New → Blueprint** → connect the `lab-app-backend` repo.
3. Render reads `render.yaml` and asks for every `sync: false` value:

   | Variable | Value |
   |---|---|
   | `MONGO_URI` | Atlas connection string from step 1 |
   | `FRONTEND_URL` | Your web/admin URL (used for CORS and email links) |
   | `EMAIL_USER`, `EMAIL_PASS` | Mail account used for OTP emails |
   | `GOOGLE_MAPS_API_KEY` | Maps key |
   | `RAZORPAY_*` | Live or test keys; leave blank to run payments in stub mode |
   | `FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com` |

   `JWT_SECRET`, `JWT_REFRESH_SECRET` and `COOKIE_PASSWORD` are generated automatically.
   **Don't regenerate them later**: changing JWT secrets logs every user out.

4. **Firebase key**: service → **Environment → Secret Files → Add**, filename
   `firebase-service-account.json`, paste the JSON. It is mounted at
   `/etc/secrets/firebase-service-account.json`, which `FIREBASE_SERVICE_ACCOUNT_PATH` already points to.
5. Click **Apply**. The first build takes a few minutes.

## 3. Check it

```
curl https://labzy-backend.onrender.com/health
```

Should return `200`. Logs are under the service's **Logs** tab.

## 4. Point the app at it

In `labzy-frontend/.env`:

```
API_BASE_URL=https://labzy-backend.onrender.com
WS_BASE_URL=wss://labzy-backend.onrender.com
```

Rebuild the app (react-native-config reads `.env` at build time).

### Razorpay webhook (required for online payments)

Bookings are marked paid only when Razorpay's webhook reaches the backend.

1. Razorpay dashboard (Test Mode for test keys) → **Account & Settings → Webhooks → Add New Webhook**.
2. URL: `https://labzy-backend.onrender.com/api/payments/webhook`
3. Secret: make up a long random string. Put the **same** string in Render as `RAZORPAY_WEBHOOK_SECRET`.
   This is not your API key secret.
4. Events: `payment.captured`, `payment.failed`, `order.paid`.

Test cards and UPI IDs for Test Mode are listed in Razorpay's docs ("Test Card Details").


## 5. Custom domain (optional)

Service → **Settings → Custom Domains** → add `api.labzy.in`, then create the CNAME record Render
shows at your DNS provider. HTTPS is issued automatically. Update `API_BASE_URL`/`WS_BASE_URL` to match.

## Free vs Starter plan

`render.yaml` uses `plan: free`. A free service **sleeps after 15 minutes without traffic**:

- the first request after sleeping takes ~30–60 s;
- background jobs (slot-hold sweep, subscriptions, reminders, account deletion, SLA sweep) only run
  while it's awake;
- open WebSocket connections drop when it sleeps.

That's fine for testing. For real users, change `plan: free` to `plan: starter` (always on).

Run only **one instance**: the scheduler runs inside the web process.

## One-time data step

If production data predates the patient redesign, run the backfill once against Atlas from your
machine (with `MONGO_URI` set to production):

```
node scripts/backfillPatientRedesign.js
```
