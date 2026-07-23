# 02 — System Architecture

## The pipeline (data flow)

Audio flows left to right. Each box is an **independent module with one job**.

```
                        ┌─────────────────────────────────────────────┐
                        │            CONFIG + CONTENT LIBRARY          │
                        │  church profile · Bibles · songs · media     │
                        └───────────────┬─────────────────────────────┘
                                        │ (read by everything)
                                        ▼
 ┌────────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────────────────┐
 │  1. AUDIO  │──▶│ 2. AUDIO     │──▶│  3. ASR   │──▶│  raw transcript      │
 │   CAPTURE  │   │ PRE-PROCESS  │   │ (speech→  │   │  stream (text +      │
 │ one stream │   │ (denoise,VAD)│   │   text)   │   │  timestamps)         │
 └────────────┘   └──────────────┘   └───────────┘   └──────────┬───────────┘
                                                                 ▼
                                                   ┌──────────────────────────┐
                                                   │ 4. DETECTORS / NLU        │
                                                   │  · Bible reference        │
                                                   │  · song / lyrics match    │
                                                   │  · commands, section change│
                                                   └──────────────┬────────────┘
                                                                  ▼  (events)
                                                   ┌──────────────────────────┐
                                                   │ 5. DECISION ENGINE        │
                                                   │  the "brain" — a state    │
                                                   │  machine. Decides what    │
                                                   │  SHOULD be on screen.     │
                                                   └──────────────┬────────────┘
                                                                  ▼ (suggestions)
                                   ┌──────────────────────────────────────────┐
                                   │ 6. OPERATOR UI  (human-in-the-loop)       │
                                   │  shows suggestions · approve/override     │
                                   └──────────────┬────────────────────────────┘
                                                  ▼ (final commands)
                                   ┌──────────────────────────────────────────┐
                                   │ 7. PRESENTATION ENGINE  (dumb renderer)   │
                                   │  renders commands to the projector output │
                                   └──────────────────────────────────────────┘
```

## How modules communicate — an internal event bus

The modules do **not** call each other directly. They publish/subscribe to a
lightweight **internal message bus** (in-process pub/sub for MVP; can grow into
real IPC between processes later).

- Module 3 publishes `transcript.partial` / `transcript.final` events.
- Module 4 subscribes to those, publishes `detection.verse`, `detection.song`, etc.
- Module 5 subscribes to detections, publishes `suggestion.show` / `suggestion.hide`.
- Module 6 subscribes to suggestions, publishes `command.render` (after operator policy).
- Module 7 subscribes to commands and renders.

**Why this matters:** any module can be swapped (e.g. replace the ASR engine)
without touching its neighbors — they only share the *event contract*, not code.
This is the concrete mechanism behind your "independent modules" requirement.

## Module responsibilities & candidate tech

Tech is named only to make it concrete — all are **swappable behind the event contract**.

| # | Module | Single responsibility | Candidate tech (local) |
|---|--------|----------------------|------------------------|
| 1 | **Audio Capture** | Pull one digital stream from the OS input device; expose a level meter | OS audio APIs (PortAudio/WASAPI/CoreAudio) |
| 2 | **Audio Pre-process** | Voice-activity detection, denoise, resample to what ASR wants | WebRTC VAD, RNNoise |
| 3 | **ASR** | Audio → timestamped text (streaming) | Whisper (`faster-whisper`/`whisper.cpp`), Vosk, NVIDIA Parakeet |
| 4 | **Detectors / NLU** | Find verses, songs, commands, section changes in text | rules + fuzzy match; small local models later |
| 5 | **Decision Engine** | Decide *what should be on screen*, given context & service state | state machine (our own logic) |
| 6 | **Operator UI** | Human-in-the-loop control + settings + content management | desktop UI framework (TBD) |
| 7 | **Presentation Engine** | Render commands to the projector; layouts, fonts, transitions | rendering layer (TBD) |

## The Decision Engine is a *state machine* (the key design idea)

The brain isn't "if verse detected, show verse." **Context changes the right
answer.** The service moves through states, and the same input means different
things in different states:

```
        ┌─────────┐   worship starts    ┌──────────┐
        │  IDLE   │────────────────────▶│ WORSHIP  │
        └─────────┘                      └────┬─────┘
             │ service starts                 │ song ends / preaching detected
             ▼                                ▼
        ┌──────────┐   "turn to..."      ┌──────────┐
        │  SERMON  │◀───────────────────▶│ SCRIPTURE│
        └──────────┘   verse shown, back └──────────┘
             │ announcement cue
             ▼
        ┌───────────────┐
        │ ANNOUNCEMENTS │
        └───────────────┘
```

Example: "John 3:16" spoken **during SERMON** → show the verse. The *same phrase*
mid-worship might be a lyric, not a cue — the state guards against false actions.
This is why the Decision Engine must be its own module holding **service state**,
not a pile of if-statements scattered across detectors.

## Data stores (all local, all offline)

| Store | Holds | Likely tech |
|-------|-------|-------------|
| **Bible DB** | Every verse, multiple translations, addressable by reference | SQLite |
| **Song library** | Titles, lyrics, section structure, arrangement | SQLite |
| **Config / profile** | Audio device, outputs, layout, mode (Manual/Assisted/Auto) | file (JSON/SQLite) |
| **Service log** | Transcript, what was shown, operator corrections | SQLite / append log |
| **Media** | Images, videos | filesystem + index |

## Process boundaries (deployment shape)

For MVP, everything can run as **one application on one PC**. But design the
seams so these can later split into separate processes:

- **ASR is heavy** (CPU/GPU) → natural candidate to run as its own process/service.
- **Presentation output** may eventually live on a *second machine* driving the
  projector, receiving commands over the local network.
- The **event bus** is what makes that split cheap — in-process now, network-capable later.

> Rule of thumb: build it as one process, but never let two modules share memory
> or call each other's functions directly. They talk *only* through events.

## Cross-cutting concerns (don't forget these)

- **Logging/telemetry** — local only; needed to debug "why did it show that?"
- **Failure/fallback** — if ASR dies mid-service, the operator must fall back to
  full manual instantly. Graceful degradation is a *requirement*, not a nicety.
- **Latency budget** — every stage adds delay; captions must stay under the human
  "feels live" threshold (~1–2s end to end). Track it per stage.
- **Licensing** — song lyrics (CCLI) and some Bible translations are copyrighted;
  the content model must track licensing per item. This is a *commercial* blocker
  if ignored.
