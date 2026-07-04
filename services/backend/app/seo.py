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

ORIGIN = "https://weirdstats-ai.web.app"
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
    image = f"{ORIGIN}/og/card/{card_id}.png"

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


def compose_og_image(doc: Optional[dict]) -> Optional[bytes]:
    """Render a branded 1200x630 PNG from the card's data. Returns None on any
    problem so the route can fall back to the default image."""
    card = (doc or {}).get("data") or {}
    if not card:
        return None
    try:
        from io import BytesIO
        from PIL import Image, ImageDraw, ImageFont

        W, H = 1200, 630
        # brand gradient (purple -> blue), vertical
        top, bot = (0x7B, 0x6B, 0xEF), (0x42, 0x85, 0xD6)
        img = Image.new("RGB", (W, H), top)
        px = img.load()
        for y in range(H):
            t = y / (H - 1)
            r = int(top[0] + (bot[0] - top[0]) * t)
            g = int(top[1] + (bot[1] - top[1]) * t)
            b = int(top[2] + (bot[2] - top[2]) * t)
            for x in range(W):
                px[x, y] = (r, g, b)
        draw = ImageDraw.Draw(img)

        def font(size: int):
            for p in _FONT_PATHS:
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    continue
            raise RuntimeError("no scalable font available")

        f_brand = font(34)
        f_title = font(66)
        f_row = font(38)
        f_foot = font(28)

        white = (255, 255, 255)
        soft = (255, 255, 255)

        # brand lockup — octopus logo + wordmark
        oct_logo = None
        try:
            op = os.path.join(os.path.dirname(__file__), "assets", "octopus.png")
            raw = Image.open(op).convert("RGBA")
            s = 58 / raw.height
            oct_logo = raw.resize((max(1, int(raw.width * s)), 58), Image.LANCZOS)
        except Exception:
            oct_logo = None
        if oct_logo is not None:
            img.paste(oct_logo, (80, 56), oct_logo)
            draw.text((80 + oct_logo.width + 16, 68), "WeirdStats.ai", font=f_brand, fill=white)
        else:
            draw.text((80, 70), "WeirdStats.ai", font=f_brand, fill=white)

        # title (wrapped, up to 3 lines)
        plain = _plain_title(card) or "A weird stat"
        lines = _wrap(draw, plain, f_title, W - 160)[:3]
        y = 150
        for ln in lines:
            draw.text((80, y), ln, font=f_title, fill=white)
            y += 82

        # body: rows as bars, or big KPI number
        rows = card.get("rows") or []
        metric = card.get("metric") or {}
        y = max(y + 20, 380)
        if rows:
            top_rows = rows[:4]
            mx = max([_num(r.get("value")) for r in top_rows] + [1])
            for r in top_rows:
                label = str(r.get("label") or "")[:28]
                val = _fmt_num(r.get("value"))
                unit = str(r.get("unit") or "")
                draw.text((80, y), label, font=f_row, fill=soft)
                # bar
                bar_x, bar_w, bar_h = 80, W - 360, 14
                frac = max(0.04, _num(r.get("value")) / mx)
                draw.rounded_rectangle([bar_x, y + 48, bar_x + bar_w, y + 48 + bar_h],
                                       radius=7, fill=(255, 255, 255, 60))
                draw.rounded_rectangle([bar_x, y + 48, bar_x + int(bar_w * frac), y + 48 + bar_h],
                                       radius=7, fill=white)
                draw.text((W - 250, y), f"{val} {unit}".strip(), font=f_row, fill=white)
                y += 78
        elif metric.get("value") is not None:
            big = font(150)
            draw.text((80, y), _fmt_num(metric["value"]), font=big, fill=white)
            if metric.get("unit"):
                draw.text((80, y + 165), str(metric["unit"]), font=f_row, fill=soft)

        # footer: insight snippet
        insight = str(card.get("insight") or "").strip()
        if insight:
            foot = _wrap(draw, insight, f_foot, W - 160)[:1]
            if foot:
                draw.text((80, H - 70), foot[0], font=f_foot, fill=(235, 235, 255))

        out = BytesIO()
        img.save(out, format="PNG", optimize=True)
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
