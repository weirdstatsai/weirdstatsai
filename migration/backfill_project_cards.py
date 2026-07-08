"""One-off migration: move orphaned import/generated cards into their project.

Some cards created during early builds landed in the user's `stats` collection
without a `projectId`, so they leak into the profile Saved tab instead of
staying inside their project. This assigns them the target project's id.

SAFETY:
- Dry-run by default (MODE=dry): reads only, writes nothing, prints candidates.
- Candidates = cards owned by UID, published/private, with NO projectId and NO
  importFile (i.e. they'd show in Saved). The user's genuinely hand-saved cards
  match this too, so APPLY mode ONLY touches the explicit ids in CARD_IDS —
  never a blanket update.
- APPLY writes projectId (+ importFile marker) to exactly those ids.

Usage:
  MODE=dry   python -m migration.backfill_project_cards      # list candidates
  MODE=apply python -m migration.backfill_project_cards      # write CARD_IDS
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore

UID = os.getenv("MIG_UID", "uvKWDAv4v5ZqLvZBHQWxeKsUnE02")
PROJECT_NAME = os.getenv("MIG_PROJECT_NAME", "niti ayoog")
IMPORT_LABEL = os.getenv("MIG_IMPORT_LABEL", "Annual Report of NITI Aayog 2025-26 (English).pdf")
MODE = os.getenv("MODE", "dry")

# In APPLY mode, ONLY these card ids are written. Fill from the dry-run output
# after confirming they are the import cards (not the original saved cards).
CARD_IDS: list[str] = [s for s in os.getenv("MIG_CARD_IDS", "").split(",") if s]


def main() -> None:
    firebase_admin.initialize_app(
        credentials.ApplicationDefault(), {"projectId": "weirdstats-ai"}
    )
    db = firestore.client()

    # Resolve the target project's id from the user doc.
    user = db.collection("users").document(UID).get().to_dict() or {}
    projects = user.get("projects", [])
    target = next((p for p in projects if p.get("project_name", "").strip().lower()
                   == PROJECT_NAME.strip().lower()), None)
    if not target:
        print(f"!! project named {PROJECT_NAME!r} not found. Projects: "
              f"{[p.get('project_name') for p in projects]}")
        return
    project_id = target["project_id"]
    print(f"target project: {PROJECT_NAME!r} -> {project_id}\n")

    docs = db.collection("stats").where("createdBy", "==", UID).limit(500).get()
    candidates = []
    for d in docs:
        x = d.to_dict()
        if x.get("projectId") or x.get("importFile"):
            continue
        if x.get("publishStatus") not in ("private", "published"):
            continue
        candidates.append((d.id, x))

    print(f"{len(candidates)} card(s) currently showing in Saved "
          f"(no projectId, no importFile):\n")
    candidates.sort(key=lambda t: t[1].get("createdAt", ""))
    for cid, x in candidates:
        title = (x.get("data") or {}).get("title", "")[:48]
        print(f"  {cid}  {x.get('createdAt','')[:19]}  [{x.get('publishStatus')}]  {title}")

    if MODE != "apply":
        print("\n(dry-run — nothing written. Set MODE=apply and MIG_CARD_IDS to migrate.)")
        return

    if not CARD_IDS:
        print("\n!! APPLY mode but MIG_CARD_IDS is empty — refusing blanket update.")
        return

    print(f"\nAPPLY: writing projectId={project_id} to {len(CARD_IDS)} card(s)...")
    batch = db.batch()
    n = 0
    for cid in CARD_IDS:
        ref = db.collection("stats").document(cid)
        batch.update(ref, {"projectId": project_id, "importFile": IMPORT_LABEL})
        n += 1
    batch.commit()
    print(f"done — {n} card(s) moved into {PROJECT_NAME!r}.")


if __name__ == "__main__":
    main()
