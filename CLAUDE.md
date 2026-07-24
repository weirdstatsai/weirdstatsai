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
> **ONE card design everywhere.** All 7 types render as the premium
> `app-story-card` (dark, data-driven `treatment` from `buildStoryView`) on EVERY surface:
> feed tiles, Home deck, detail hero, share PNG, OG image, share page.
> `app-weird-card` is now a thin pass-through to it; the light `card-*` components
> (`card-kpi/ranking/table/versus/map/chart/fact`) are **no longer rendered anywhere** —
> dead code, safe to delete once the premium look is settled.
> - **Alternatives = premium variants** (`story-view.ts::storyAltsFor`, data-gated,
>   one variant per treatment). Persisted as `uiMeta.selectedStyle` = `'story-*'`; one
>   pick restyles the card on every surface. ⚠️ The FIRST alt must reproduce the auto
>   treatment (that's why `story-leaderboard`/`story-atlas` exist) — otherwise an unedited
>   card looks different on tiles (auto) vs the detail hero (seeded variant).
> - **`compact` input** = full chrome (quip + CTA) at tile density, for short fixed frames
>   (the Home deck). Without it, chart/leaderboard/atlas overflow and clip.
> - **Background photo** (`uiMeta.heroImage`) renders as a full-bleed layer under a
>   strengthened scrim, on ALL types (the emoji steps aside). One merged edit panel
>   (accent / badge / hero emoji / photo) serves every card type.
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
- **Capture = the visible card.** All three PNG surfaces (card-detail `.share-capture`,
  `.og-capture`, share-card page frame) mirror the detail hero's component switch
  (kpi/ranking → `app-story-card`, etc.) and hide the in-card insight, and all frames use
  the accent-derived gradient (`gradientForAccent`) — never raw `uiMeta.gradientFrom/To`.
- ⚠️ GOTCHA: **dom-to-image's clone doesn't resolve container-query units** — the story
  card's cqw type-scale blows up to its clamp caps in the clone (split hero number,
  wrapped unit) while looking perfect on screen. Fix: `shared/capture.util.ts::
  freezeCaptureLayout` pins the live computed layout inline around every
  `domtoimage.toPng` call (read-ALL-then-write-ALL — writing `container-type:normal`
  mid-walk re-inflates later reads). Wrap any new capture call site with it.
- Story-card "See the full story" CTA: emits `(storyCta)` → detail page scrolls to the
  story block; only rendered when `card.insight` exists; static visual CTA in captures.
- **kpi + ranking are premium EVERYWHERE**: `app-weird-card` routes both types to
  `app-story-card` (explore/detail/captures already did), so no surface shows the old
  light card for them. **Premium alternatives** (`story-view.ts::storyAltsFor`, data-gated;
  first entry = the auto treatment) render as story-card thumbnails on card-detail and the
  profile draft panel; selection persists `uiMeta.selectedStyle` = `'story-*'` key, which
  EVERY story-card instance resolves itself (hero, tiles, captures, share page). Legacy
  light-card style keys are ignored by story-card; table/versus/map/fact still use them.
  ⚠️ Keep `donutable()`/`storyAltsFor` and `buildStoryView` gates in lockstep (shared
  `labelledRows`; offer and render must never disagree). Hollow cards get NO alts.
- **Hero emoji is owner-editable** (edit panel "Hero emoji" → `setIcon`, emoji-grapheme
  guard) — the AI's `uiMeta.icon` pick can be wrong (ant vs cockroach); prompts.py now
  demands the literal species emoji (backend deploy needed for that to take effect).
- Guest edits re-stash `weirdstats_pending_card` (persistCardEdits) so sign-in claims the
  EDITED card, not the as-generated one.
- **Fact-card background photo** (owner upload): edit panel → compress client-side
  (`shared/image.util.ts`, ≤1200px JPEG) → Storage `card-media/{uid}/{cardId}` (rules:
  owner-write, world-read, ≤5MB image; DEPLOYED) → URL on `uiMeta.heroImage` (+
  `heroImagePath` for deletes). Poster/editorial: `.wcard-bgimg` layer at 0.16 opacity
  under the text; split: photo fills the panel (emoji yields). Delete/duplicate clean up /
  clear the photo. ⚠️ The bucket (`weirdstats-ai.firebasestorage.app`) has a **CORS
  config** (GET, app origins) — REQUIRED so dom-to-image can inline photos into share/OG
  captures; visible `<img>`s deliberately carry NO crossorigin attr so display never
  depends on CORS. New origins (e.g. preview channels) must be added via
  `gcloud storage buckets update --cors-file`.

### Legacy (do not extend): the `Graph` flow
`generate/`, `graph-detail/`, `my-graphs/`, `services/graph.service.ts` are an orphaned
parallel lifecycle. `GraphService` is still referenced by `project-generate`/`share`, so
it can't be deleted cleanly yet — leave it alone.

## Story cards — the three Home treatments (canonical)
**Spec: `weird-stats-app/src/app/shared/story-poster/STORY-CARD-SPEC.md`** — structure,
colour and depth of treatments **A editorial / B cover / C split**, transcribed from the
shipped CSS. It is the source of truth: change the spec first, then keep BOTH
`home/home.page.scss` (the deck) and `shared/story-poster/*` (detail hero + share PNG +
OG image + share page) matching it.
- `app-story-poster` renders those three designs from real card data (treatment picked
  from the data: ≥2 metric rows → editorial · 0–100 % → split · else cover), so the card
  people SHARE is the card they saw on Home. Maps keep their own atlas card.
- Key invariants: 4 z-planes (photo 0 → scrim 1 → body 2 → cta 3); two-shadow frame;
  scrim direction follows copy position; one radial accent bloom per plate; bars/donut are
  white-on-translucent-white, never the accent.

## Home page (redesign) & story carousel
> **Deck is now REAL cards** (the 3 hardcoded `sc-a/b/c` prototypes + their A/B/C tags are
> gone). `storyCards` = first 5 curated (`showOnHome`) cards rendered with
> `app-story-card size="full" [compact]="true"` — the same component the detail page,
> Explore and share/OG captures use, so the deck IS the shareable card.
> - **`compact` input** = full chrome (quip + CTA) at TILE density (4 bars / 5 rows /
>   104px chart, 2-line title+quip, tighter padding). Without it, chart/leaderboard/atlas
>   overflow the fixed 262px deck frame and clip the CTA. Verified: all 7 types fit at 262.
> - **Tap**: `onStoryTap` — a peeking back card slides to front, only the FRONT card opens.
>   Do NOT use Swiper's `slideToClickedSlide` (it mutates activeIndex before Angular's
>   handler, so both cases look identical). Bind ONLY `(click)` on the host — also binding
>   `(storyCta)` double-fires (the CTA click already bubbles).
> - ⚠️ **Swiper owns the slide elements**: letting `*ngFor` reorder/remove them in place
>   throws in `ViewContainerRef.move`. `syncDeck()` therefore tears the container down and
>   rebuilds it when the curated set changes; the init guard is PER ELEMENT
>   (`el.swiper?.initialized`), never a component-level latch (the `*ngIf` can recreate the
>   element, and a latch would leave an empty shadow root = blank gap).
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
