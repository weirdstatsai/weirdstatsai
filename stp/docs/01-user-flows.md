# 01 — User Flows

Before architecture, we need to know *who touches the system and when*. Modules
exist to serve these flows.

## Personas

| Persona | Role | Technical? | Cares about |
|---------|------|-----------|-------------|
| **Operator** (tech volunteer) | Installs, configures, and runs the system during service | Somewhat | It "just works", easy override, nothing embarrassing on screen |
| **Content Admin** | Curates the song library, Bible translations, announcements, media | Somewhat | Getting content in easily, correct lyrics/verses |
| **Pastor / Worship Leader** | Speaks and sings — *indirectly* drives the system | No | Not being interrupted; system keeps up with them |
| **Congregation** | Reads the screen | No | Legible, timely, correct content |
| **Church Admin / Buyer** | Decides to buy it | No | Price, reliability, support, does it reduce volunteer load |

> **Key insight:** the *pastor* is the primary "input device," but the *operator*
> is the primary user of the software. Design the UI for the operator; design the
> intelligence around the pastor's unscripted behavior.

## Flow A — First-time setup (once per install)

1. Install the app on the church's presentation PC.
2. **Pick the audio input** — the app lists OS audio devices; operator selects
   the one carrying the live feed and sees a **live level meter** to confirm signal.
3. **Calibrate** — set input gain / confirm the pastor's mic is clean.
4. **Load content**: choose Bible translation(s); import the song library;
   add recurring announcements/media.
5. **Configure outputs** — which display is the projector; caption position, fonts, layout.
6. Save as a reusable **church profile**.

> Architectural implication: setup produces a **local config + content library**
> that every later flow reads. This is a first-class module, not an afterthought.

## Flow B — Pre-service prep (optional, per service)

1. Operator opens the app; the church profile loads.
2. (Optional) Build an **order of service** — expected songs, announcements,
   sermon title. This is a *hint* to the AI, never a hard script.
3. Confirm the audio device is live (level meter).
4. Press **Go Live**.

## Flow C — Live service (the core automatic loop)

This is the product. While live:

```
Pastor speaks/sings  →  system hears audio  →  captions appear in real time
        │
        ├─ "Turn to John 3:16"      → verse detected → John 3:16 SUGGESTED → shown
        ├─ worship song starts      → song detected  → lyrics SUGGESTED → shown, synced
        ├─ pastor resumes preaching → worship ends    → lyrics hidden
        └─ announcement time         → operator triggers announcement slide
```

The operator mostly **watches**. The system proposes what to show; depending on
the chosen mode (see below) it either shows it automatically or waits for a tap.

## Flow D — Operator override (the safety net — most important UX)

At any instant the operator can:

- **Approve** a suggestion (if in confirm mode).
- **Reject / dismiss** a wrong suggestion before it shows.
- **Correct** — pick a different verse/translation/song.
- **Force** any content manually (full manual, like today's ProPresenter).
- **Blank / freeze** the screen instantly (the "oh no" button).

> **Architect's challenge to the original vision:** *fully* automatic slide
> switching in front of a live congregation is high-risk — a wrong verse on the
> big screen is a *visible*, public failure. So MVP must support **three modes**,
> and default to the middle one:
>
> | Mode | Behavior | For |
> |------|----------|-----|
> | **Manual** | AI suggests in a side panel; operator clicks to show | Nervous first adopters |
> | **Assisted (default)** | AI shows captions automatically; verses/lyrics need one tap to confirm | Most churches |
> | **Auto** | AI shows everything automatically; operator only overrides | Trusted, after weeks of use |
>
> This "trust dial" is also a *sales* feature: churches adopt at Manual and
> graduate to Auto as confidence grows.

## Flow E — Post-service

1. Press **End**.
2. System saves the **transcript**, the list of what was shown, and any
   corrections the operator made.
3. Corrections become **training/feedback data** (local) to improve detection.
4. (Future) simple analytics: songs sung, verses shown, caption accuracy.

## What the flows tell the architecture

- There must be a **human-in-the-loop control surface** (the Operator UI) that
  sits *between* the AI's decisions and the screen — not bolted on later.
- **Config + content library** is a core module read by everything.
- The AI pipeline emits **suggestions**, not final screen commands — a subtle but
  crucial distinction that keeps the operator in control.
- Operator corrections are a **feedback signal**, so capture them from day one.
