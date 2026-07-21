# WeirdStats.ai — project guide

Mobile-web app that turns a curious question into a shareable AI "stat card."
Read this first; it captures the architecture and the non-obvious gotchas so a
single change doesn't require re-reading the whole codebase.

## Stack
- **Frontend**: Ionic 7 + Angular 16, NgModule-based (not standalone). AngularFire
  compat SDK (Firestore/Auth/Storage). Charts via Chart.js (`app-chart`). Card→PNG
  via `dom-to-image-more`. Native share via `navigator.share({files})`. Home
  "Today's weird stories" carousel via **Swiper** (`swiper/element/bundle`, registered
  in `main.ts`; home uses the `creative` stacked-deck effect — see Home section).
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
  **claims** it EAGERLY at generation time: `DraftService.add` sets `createdBy=uid,
  publishStatus:'draft'` → cloud-synced draft, so "back without saving" already lands in
  Drafts (nothing lost). Guests: card held in localStorage `weirdstats_pending_card`,
  auto-claimed on ANY sign-in via a GLOBAL hook (`AppComponent` → `DraftService.claimPending`),
  not only when a card-detail page is open.
- **Save = FREE, promotes draft→`private` (Saved tab).** Card-detail header shows
  **Save + discard** on a fresh card (`isUnsavedDraft` getter); `saveDraft()` calls
  `_promoteDraft('private', …)` → `publishStatus:'private'` → **Saved** tab. Saving is
  free for EVERYONE (the old premium-gated private-save is GONE; `makePrivate` is free too).
  Back after Save → Saved tab; back without Save → Drafts. **Profile** splits one
  `stats where createdBy==uid` query: `draft`→Drafts, `private|published`→Saved.
- **Users can NO LONGER "Publish".** The old Publish…/Make-public menu items are removed.
  **Share** (`goShare`, profile) publishes the card ON DEMAND as a LINK-ONLY public card
  (`publishStatus:'published'` + OG image) — anyone with the link can view, but it NEVER
  appears on Explore. `makePrivate` (free) turns the link off + clears feed flags.
- **Explore & Home are 100% admin-only.** They read `where showOnExplore==true` /
  `where showOnHome==true`; those flags are set ONLY by admins (`AdminService.setFeedFlag`
  / card-detail `_setFeedFlag`, gated by `AdminService.isAdmin` in UI **and** Firestore
  rules — `publishStatus:'published'` alone never adds a card to Explore). Admins curate
  via the new **`/admin-cards`** screen (`admin-cards/`; `AdminService.getAllCards` is
  cursor-paginated + client search/filter) which browses EVERY user's cards and sends any
  to Explore/Home; also reachable from the admin hub "All cards" row and the card-detail
  admin menu (`presentAdminActions` now carries the feed toggles). Enabling a flag also
  flips `publishStatus:'published'` + renders OG. Legacy `homeFeatured` superseded by
  `showOnHome` (read-allowed for back-compat).
- Delete = delete doc **+** `og/{id}.png` (`deleteOgImage`) — no orphans.
- `updatedAt` bumps on create/claim/save/share/edit; Explore/Drafts/Saved sort by
  `(updatedAt ?? createdAt)` desc = latest first.
- **`shared/publish-modal`** is now UNUSED (dead) after removing user-publish — safe to delete.
- OG (link-preview) image: offscreen `.og-frame` 1200×630, `fitOgTile()` scales the card
  to fit (no clipped title/story). Regenerated on edit of a published card.

### Legacy (do not extend): the `Graph` flow
`generate/`, `graph-detail/`, `my-graphs/`, `services/graph.service.ts` are an orphaned
parallel lifecycle. `GraphService` is still referenced by `project-generate`/`share`, so
it can't be deleted cleanly yet — leave it alone.

## Home page (redesign) & story carousel
`home/` was redesigned: "How WeirdStats works", "Explore by topic", "What you can
discover" (mini-viz tiles — one is `assets/discover-map.svg`, a world map generated
offline from `world-110m.json`), "Most shared today" (renamed from "Trending now";
share counts are **placeholders** — `mockShares`, no real share-tracking field yet), and a
**"Today's weird stories"** carousel.
- Carousel = **Swiper `creative` effect** rendered as a stacked deck (front card + two
  behind, back-left/back-right), configured in `home.page.ts::initStoriesSwiper()` via the
  `init="false"` + `Object.assign(el, params)` + `el.initialize()` pattern.
- ⚠️ GOTCHA: the creative transforms **don't compute on `initialize()`** — they need a
  `swiper.update()` AFTER Ionic lays out the page, or the cards render flat/mis-stacked.
  Handled via `observer:true` + delayed `update()`s + an `ionViewDidEnter` update.
- `.stories-viewport` has an **edge-fade mask (mobile only)** so back cards dissolve at the
  edge instead of hard-cutting; front-card width shrinks on mobile (`.stories-swiper` width%
  + `max-width` cap) to keep the peek inside the content column.
- The 3 story cards (`sc-a` editorial / `sc-b` cover / `sc-c` split) are **HARDCODED
  prototype** content with gradient+emoji hero stand-ins — the real curated feature is unbuilt.

## Deploy
- **Frontend**: `firebase deploy --only hosting --project weirdstats-ai`
- **Backend**: `cd services/backend && gcloud run deploy weirdstats-api --source=. --region=us-central1 --project=weirdstats-ai --min-instances=1 --cpu-boost --quiet`
  (`--min-instances=1` keeps one warm container so generation doesn't pay a
  cold-start [container boot + Python import + `firebase_admin` init, several
  seconds] on the first request after idle; `--cpu-boost` speeds startup when it
  does scale up. Costs ~1 always-on instance — drop the flag if that's not wanted.)
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
  drafts/private, public-read only for `publishStatus=='published'`, `showOnHome==true`,
  `showOnExplore==true`, or `homeFeatured==true`. Non-admins can't ENABLE the feed flags
  (`noNonAdminFeedEnable()` on update — they may leave or turn OFF a flag, so making a card
  private clears it; must-be-false on create). Making a card private/draft clears both feed
  flags (card-detail `_updateStatus`/`_promoteDraft`, profile `_saveCard`/`_moveToDrafts`)
  so a private card is never left publicly readable. ⚠️ Rules + the feed-flag changes are
  **edited but NOT deployed** — deploy rules and re-verify on prod. Existing
  `homeFeatured`/published cards need a one-time backfill or the feeds start empty:
  `services/backend/backfill_feed_flags.py` (dry-run by default; `--apply`, `--explore`).
- Dev frontend `environment.ts` `apiUrl` = `http://localhost:8000` (local backend). Prod
  uses the Cloud Run URL. So the local app hits the LOCAL backend.
- Explore's `error:` handler silently sets `cards=[]` — a failed query shows "No cards yet"
  with NO console error. Check the query/index, not just the console.

## Local dev
- Frontend: `weird-stats-app`, `npm start` (ng serve :4200) / `npm run build`.
- Backend: `services/backend`, run uvicorn on :8000 (needs `OPENAI_API_KEY` in `.env`).
- Both are wired into `.claude/launch.json` as `weird-stats-app` and `weirdstats-api`
  for the in-app browser preview.

## Current state & open items (as of 2026-07-20)
Working branch **`claude/premium-billing-and-app-polish`** (worktree `youthful-lehmann-8278f3`).
Earlier work (data-adequacy gate, unified cloud-drafts, hardened+live Firestore rules with
composite index `(publishStatus, createdAt)`=`CICAgOjXh4EK` READY, latest-first sort) is
**deployed to prod**. **This session's work is COMMITTED HERE but NOT yet deployed** — a
frontend deploy ships it; no rules/backend change needed.

This session:
- **Home redesign + story carousel** (see Home page section above). New `swiper` dep.
- **Lifecycle refactor** (see Card lifecycle): Save = free → Saved; user "Publish" removed
  (Share = link-only); Explore/Home 100% admin-only via the new **`/admin-cards`** screen.
  Verified end-to-end (generate→Save lands in Saved; admin screen reads all 7 users' cards).
- **Premium story-cards** = researched, NOT built: pre-baked curated cards in a dedicated
  `storyCards` collection, admin-authored, hero images from stock (Pexels/Wikimedia free)
  or AI-gen (FLUX/gpt-image ~$0.04/img); Cloud Run Job + Cloud Scheduler for agent-drafts;
  reuse the existing OG-image Storage-upload plumbing. Cost: generation ~$0.02–0.04/card
  (the OpenAI `web_search` tool @ $0.01/call dominates); **premium *look* = $0** (it's CSS),
  real photos ~4¢/card → keep curated. ≈330 premium-look cards per $10.

Open / not done:
- **Deploy the FRONTEND** to ship this session's work (rules already support admin all-cards).
- `shared/publish-modal` is now **dead code** (user-publish removed) — safe to delete.
- Test card **"Jupiter Has 115 Confirmed Moons"** (kpi) left as a private Saved card under
  the owner's account during verification — harmless, can be deleted.
- (Carried over) `auth/invalid-login-credentials` prod console errors (Auth, un-diagnosed);
  **YouTube → stat cards** not built (transcript fetch is the hard part); **Legacy `Graph`
  flow** removal deferred (GraphService used by project-generate/share); **research
  accuracy** (some KPIs off) — separate data-quality track.

## Git
- **Commit author MUST be** `Nehemya Maddela <weirdstats.ai@gmail.com>` — never deviate.
- End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Never commit `services/backend/.venv` or `firestore-debug.log`.
