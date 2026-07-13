# WeirdStats.ai — project guide

Mobile-web app that turns a curious question into a shareable AI "stat card."
Read this first; it captures the architecture and the non-obvious gotchas so a
single change doesn't require re-reading the whole codebase.

## Stack
- **Frontend**: Ionic 7 + Angular 16, NgModule-based (not standalone). AngularFire
  compat SDK (Firestore/Auth/Storage). Charts via Chart.js (`app-chart`). Card→PNG
  via `dom-to-image-more`. Native share via `navigator.share({files})`.
- **Backend**: Python FastAPI on Google Cloud Run (`weirdstats-api`, us-central1).
  OpenAI **Responses API**. Pillow for server-side OG image fallback.
- **Firebase project**: `weirdstats-ai` (⚠️ NOT the old `weirdstatsai-aaaf7`).

## Repo layout
- `weird-stats-app/` — the Ionic/Angular app (`src/app/…`)
- `services/backend/` — FastAPI app (`app/…`), `.venv` is untracked & pre-existing
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json`
- `DEPLOY.md` — deploy notes

## Backend generation pipeline (`services/backend/app/`)
`main.py` orchestrates; `agent_client.py` does the OpenAI calls; `prompts.py` holds
the system prompts; `validator.py` normalizes + gates; `schemas.py` = Pydantic shapes.

Flow: **research_agent → classify_card_type → format_validated**
- `research_agent` (gpt-4o, `web_search`, max 2 calls) → plain-text brief.
- `classify_card_type` (gpt-4o-mini, temp 0) → one of the 7 card types; fails open (None).
- `format_validated` (agent_client) = `format_agent` (gpt-4o-mini, **temp 0.3**) →
  `validate_card` → **`card_data_ok` gate** → retry format once if hollow →
  `degrade_card` as last resort. **No hollow card is ever served** (this was the root
  cause of "No data available" cards — a chart with empty labels/datasets etc.).
- Endpoints: `POST /api/generate/stream` (SSE, primary), `POST /api/generate` (JSON),
  `POST /api/projects/import/stream` (doc import). All route through `format_validated`.
- Response parsing is free-form JSON (`text:{format:{type:'json_object'}}`), NOT a bound
  schema — `validator.py` fills defaults, so missing fields are silent. `card_data_ok`
  (in validator) is the real per-type data gate; add new type rules there.

## Card types & rendering
7 types: `kpi | chart | ranking | table | versus | map | fact`. Classifier priority:
versus → map → chart → table/ranking (by row count) → kpi → fact.
- **map** = rows are *countries* (world atlas only; sub-national → ranking/table).
- **ranking** ≤5 rows; **table** ≥6 rows (enforced in validator).
- Chart: time-series (year labels) must be line/bar, never pie/doughnut.

Render: `app-weird-card` switches by `cardType` → `app-card-{type}` in
`shared/cards/card-*/`. Three sizes: **feed** (grid tile), **full** (detail + share),
**alt** (style-preview thumbnails; alt mirrors feed exactly).
`shared/card-data.util.ts::cardHasData()` mirrors the backend gate and blocks
share/publish of hollow cards.

## Card lifecycle — ONE collection, ONE status field
Every card is a doc in the `stats` Firestore collection. `publishStatus` is the only
lifecycle field: **`draft | private | published`**. (`StoredStatCard.status` and
`WeirdCard.status` exist but are NOT lifecycle — don't use them for gating.)
- Generate → backend writes `stats/{id}` with `createdBy:'Anonymous'` (cache). Frontend
  **claims** it: `DraftService.add` sets `createdBy=uid, publishStatus:'draft'` →
  cloud-synced draft. Guests: card held in localStorage `weirdstats_pending_card`,
  auto-claimed on login (`claimGuestCardIfAny`).
- Publish/unpublish = **status flip in place** (no copy). `_promoteDraft` (card-detail),
  `_saveCard`/`_moveToDrafts` (profile).
- Delete = delete doc **+** `og/{id}.png` (`deleteOgImage`) — no orphans.
- `updatedAt` bumps on create/claim/publish/unpublish/edit; Explore/Drafts/Saved sort
  by `(updatedAt ?? createdAt)` desc = latest first.
- **Profile** derives Drafts & Saved from one `stats where createdBy==uid` query, split
  by publishStatus. **Explore** = `where publishStatus=='published'`. **Home** =
  `where homeFeatured==true` (admin-curated).
- OG (link-preview) image: offscreen `.og-frame` 1200×630, `fitOgTile()` scales the card
  to fit (no clipped title/story). Regenerated on edit of a published card.

### Legacy (do not extend): the `Graph` flow
`generate/`, `graph-detail/`, `my-graphs/`, `services/graph.service.ts` are an orphaned
parallel lifecycle. `GraphService` is still referenced by `project-generate`/`share`, so
it can't be deleted cleanly yet — leave it alone.

## Deploy
- **Frontend**: `firebase deploy --only hosting --project weirdstats-ai`
- **Backend**: `cd services/backend && gcloud run deploy weirdstats-api --source=. --region=us-central1 --project=weirdstats-ai --quiet`
- **Rules**: `firebase deploy --only firestore:rules --project weirdstats-ai`
- **Indexes**: create via **gcloud** (see gotcha), then verify READY.
- After a hosting deploy, the CDN can briefly serve the OLD bundle — verify with a
  cache-busting query param (`/explore?cb=1`), don't trust the first load.

## ⚠️ Gotchas that have bitten us
- **Backend uses `firebase_admin` (Admin SDK) → bypasses Firestore rules.** Tightening
  rules never breaks server writes.
- **`firebase deploy --only firestore:indexes` can report success without creating the
  index.** Source of truth is `gcloud firestore indexes composite list` (shows STATE).
  Create with `gcloud firestore indexes composite create --collection-group=stats
  --field-config=field-path=publishStatus,order=ascending
  --field-config=field-path=createdAt,order=descending --project=weirdstats-ai` (it waits
  until READY). A missing composite index makes an `equality + orderBy` query fail →
  empty feed (looks like a rules problem but isn't).
- Firestore serves **equality-only** multi-filter queries (`createdBy== && publishStatus==`)
  via single-field index merge — no composite index needed. `equality + orderBy` DOES need
  a composite index.
- The Firestore **emulator's query-rule analysis is more lenient than prod** — passing
  emulator tests is necessary but not sufficient; verify reads on prod after a rules deploy
  (with rollback ready).
- Firestore **security rules are currently hardened**: `stats` is owner-only for
  drafts/private, public-read only for `publishStatus=='published'` or `homeFeatured==true`.
- Dev frontend `environment.ts` `apiUrl` = `http://localhost:8000` (local backend). Prod
  uses the Cloud Run URL. So the local app hits the LOCAL backend.
- Explore's `error:` handler silently sets `cards=[]` — a failed query shows "No cards yet"
  with NO console error. Check the query/index, not just the console.

## Local dev
- Frontend: `weird-stats-app`, `npm start` (ng serve :4200) / `npm run build`.
- Backend: `services/backend`, run uvicorn on :8000 (needs `OPENAI_API_KEY` in `.env`).
- Both are wired into `.claude/launch.json` as `weird-stats-app` and `weirdstats-api`
  for the in-app browser preview.

## Current state & open items (as of 2026-07)
Latest work is on branch **`claude/youthful-lehmann-8278f3`** (pushed); `main` is
stale. Everything below is **deployed to production** (weirdstats.ai):
- Backend data-adequacy gate (no hollow cards); share/OG image fits content.
- Unified cloud-drafts lifecycle (one `stats` doc + `publishStatus`); publish/
  delete/edit unified; delete cleans up OG image; owner deep-link manageable;
  guest sign-in-to-save.
- Firestore rules **hardened & live** (drafts/private owner-only). Composite index
  `(publishStatus, createdAt)` = `CICAgOjXh4EK`, READY.
- Explore/Drafts/Saved sort **latest-first** via `updatedAt`.

Open / not done:
- **`auth/invalid-login-credentials`** console errors on prod (a failed login attempt;
  Auth, not rules/data) — un-diagnosed, flagged separately.
- **YouTube → stat cards** feature: feasibility assessed (reuse doc-import pipeline;
  the hard part is reliable transcript fetch — use a transcript API, not scraping from
  Cloud Run). Not built.
- **Legacy `Graph` flow** removal still deferred (GraphService used by project-generate/share).
- **Research accuracy**: some KPIs come back off (e.g. avg sleep 9.03h) — data-quality
  track separate from the structural fixes.
- A test draft "Five Countries…moon" (kpi) was left in prod Firestore as a private draft
  under the owner's account — harmless, can be deleted.

## Git
- **Commit author MUST be** `Nehemya Maddela <weirdstats.ai@gmail.com>` — never deviate.
- End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Never commit `services/backend/.venv` or `firestore-debug.log`.
