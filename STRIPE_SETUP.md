# Stripe billing — setup & go-live

Web-only Stripe **hosted Checkout** for WeirdStats premium. The code is done and
verified (endpoints, modal, webhook, rules); it is **inert until you finish the
steps below** — the `/api/billing/*` routes return `503` and the app behaves
exactly as before until every `STRIPE_*` env var is set.

Do everything in **Test mode** first (toggle in the Stripe dashboard), verify the
full loop, then repeat with live keys.

## What's already built
- Backend (`services/backend/app/billing.py`): `POST /api/billing/checkout`,
  `POST /api/billing/portal`, `POST /api/stripe/webhook`. Premium is granted
  **only** by the signature-verified webhook, via the Admin SDK.
- Frontend: plan modal offers Monthly ($9.99/mo), Monthly pass ($9.99 one-time),
  Yearly ($100/yr); `BillingService` redirects to Checkout; `/billing/success`
  return page; "Manage subscription" in Account → Stripe customer portal.
- `firestore.rules`: clients can no longer self-set `plan`, `planExpiry`,
  Stripe ids, or `isAdmin` — only the backend/admins can.

## 1. Stripe dashboard
1. Create a Stripe account (or use your existing one) → **Test mode**.
2. **Products → Add product** ("WeirdStats Premium"). Add **three Prices** to it:
   - Recurring, **monthly**, $9.99 → copy its id → `STRIPE_PRICE_MONTHLY`
   - **One-time**, $9.99 → `STRIPE_PRICE_MONTHLY_ONCE`
   - Recurring, **yearly**, $100 → `STRIPE_PRICE_YEARLY`
3. **Developers → API keys** → copy the **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY`.
4. **Tax:** Settings → Tax → enable **Stripe Tax** and add your registration(s).
   (Checkout uses `automatic_tax` + collects the customer address. If you skip
   this, remove the two `automatic_tax` / `customer_update` lines in `billing.py`.)
5. **Customer portal:** Settings → Billing → Customer portal → **Activate** and
   allow cancellation (required for the "Manage subscription" link).
6. **Webhook:** Developers → Webhooks → **Add endpoint**
   - URL: `https://weirdstats-api-636419392315.us-central1.run.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`

## 2. Set the env vars
Fill these on **Cloud Run** (`weirdstats-api`) and in your local
`services/backend/.env` (see `.env.example`):
```
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
STRIPE_PRICE_MONTHLY, STRIPE_PRICE_MONTHLY_ONCE, STRIPE_PRICE_YEARLY,
FRONTEND_URL=https://weirdstats.ai
```
> ⚠️ I did not enter any keys — paste them yourself.

## 3. Deploy
```bash
# Backend (installs the new `stripe` dep from requirements.txt):
cd services/backend && gcloud run deploy weirdstats-api --source=. \
  --region=us-central1 --project=weirdstats-ai --min-instances=1 --cpu-boost --quiet \
  --set-env-vars STRIPE_SECRET_KEY=...,STRIPE_WEBHOOK_SECRET=...,STRIPE_PRICE_MONTHLY=...,STRIPE_PRICE_MONTHLY_ONCE=...,STRIPE_PRICE_YEARLY=...,FRONTEND_URL=https://weirdstats.ai

# Firestore rules (locks the billing/isAdmin fields — verify on prod, rollback ready):
firebase deploy --only firestore:rules --project weirdstats-ai

# Frontend:
cd weird-stats-app && npm run build
firebase deploy --only hosting --project weirdstats-ai
```

## 4. Test the full loop (Test mode)
1. Local: `pip install -r services/backend/requirements.txt`, set the test env vars,
   run the backend, and use the **Stripe CLI** to forward webhooks:
   `stripe listen --forward-to localhost:8000/api/stripe/webhook`
   (its printed `whsec_…` is your local `STRIPE_WEBHOOK_SECRET`).
2. As a **non-premium** user, hit "Go Premium" → pick a plan → Checkout.
   Pay with test card **4242 4242 4242 4242**, any future expiry/CVC.
3. You land on `/billing/success`; within a few seconds the webhook flips you to
   premium (unlimited cards, no watermark). Check `users/{uid}` in Firestore:
   `plan:'premium'`, `planExpiry`, `planType`, `subscriptionId`.
4. Account → **Manage subscription** → cancel → confirm `customer.subscription.*`
   updates the doc.

## Robustness notes (already handled in code)
- **Stripe API version:** the webhook reads `current_period_end` and the invoice's
  subscription id from BOTH their legacy top-level location and their new
  (2025-03-31.basil) locations (subscription items / `invoice.parent`), so it
  works regardless of which Stripe library / dashboard API version is in play.
- A premium subscription is **never** written with a null expiry (that would read
  as lifetime premium); if Stripe omits the period end, a plan-length grace is used.
- Webhooks are order-tolerant: `subscription.deleted`/`updated` only act on the
  user's *current* subscription id, and the one-time pass is idempotent per session.

## Notes / follow-ups
- **Rules need prod verification.** The `users` rule now blocks client writes to
  `plan`/`isAdmin`/Stripe fields. Make sure normal profile + usage writes still
  work on prod (test-edit a profile) and keep a rollback of the prior rules.
- **Self-grant hole closed:** previously any signed-in user could set
  `plan:'premium'` (or `isAdmin:true`) from the client. The new rules stop that,
  but they only take effect once deployed.
- Yearly is subscription-only right now. Want a yearly one-time pass too? It's a
  one-line addition (new Price + a `yearly_once` entry in `PLANS`).
