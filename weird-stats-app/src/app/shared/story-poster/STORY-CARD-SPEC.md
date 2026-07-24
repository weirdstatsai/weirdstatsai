# Story-card spec — the three Home treatments

Canonical structure, colour and depth of the three "Today's weird stories"
cards. Values transcribed from the shipped CSS, not redesigned — the Home deck
(`home.page.scss`) and `story-poster.component.scss` must both match this.
Change the spec first, then both files.

---

## 1. Shared shell (all three)

Frame — one rounded, clipped, elevated plate:

```
height 296px · border-radius 20px · overflow hidden · color #fff
box-shadow: 0 2px 4px rgba(20,22,31,.06),      ← contact shadow (tight, faint)
            0 26px 44px -24px rgba(20,22,31,.55)  ← lift shadow (big, offset up)
```

Two-shadow stack is what makes it read as a *physical card*: the tight one
seats it, the wide negative-spread one floats it. Never collapse to one.

### Z-layer model — every treatment uses the same four planes

| z | layer | role |
|---|---|---|
| 0 | `.sc-photo` | colour plate + subject emoji (the "image") |
| 1 | `.sc-scrim` | dark wash that buys text contrast |
| 2 | `.sc-body`  | all copy, `position:absolute; inset:0`, flex column |
| 3 | `.sc-cta`   | pill button, lifted above the body |

Depth cues are *layered*, not per-element: plate → scrim → text → button.

### Shared type + chrome

```
.sc-pill    rgba(255,255,255,.16) + blur(6px) + 1px rgba(255,255,255,.24)
            10.5px/800, radius 999px          ← frosted glass, sits on the plate
.sc-title   18px/800, line-height 1.14, letter-spacing -.02em
            text-shadow 0 2px 14px rgba(0,0,0,.35)
.sc-quip    12px, opacity .92, text-shadow 0 1px 8px rgba(0,0,0,.3)
.sc-cta     bg rgba(255,255,255,.94), text #20223A, 11.5px/800
            radius 999px, shadow 0 6px 16px rgba(0,0,0,.26)
.sc-emoji   drop-shadow(0 10px 22px rgba(0,0,0,.4))
```

Every text layer carries its own shadow — that is the second contrast system
after the scrim, and why type stays legible over a bright plate.

---

## 2. Treatment A — **editorial** (the mosquito card)

Headline + labelled stat bars, subject emoji pushed to the right edge.

```
plate   radial-gradient(115% 90% at 84% 42%, rgba(233,120,88,.55), transparent 56%),
        linear-gradient(120deg, #241241 0%, #3a2168 46%, #6d3b8e 100%)
        → deep violet base with a warm amber bloom behind the emoji
scrim   linear-gradient(90deg, rgba(18,8,36,.86) 0%, rgba(18,8,36,.55) 44%, transparent 72%)
        → HORIZONTAL: protects the left text column, lets the art breathe right
emoji   right 3%, top 45%, rotate(-8deg), 102px
body    max-width 70%   (text never runs under the emoji)
bars    track  rgba(255,255,255,.18), height 7px, radius 4px
        fill   linear-gradient(90deg, #ffffff, rgba(255,255,255,.72))
        label  flex 0 0 50px, 10.5px/700, opacity .92
caption 10px, opacity .68
```

## 3. Treatment B — **cover** (the 11% card)

One big stat, full-bleed art, copy anchored to the bottom.

```
plate   radial-gradient(70% 62% at 64% 40%, rgba(64,120,205,.55), transparent 62%),
        radial-gradient(46% 42% at 60% 38%, rgba(80,205,165,.4),  transparent 60%),
        linear-gradient(150deg, #080d2a 0%, #121844 52%, #1c1552 100%)
        → midnight navy with layered blue + teal blooms (two lights, not one)
scrim   linear-gradient(0deg, rgba(5,7,26,.92) 0%, rgba(5,7,26,.4) 44%, transparent 70%)
        → VERTICAL: bottom-weighted, because the copy sits at the bottom
emoji   right 8%, top 40%, 126px  (largest of the three — it is the hero)
body    justify-content flex-end, max-width 78%
stat    b 25px/800 letter-spacing -.02em · small 11.5px opacity .82
```

## 4. Treatment C — **split** (the 2% water card)

Text left, data panel right. No photo plate — the card *is* the colour.

```
card    linear-gradient(135deg, #0e3050 0%, #12507a 100%)   ← teal/navy, flat
body    justify-content center, max-width 60%
panel   right 0, width 40%, z-index 1
        background linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.04))
        border-left 1px solid rgba(255,255,255,.14)
        → depth by translucency + a hairline seam, not by shadow
donut   78×78, conic-gradient(#7ad0ff var(--deg), rgba(255,255,255,.2) 0)
        ::after inset 10px, radius 50%, background #103c5c  ← punches the hole
        number 18px/800 · label 10.5px/700 opacity .85
cta     position static (in flow, not absolute) — the only treatment that differs
```

---

## Rules

1. **Scrim direction follows copy position.** Copy left → horizontal scrim (A).
   Copy bottom → vertical scrim (B). Copy on a flat plate → no scrim (C).
2. **One accent bloom per plate**, radial, behind the emoji — it separates the
   subject from the background without an outline.
3. **Bars/donut are white-on-translucent-white**, never the accent colour: the
   plate owns the hue, the data owns the light.
4. **Depth is layered, never outlined** — shadow, translucency and blur only.
   The single hairline (`.sc-panel` border-left) is a seam, not a border.
5. Treatment picked from data: ≥2 metric rows → A · a 0–100 % value → C · else B.
