# STP — Church AI Assistant · Project Guide

Read this first. It captures the vision, architecture, every decision made so far,
the current build status, and — importantly — **how the owner likes to work.**

---

## 0. Working agreement (HOW to collaborate — do not skip)

The owner is designing this like a **senior software architect** would, and is
learning the domain step by step. Honor these rules:

1. **Design before code.** Do **NOT** generate code unless explicitly asked.
2. **One concept at a time.** Present a single idea, let them question it, *then*
   move on. Never dump ten concepts at once.
3. **Act as a senior architect.** Challenge weak decisions, name trade-offs, cite
   how real systems do it, keep it practical and commercial.
4. **Teach, don't overwhelm.** Short, clear, concrete. Analogies help.
5. **They build/test on their own Mac.** Any Claude cloud session has no
   microphone and can't reach their hardware — so *they* run the live tests and
   paste results back. Provide one-paste commands to minimize friction.

This is a **commercial product** in the making (sellable to churches), not a
hobby — weigh decisions for scalability, but keep the MVP one-developer-buildable.

---

## 1. Vision

An **offline, intelligent church presentation system** — "autopilot for
ProPresenter." It listens to the live service audio and automatically drives the
projector: live captions, Bible verses, song lyrics, announcements, media.
A volunteer no longer manually pushes every slide.

### Hard constraints
- **Runs 100% offline.** No internet required during a service.
- **AI models run locally** on the church PC.
- **Consumes ONE thing: a single digital audio stream.** How the church produces
  it (mixer, interface, XLR, USB…) is not our concern — that's the church's side
  of the boundary. The audio interface is the universal adapter.

---

## 2. Architecture (summary — full detail in `docs/02-architecture.md`)

Independent modules, single responsibility each, talking over an **internal
event bus** (in-process now; can split into separate processes later). No giant
monolithic AI.

```
Audio Capture → Audio Pre-process(VAD/denoise) → ASR(speech→text)
   → Detectors/NLU(verse, song, command) → Decision Engine(state machine)
   → Operator UI(human-in-the-loop) → Presentation Engine(dumb renderer → projector)
```

Key architectural rules:
- **ASR produces text; the display renders text; they are never the same code.**
  Swapping the terminal for a real screen must be a trivial, isolated change.
- **The Presentation Engine is "dumb"** — it renders commands, never does AI.
- **The Decision Engine is a state machine** (IDLE / WORSHIP / SERMON / SCRIPTURE
  / ANNOUNCEMENTS). Context changes the right answer: "John 3:16" during a sermon
  = show the verse; mid-worship it might be a lyric.
- **Human-in-the-loop:** the AI emits *suggestions*; the operator can approve/
  override before/while it hits the screen. Three modes = a "trust dial":
  **Manual → Assisted (default) → Auto.** Also doubles as a sales funnel.
- All data stores are **local** (SQLite/files): Bible DB, song library, config,
  service logs, media.

---

## 3. Decisions log (what we committed to and why)

| Decision | Rationale |
|----------|-----------|
| **Walking skeleton, not strict bottom-up** | Build the thinnest `audio→text→screen` slice end-to-end first, then deepen. Avoids leaving all integration risk to the end. |
| **Ruthless MVP = live captions + Bible-verse display only** | Proves the whole pipeline; verses are tractable & demoable. Song/lyric detection is hard → parked. |
| **English first** | Prove the pipeline in one language; add others later. |
| **Trust dial (Manual/Assisted/Auto) + human-in-the-loop** | Auto-switching in front of a congregation is a visible failure mode; also a commercial adoption funnel. |
| **Whisper for ASR (via `faster-whisper`), running locally** | Best accuracy, offline, strong on Apple Silicon. Chose it over Vosk (lower accuracy) and over cloud (violates offline constraint). |
| **Multilingual (incl. Telugu) = confirmed feasible, parked** | Whisper does Telugu, but needs a *multilingual* model (`medium`/`large-v3`, not the `.en` models) — bigger/slower. Low-resource languages need larger models. Revisit post-MVP. |

Open trade-off still owed: **true-streaming ASR (low latency, less accurate) vs
chunked Whisper (higher accuracy, ~2s delay).** Currently using chunked windows.

---

## 4. Current status (as of this handoff)

**✅ Walking-skeleton milestones M1 + M2 essentially done — proven on the owner's
Mac (M4, 24 GB RAM), fully offline:**

- `poc/live_captions.py` (v2): **microphone → local Whisper (`base.en`) → plain
  text in the terminal.** Works. Talking produces accurate English captions.
- v2 added a tiny "Module 2": an **RMS silence gate + `vad_filter=True`** to stop
  Whisper hallucinating words on silence (v1 printed phantom words like
  "by cat dog" during quiet gaps). Warnings suppressed.
- Telugu tested: works with a multilingual model but downloads were slow and
  `medium` is heavier on CPU — parked (see decisions log). English is the focus.

**Known characteristics / limitations of the current POC:**
- Transcribes in **fixed ~5-second windows** → chunky latency, fragmented
  sentences. True streaming is a later iteration.
- Output goes to the **terminal only** — no real display yet.
- `base.en` is the balanced model; `small.en` is more accurate (M4 can handle it).

---

## 5. How to run the POC (on the owner's Mac, not a cloud session)

One-shot: `bash poc/setup_and_run.sh` — creates a venv, installs
`faster-whisper sounddevice numpy`, writes `live_captions.py`, and runs it.
First run downloads the model (~150 MB for `base.en`); offline thereafter.
Grant the macOS microphone permission when prompted; talk; Ctrl+C to stop.

Knobs (top of `poc/live_captions.py`): `MODEL_SIZE` (`tiny.en`/`base.en`/
`small.en`, or multilingual `small`/`medium`/`large-v3`), `WINDOW_SECONDS`,
`INPUT_DEVICE` (set to a device index — from `--list-devices` — to use the
mixer/interface instead of the built-in mic), `SILENCE_RMS`, and for non-English
add `language=`/`task=` (`task="translate"` → English out from any language).

---

## 6. Repo layout

- `CLAUDE.md` — this guide
- `README.md` — short overview + core principles
- `docs/01-user-flows.md` — personas, setup, live service, operator override
- `docs/02-architecture.md` — modules, event bus, decision state machine, stores
- `docs/03-roadmap.md` — MVP, walking-skeleton plan, milestones M0–M6
- `poc/live_captions.py` — working live-captions POC (v2)
- `poc/setup_and_run.sh` — one-shot setup+run for macOS
- `poc/README.md` — POC run instructions

---

## 7. Next step

**Build the first piece of Module 7 — a fullscreen caption window.** Take the
working text output and show it as big white captions on a black fullscreen
screen (projector-style). The ASR engine does not change; we just point its
output at a screen instead of the terminal. This is the first time it *looks*
like a product.

After that, in rough order: better accuracy (`small.en`) / lower latency →
Bible-verse detection + Bible DB (the MVP "wow") → operator UI + modes.

---

## 8. Git conventions
- Commit author: **Nehemya Maddela** (use the owner's GitHub email).
- End commit messages with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do not commit virtualenvs, downloaded model files, or `venv/`.
