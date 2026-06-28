# Deploying WeirdStats

The app has two halves that host separately:

| Part | Tech | Host |
|------|------|------|
| Frontend | Ionic / Angular (`weird-stats-app/www`) | Firebase Hosting |
| Backend | FastAPI + OpenAI (`services/backend`) | Render / Railway / Cloud Run |

Firebase Hosting only serves static files — it **cannot** run the Python backend.

---

## 1. Deploy the backend (do this first — you need its URL)

### Render (recommended, free tier)

1. Push this repo to GitHub (done).
2. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
3. Connect the `weirdstatsai/weirdstatsai` repo. Render reads `render.yaml`.
4. Set the secret env vars in the dashboard:
   - `OPENAI_API_KEY` → your OpenAI key
5. Upload the Firebase service-account JSON as a **Secret File**:
   - Render → service → **Environment** → **Secret Files**
   - Filename: `firebase-adminsdk.json`, mount path: `/etc/secrets/firebase-adminsdk.json`
   - Paste the contents of `services/backend/firebase-adminsdk.json`
6. Deploy. You get a URL like `https://weirdstats-api.onrender.com`.
7. Verify: open `https://weirdstats-api.onrender.com/health` → `{"status":"ok"}`.

> Free Render instances sleep after inactivity; first request after idle takes ~30s.

---

## 2. Point the frontend at the hosted backend

Edit `weird-stats-app/src/environments/environment.prod.ts`:

```ts
apiUrl: 'https://weirdstats-api.onrender.com',   // your Render URL, no trailing slash
```

---

## 3. Deploy the frontend to Firebase Hosting

```bash
# Log in with the Google account that owns weirdstatsai-aaaf7
cd "weird stats"
npx firebase login --reauth
npx firebase use weirdstatsai-aaaf7

# Build the production frontend
cd weird-stats-app
npm run build -- --configuration production

# Deploy hosting + Firestore rules
cd ..
npx firebase deploy --only hosting,firestore:rules
```

Live at: `https://weirdstatsai-aaaf7.web.app`

---

## 4. After first deploy

- In Firebase Console → Authentication → Settings → **Authorized domains**, confirm
  `weirdstatsai-aaaf7.web.app` is listed (it is by default) so Google/Facebook login works.
- If you add a custom domain later, add it to both the Firebase authorized domains and the
  backend `CORS_ORIGINS` env var.
