# 03 — Roadmap & Planning

## The one planning idea that matters: build a *walking skeleton* first

Your original plan is **bottom-up**: fully learn/build audio, *then* fully build
ASR, *then* processing, and so on. That's a great way to *learn*, but a risky way
to *build a product*, because you don't have anything that works end-to-end until
the very end — and you discover the hard integration problems last.

**Recommended instead: a walking skeleton.** Build the *thinnest possible slice
that runs through every module end-to-end*, then deepen each module in later
passes.

```
Bottom-up (risky):     [====audio====][====ASR====][==detect==][==decide==][==present==]
                        finish each fully before the next → integration surprises at the end

Walking skeleton:      audio→ASR→screen (thin)  then thicken each layer, iterate
                        ▁▁▁▁ end-to-end working from week ~3, improves every iteration
```

The first version can be embarrassingly simple (low accuracy, ugly captions) —
what matters is that **audio in → text on the projector** works through the real
module boundaries. Everything after that is *improving* a working system, which
is far safer than *integrating* separate finished parts.

> You keep your learning goals — you just learn each topic *in the context of a
> running system* instead of in isolation.

## MVP definition (be ruthless)

**MVP = Live captions + automatic Bible-verse display, from the pastor's mic,
in Assisted mode, fully offline.**

That's it. Not lyrics. Not sermon understanding. Not multi-channel. Why:

- It proves the **entire pipeline** end-to-end (all 7 modules).
- It delivers **real value** on day one (captions alone help accessibility).
- Verse display is the **most demoable "wow"** and is *tractable* (references are
  structured and finite — unlike song detection, which is genuinely hard).

**Explicitly NOT in MVP** (parked, not forgotten):
- Song/lyric detection & sync (hard: fuzzy audio, spontaneous worship).
- Sermon understanding / verse recommendation.
- Multi-channel / speaker separation.
- Cloud, accounts, licensing server, multi-site.

## Milestones

| # | Milestone | Proves | Roughly |
|---|-----------|--------|---------|
| **M0** | Learn the audio chain; pick the "one stream" boundary | You can reliably get clean pastor-mic audio into a PC | Stage 1–2 |
| **M1** | **Walking skeleton**: capture → ASR → text on the projector | The whole pipeline runs end-to-end (even if crude) | — |
| **M2** | Real live captions: streaming, denoise/VAD, latency under control | It's *usable* on a real service | — |
| **M3** | Bible-verse detection + Bible DB + show verse (Assisted mode) | The "wow" feature; operator confirms | Stage 4–6 |
| **M4** | Operator UI polish: modes, override, blank, corrections captured | Church volunteers can actually run it | — |
| **M5** | Pilot in **one** real church; gather corrections & failures | It survives contact with reality | — |
| **M6+** | Song lyrics, then future intelligence | Expansion once the core is trusted | Stage 5–7 |

> Ship M2 (captions) to a real church *before* building M3. Real audio and real
> operators will reshape your priorities more than any amount of planning.

## Sequencing the learning (your stages, re-ordered around the skeleton)

Your seven stages are all correct — we just interleave them so each is learned
while building the skeleton, not before it:

1. Stage 1–2 (audio) → **M0** (must be first; clean input is the foundation).
2. Stage 3 (ASR) → **M1/M2** (the skeleton and captions).
3. Stage 4–6 (detect / decide / present) → **M3/M4** (verse feature, operator UI).
4. Stage 5 decision-engine depth & Stage 7 intelligence → **M6+** (after the pilot).

## Commercial considerations (keep these in view, don't build them yet)

- **Trust dial as a funnel:** Manual → Assisted → Auto mirrors how a church's
  confidence (and willingness to pay more) grows.
- **Content licensing** (CCLI for lyrics, Bible translation rights) is a real
  legal gate for a paid product — model it in the data layer early, even unused.
- **Offline = a feature, not just a constraint:** privacy (the sermon audio never
  leaves the building) and reliability (no internet dependency during service)
  are genuine selling points versus cloud competitors.
- **Support & install** will dominate cost for non-technical churches — the
  easier setup (Flow A) is, the more sellable and lower-support the product.

## Open questions to resolve next (design decisions still owed)

- ASR: commit to **true-streaming** (lower accuracy) vs **chunked Whisper**
  (higher accuracy, ~2s delay)? — the fork from Concept #2.
- Operator UI + Presentation Engine tech stack (desktop framework choice).
- Where does the Bible verse text come from (which translations, licensing)?
- Target hardware floor (CPU-only vs assume a GPU) — drives every model choice.
