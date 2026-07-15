# WeirdStats Backend

The API the Angular app talks to. Receives a question, forwards it to the
agent service (`../agent`), and returns chart data.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # adjust AGENT_URL if needed
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health` - health check
- `POST /api/generate` - body `{ "prompt": "...", "preferredType": "bar" }`,
  returns chart JSON (see `app/schemas.py`)

If the agent service at `AGENT_URL` is unreachable, this falls back to a
local mock generator (`app/mock_generator.py`) so the frontend keeps working.

## Stripe billing

Premium subscriptions run through Stripe. Premium is granted **only** by the
webhook after Stripe confirms payment — never by the client (Firestore rules
block clients from writing `plan: 'premium'`).

Endpoints (see `app/billing.py`):

- `POST /api/billing/create-checkout-session` — auth: `Authorization: Bearer <firebase-id-token>`.
  Body `{ "returnUrl": "https://app/..." }`. Returns `{ "url": "<stripe checkout url>" }`.
- `POST /api/billing/portal` — same auth. Opens the Stripe customer portal.
- `POST /api/billing/webhook` — called by Stripe; verifies the `Stripe-Signature`
  header and updates `users/{uid}` (plan, planExpiry, stripeCustomerId, stripeSubscriptionId).

### Setup

1. In the Stripe dashboard create a recurring **Product/Price** (e.g. Premium $10/mo)
   and copy the price id (`price_…`).
2. Set env vars (see `.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
   `STRIPE_WEBHOOK_SECRET`, and optionally `BILLING_RETURN_URL`.
3. Local webhook testing:
   ```bash
   stripe listen --forward-to localhost:8000/api/billing/webhook
   # copy the printed whsec_… into STRIPE_WEBHOOK_SECRET, then:
   stripe trigger checkout.session.completed
   ```
4. Production: add a webhook endpoint in the dashboard pointing at
   `https://<your-api>/api/billing/webhook`, subscribe to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.

Token verification and the webhook's plan writes use the Firebase Admin SDK, so
`FIREBASE_SERVICE_ACCOUNT_KEY` / `FIREBASE_PROJECT_ID` must be configured.
