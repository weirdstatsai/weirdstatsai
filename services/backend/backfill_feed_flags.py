"""
One-time backfill for the curated-feed flags (showOnHome / showOnExplore).

Why: the Home and Explore feeds now query `showOnHome == true` and
`showOnExplore == true` (see weird-stats-app home.page.ts / explore.page.ts).
Existing production cards predate these fields, so BOTH feeds go empty on deploy
until this runs. This maps the old signals onto the new flags:

  - Home:    every card with `homeFeatured == true`  ->  showOnHome = true
             (also stamps homeAddedAt if missing, for the admin-panel sort)
  - Explore: (optional, --explore) every `publishStatus == 'published'` card
             ->  showOnExplore = true. This preserves the OLD "all published
             cards are on Explore" behaviour. OMIT it if you'd rather start
             Explore from an empty, hand-curated slate (the new intended model).

Dry-run by default — prints what it WOULD change. Pass --apply to write.

  python3 backfill_feed_flags.py                 # dry-run, Home only
  python3 backfill_feed_flags.py --apply          # write Home flags
  python3 backfill_feed_flags.py --explore --apply  # also seed Explore from published

Uses the Admin SDK (bypasses Firestore rules), same credentials as the backend.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, firestore

APPLY = "--apply" in sys.argv
DO_EXPLORE = "--explore" in sys.argv

key_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "firebase-adminsdk.json")
if not os.path.isabs(key_path):
    key_path = str(Path(__file__).parent / key_path)

if not firebase_admin._apps:
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        "projectId": os.getenv("FIREBASE_PROJECT_ID", "weirdstats-ai"),
    })

db = firestore.client()
stats = db.collection("stats")


def backfill(query, field, extra_when_missing=None):
    """Set `field` = True on every doc matched by `query` that doesn't already
    have it. `extra_when_missing` is a dict of additional fields to set only if
    absent (e.g. homeAddedAt)."""
    changed = 0
    for snap in query.stream():
        d = snap.to_dict() or {}
        if d.get(field) is True:
            continue
        patch = {field: True}
        for k, v in (extra_when_missing or {}).items():
            if not d.get(k):
                patch[k] = v
        changed += 1
        print(f"  {'WRITE' if APPLY else 'would set'} {snap.id}: {patch}")
        if APPLY:
            snap.reference.update(patch)
    return changed


now = firestore.SERVER_TIMESTAMP  # only used for homeAddedAt when missing

print(f"== Home backfill (homeFeatured -> showOnHome) {'[APPLY]' if APPLY else '[dry-run]'}")
home_n = backfill(
    stats.where("homeFeatured", "==", True),
    "showOnHome",
    extra_when_missing={"homeAddedAt": now},
)
print(f"  {home_n} card(s) {'updated' if APPLY else 'to update'}\n")

expl_n = 0
if DO_EXPLORE:
    print(f"== Explore backfill (published -> showOnExplore) {'[APPLY]' if APPLY else '[dry-run]'}")
    expl_n = backfill(stats.where("publishStatus", "==", "published"), "showOnExplore")
    print(f"  {expl_n} card(s) {'updated' if APPLY else 'to update'}\n")
else:
    print("== Explore backfill skipped (pass --explore to seed showOnExplore "
          "from all published cards; omit to curate Explore from scratch)\n")

print(f"Done. Home: {home_n}, Explore: {expl_n}. "
      f"{'Changes written.' if APPLY else 'Dry-run — re-run with --apply to write.'}")
