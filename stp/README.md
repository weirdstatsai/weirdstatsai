# STP — Church AI Assistant

An **offline, intelligent church presentation system**. It listens to the live
service audio and automatically drives the projector — live captions, Bible
verses, song lyrics, announcements, and media — so a volunteer no longer has to
manually push every slide. The long-term goal is a commercial product that is to
ProPresenter what an autopilot is to a manual cockpit.

> **Hard constraint:** everything runs **locally, offline**. No internet is
> required during a service. AI models run on-premise whenever possible.

## Design-first

This project is being **designed before it is built**. These documents are the
current thinking. **No application code exists yet, and that is intentional.**

| Doc | What it covers |
|-----|----------------|
| [`docs/01-user-flows.md`](docs/01-user-flows.md) | Who uses it and what actually happens — setup, live service, operator override |
| [`docs/02-architecture.md`](docs/02-architecture.md) | The module pipeline, how modules communicate, data stores, process boundaries |
| [`docs/03-roadmap.md`](docs/03-roadmap.md) | MVP scope, the walking-skeleton plan, milestones, and what is deliberately *not* MVP |

## Core principles (the non-negotiables)

1. **Offline-first.** If a feature needs the cloud during service, it isn't in MVP.
2. **One audio boundary.** The system consumes *a single digital audio stream*.
   How the church produces it (mixer, interface, XLR, USB…) is not our concern.
3. **Independent modules, single responsibility.** No one giant AABI doing
   everything. Audio → ASR → Detectors → Decision → Presentation, each swappable.
4. **The Presentation Engine is dumb.** It renders commands. It never does AI.
5. **Human-in-the-loop for MVP.** The AI *suggests*; the operator can always
   see, approve, correct, or override before/while it hits the screen.
6. **Clean input beats a fancier model.** Audio quality is worth more than the
   next-bigger ASR model.
