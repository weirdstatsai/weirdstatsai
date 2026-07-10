"""SEO / social bot rendering.

Card URLs (/card/:id, /share/:id) are rewritten to this backend by Firebase
Hosting. Social scrapers and search crawlers don't run the Angular app, so we
detect them by User-Agent and serve purpose-built HTML with real per-card
title/description/OG-image + JSON-LD. Humans get the normal SPA shell proxied
from Hosting, so the app boots exactly as before.

Everything here is defensive: a missing card, missing Pillow, or a failed
shell fetch degrades gracefully rather than breaking the page.
"""
from __future__ import annotations

import html
import logging
import os
import re
import time
from typing import Optional

import httpx

logger = logging.getLogger("uvicorn.error")

ORIGIN = "https://weirdstats.ai"
SITE = "WeirdStats.ai"
DEFAULT_TITLE = f"{SITE} — Ask something weird, get a chart worth sharing"
DEFAULT_DESC = (
    "Turn any curious question into surprising stats, rankings, and visual "
    "insights in seconds."
)
DEFAULT_OG_IMAGE = f"{ORIGIN}/assets/og/og-default.png"

# Curated crawler/scraper list. Deliberately NOT matching a bare "bot" (some
# phone brands, e.g. Cubot, contain it) so we never trap a real user on the
# snapshot page. Matching is case-insensitive substring.
_BOT_TOKENS = (
    "googlebot", "google-inspectiontool", "googleother", "bingbot", "bingpreview",
    "slurp", "duckduckbot", "baiduspider", "yandex", "sogou", "exabot",
    "facebookexternalhit", "facebookcatalog", "facebot", "twitterbot",
    "linkedinbot", "whatsapp", "telegrambot", "slackbot", "slack-imgproxy",
    "discordbot", "pinterest", "redditbot", "applebot", "embedly", "quora link",
    "vkshare", "w3c_validator", "skypeuripreview", "nuzzel", "bitlybot",
    "flipboard", "tumblr", "mastodon", "petalbot", "ia_archiver", "crawler",
    "spider", "screaming frog", "ahrefsbot", "semrushbot", "prerender",
)


def is_bot(user_agent: str) -> bool:
    ua = (user_agent or "").lower()
    return any(tok in ua for tok in _BOT_TOKENS)


# ── Card field helpers ──────────────────────────────────────────────────────

_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF -⁯️‍]+"
)


def _plain_title(card: dict) -> str:
    t = str(card.get("title") or "").strip()
    return _EMOJI_RE.sub("", t).strip()


def _fmt_num(v) -> str:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return str(v)
    a = abs(n)
    if a >= 1_000_000_000_000:
        return f"{n / 1_000_000_000_000:.1f}T"
    if a >= 1_000_000_000:
        return f"{n / 1_000_000_000:.1f}B"
    if a >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if a >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(int(n)) if n == int(n) else f"{n:.1f}"


def _description(card: dict) -> str:
    d = str(card.get("insight") or "").strip()
    return d or DEFAULT_DESC


# ── Snapshot HTML (bots) ────────────────────────────────────────────────────

def build_snapshot_html(card_id: str, doc: Optional[dict]) -> str:
    """Minimal, crawler-friendly HTML for a single card."""
    canonical = f"{ORIGIN}/card/{card_id}"
    card = (doc or {}).get("data") or {}

    if not card:
        # Unknown card — valid page, but keep it out of the index.
        return _html_document(
            title=DEFAULT_TITLE, description=DEFAULT_DESC, canonical=canonical,
            image=DEFAULT_OG_IMAGE, body="<h1>Card not found</h1>",
            robots="noindex, follow",
        )

    plain = _plain_title(card) or "A weird stat"
    title = f"{plain} — {SITE}"
    desc = _description(card)
    # Prefer the real-card social preview (rendered client-side on publish and
    # stored in Firebase Storage); fall back to the generated template image.
    image = (doc or {}).get("ogImage") or f"{ORIGIN}/og/card/{card_id}.png"

    # Visible, indexable content: heading, insight, and the data rows/values.
    rows = card.get("rows") or []
    body_parts = [f"<h1>{html.escape(plain)}</h1>"]
    if card.get("insight"):
        body_parts.append(f"<p>{html.escape(str(card['insight']))}</p>")
    metric = card.get("metric") or {}
    if metric.get("value") is not None and not rows:
        unit = html.escape(str(metric.get("unit") or ""))
        body_parts.append(
            f"<p><strong>{html.escape(_fmt_num(metric['value']))}</strong> {unit}</p>"
        )
    if rows:
        items = []
        for i, r in enumerate(rows[:25], 1):
            label = html.escape(str(r.get("label") or ""))
            val = html.escape(_fmt_num(r.get("value")))
            unit = html.escape(str(r.get("unit") or ""))
            items.append(f"<li>{i}. {label} — {val} {unit}</li>")
        body_parts.append("<ol>" + "".join(items) + "</ol>")
    body_parts.append(f'<p><a href="{canonical}">Open on {SITE}</a></p>')
    body_parts.append(f'<img src="{image}" width="1200" height="630" alt="{html.escape(plain)}" />')

    # JSON-LD structured data (Dataset fits a stat card).
    jsonld = (
        '{"@context":"https://schema.org","@type":"Dataset",'
        f'"name":{_json_str(plain)},'
        f'"description":{_json_str(desc)},'
        f'"url":{_json_str(canonical)},'
        f'"image":{_json_str(image)},'
        f'"creator":{{"@type":"Organization","name":{_json_str(SITE)}}}}}'
    )

    return _html_document(
        title=title, description=desc, canonical=canonical, image=image,
        body="".join(body_parts), jsonld=jsonld, og_type="article",
    )


def _json_str(s: str) -> str:
    import json
    return json.dumps(str(s))


def _html_document(title: str, description: str, canonical: str, image: str,
                   body: str, jsonld: str = "", og_type: str = "website",
                   robots: str = "index, follow") -> str:
    t = html.escape(title)
    d = html.escape(description)
    ld = f'<script type="application/ld+json">{jsonld}</script>' if jsonld else ""
    return (
        "<!DOCTYPE html><html lang=\"en\"><head>"
        "<meta charset=\"utf-8\"/>"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>"
        f"<title>{t}</title>"
        f'<meta name="description" content="{d}"/>'
        f'<meta name="robots" content="{robots}"/>'
        f'<link rel="canonical" href="{html.escape(canonical)}"/>'
        f'<meta property="og:type" content="{og_type}"/>'
        f'<meta property="og:site_name" content="{SITE}"/>'
        f'<meta property="og:title" content="{t}"/>'
        f'<meta property="og:description" content="{d}"/>'
        f'<meta property="og:url" content="{html.escape(canonical)}"/>'
        f'<meta property="og:image" content="{html.escape(image)}"/>'
        '<meta property="og:image:width" content="1200"/>'
        '<meta property="og:image:height" content="630"/>'
        '<meta name="twitter:card" content="summary_large_image"/>'
        f'<meta name="twitter:title" content="{t}"/>'
        f'<meta name="twitter:description" content="{d}"/>'
        f'<meta name="twitter:image" content="{html.escape(image)}"/>'
        f"{ld}</head><body>{body}</body></html>"
    )


# ── SPA shell proxy (humans) ────────────────────────────────────────────────

_shell_cache: dict = {"html": None, "at": 0.0}
_SHELL_TTL = 300  # 5 min — long enough to amortise, short enough to catch redeploys


async def get_spa_shell() -> str:
    now = time.time()
    if _shell_cache["html"] and now - _shell_cache["at"] < _SHELL_TTL:
        return _shell_cache["html"]
    for url in (f"{ORIGIN}/index.html", "https://weirdstats-ai.firebaseapp.com/index.html"):
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200 and "<app-root" in resp.text:
                    _shell_cache.update(html=resp.text, at=now)
                    return resp.text
        except Exception as e:
            logger.warning(f"SPA shell fetch failed for {url}: {e}")
    # Last resort: stale cache, else a tiny bootstrap that sends the user home.
    if _shell_cache["html"]:
        return _shell_cache["html"]
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<meta http-equiv='refresh' content='0; url={ORIGIN}/home'>"
        f"</head><body><a href='{ORIGIN}/home'>Open {SITE}</a></body></html>"
    )


# ── Per-card OG image (Pillow, fully defensive) ─────────────────────────────

_FONT_PATHS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
)


def _hex(s, default):
    """Parse '#rrggbb' / '#rgb' to an (r,g,b) tuple; default on anything odd."""
    try:
        s = str(s).lstrip("#").strip()
        if len(s) == 3:
            s = "".join(c * 2 for c in s)
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
    except Exception:
        return default


def _mix(color, other, amt):
    """Blend `color` toward `other` by amt (0..1)."""
    return tuple(int(c + (o - c) * amt) for c, o in zip(color, other))


def compose_og_image(doc: Optional[dict]) -> Optional[bytes]:
    """Render a branded 1200x630 PNG that mirrors the in-app card: the card's own
    pastel gradient behind a clean white card panel, accent-coloured ranking bars
    or a big KPI number, and the insight below — never overlapping. This is the
    fallback used whenever a card has no client-rendered OG image, so it must look
    like the real thing. Returns None on any problem so the route can fall back to
    the default image."""
    card = (doc or {}).get("data") or {}
    if not card:
        return None
    try:
        from io import BytesIO
        from PIL import Image, ImageDraw, ImageFont, ImageFilter

        W, H = 1200, 630
        ui = card.get("uiMeta") or {}
        WHITE = (255, 255, 255)
        INK = (20, 22, 31)
        MUTE = (120, 122, 133)
        accent = _hex(ui.get("accentColor"), (0x6C, 0x5C, 0xE7))
        g_from = _hex(ui.get("gradientFrom"), (0xF5, 0xF3, 0xFF))
        g_to = _hex(ui.get("gradientTo"), (0xED, 0xE9, 0xFE))

        # ── Background: the card's pastel gradient (vertical strip, upscaled) ──
        strip = Image.new("RGB", (1, H))
        sp = strip.load()
        for y in range(H):
            sp[0, y] = _mix(g_from, g_to, y / (H - 1))
        img = strip.resize((W, H)).convert("RGBA")

        def font(size: int, bold: bool = True):
            paths = _FONT_PATHS if bold else (_FONT_PATHS[1], _FONT_PATHS[0], *_FONT_PATHS[2:])
            for p in paths:
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    continue
            raise RuntimeError("no scalable font available")

        # ── Card panel with a soft drop-shadow ──
        pad = 56
        panel = [pad, 52, W - pad, H - 104]
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [panel[0], panel[1] + 16, panel[2], panel[3] + 16], radius=34, fill=(20, 22, 43, 70)
        )
        img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(24)))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle(panel, radius=34, fill=(255, 255, 255, 255))

        inset = 42
        cx = panel[0] + inset
        cr = panel[2] - inset
        cw = cr - cx
        panel_bottom = panel[3] - inset
        y = panel[1] + inset

        # No category/type pills — this is a shared image, not app chrome.
        # ── Title (up to 2 lines) ──
        plain = _plain_title(card) or "A weird stat"
        f_title = font(48)
        tlines = _wrap(draw, plain, f_title, cw)[:2]
        for ln in tlines:
            draw.text((cx, y), ln, font=f_title, fill=INK)
            y += 56
        y += 12

        rows = card.get("rows") or []
        metric = card.get("metric") or {}
        insight = str(card.get("insight") or "").strip()
        ctype_l = str(card.get("cardType") or "").lower()
        # A fact card is text-first: its number (if any) lives in the title, so we
        # never render it as a KPI. Bars need real rows; a KPI needs a value.
        mode = "rows" if rows else ("kpi" if (metric.get("value") is not None and ctype_l != "fact") else "text")

        def footer_insight(max_lines: int):
            """Draw the insight as a muted footer, bottom-anchored, with an ellipsis
            when it's clipped. Returns the height it reserves."""
            if not insight:
                return 0
            f = font(25, bold=False)
            allw = _wrap(draw, insight, f, cw)
            lines = allw[:max_lines]
            if lines and len(allw) > max_lines:
                lines[-1] = lines[-1].rstrip() + "…"
            h = len(lines) * 32 + 14
            iy = panel_bottom - len(lines) * 32
            for ln in lines:
                draw.text((cx, iy), ln, font=f, fill=(90, 92, 104))
                iy += 32
            return h

        if mode == "rows":
            ins_h = (min(len(_wrap(draw, insight, font(25, bold=False), cw)), 2) * 32 + 14) if insight else 0
            body_bottom = panel_bottom - ins_h
            avail = body_bottom - y
            MIN_RH = 44
            n = max(1, min(len(rows), 5, int(avail // MIN_RH)))
            row_h = min(64, avail / n)
            mx = max([_num(r.get("value")) for r in rows[:n]] + [1])
            f_lbl = font(30, bold=False)
            f_val = font(30)
            for r in rows[:n]:
                label = str(r.get("label") or "")
                while draw.textlength(label, font=f_lbl) > cw - 210 and len(label) > 4:
                    label = label[:-2]
                val = f"{_fmt_num(r.get('value'))} {str(r.get('unit') or '')}".strip()
                draw.text((cx, y), label, font=f_lbl, fill=(46, 48, 58))
                draw.text((cr, y), val, font=f_val, fill=accent, anchor="ra")
                bar_y = y + 32
                frac = max(0.05, _num(r.get("value")) / mx)
                draw.rounded_rectangle([cx, bar_y, cr, bar_y + 9], radius=5,
                                       fill=_mix(accent, WHITE, 0.82))
                draw.rounded_rectangle([cx, bar_y, cx + int(cw * frac), bar_y + 9], radius=5,
                                       fill=accent)
                y += row_h
            footer_insight(2)
        elif mode == "kpi":
            ins_h = (min(len(_wrap(draw, insight, font(25, bold=False), cw)), 2) * 32 + 14) if insight else 0
            body_bottom = panel_bottom - ins_h
            f_big = font(128)
            big = _fmt_num(metric["value"])
            draw.text((cx, y), big, font=f_big, fill=accent)
            bw = draw.textlength(big, font=f_big)
            unit = str(metric.get("unit") or "")
            if unit:
                draw.text((cx + bw + 16, y + 76), unit, font=font(34), fill=MUTE, anchor="lm")
            name = str(metric.get("name") or "")
            # Only draw the metric name if it clears the footer insight.
            if name and y + 148 + 28 <= body_bottom:
                draw.text((cx, y + 148), name, font=font(28, bold=False), fill=MUTE)
            footer_insight(2)
        else:
            # Text/fact card: the insight is the hero — render it large in the body.
            if insight:
                f_body = font(34, bold=False)
                allw = _wrap(draw, insight, f_body, cw)
                max_lines = max(1, int((panel_bottom - y) // 46))
                lines = allw[:max_lines]
                if lines and len(allw) > max_lines:
                    lines[-1] = lines[-1].rstrip() + "…"
                for ln in lines:
                    draw.text((cx, y), ln, font=f_body, fill=(46, 48, 58))
                    y += 46

        # ── Brand lockup, centred below the panel ──
        f_brand = font(30)
        wordmark, tld = "Generated by weirdstats", ".ai"
        ww = draw.textlength(wordmark, font=f_brand)
        tw = draw.textlength(tld, font=f_brand)
        oct_logo = None
        try:
            op = os.path.join(os.path.dirname(__file__), "assets", "octopus.png")
            raw = Image.open(op).convert("RGBA")
            s = 40 / raw.height
            oct_logo = raw.resize((max(1, int(raw.width * s)), 40), Image.LANCZOS)
        except Exception:
            oct_logo = None
        logo_w = (oct_logo.width + 12) if oct_logo is not None else 0
        total = logo_w + ww + tw
        bx = int((W - total) // 2)
        by = H - 74
        if oct_logo is not None:
            img.paste(oct_logo, (bx, by), oct_logo)
            bx += oct_logo.width + 12
        draw.text((bx, by + 20), wordmark, font=f_brand, fill=INK, anchor="lm")
        draw.text((bx + ww, by + 20), tld, font=f_brand, fill=(0x6C, 0x5C, 0xE7), anchor="lm")

        out = BytesIO()
        img.convert("RGB").save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception as e:
        logger.warning(f"compose_og_image failed: {e}")
        return None


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _wrap(draw, text: str, font, max_w: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ── Dynamic cards sitemap ───────────────────────────────────────────────────

def build_cards_sitemap(cards: list[dict]) -> str:
    urls = []
    for c in cards:
        cid = c.get("id")
        if not cid:
            continue
        lastmod = str(c.get("updatedAt") or "")[:10]
        lm = f"<lastmod>{html.escape(lastmod)}</lastmod>" if re.match(r"\d{4}-\d{2}-\d{2}", lastmod) else ""
        urls.append(
            f"<url><loc>{ORIGIN}/card/{html.escape(str(cid))}</loc>{lm}"
            "<changefreq>weekly</changefreq><priority>0.7</priority></url>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(urls) + "</urlset>"
    )
