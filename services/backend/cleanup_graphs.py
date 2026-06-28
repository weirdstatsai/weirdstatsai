"""Targeted cleanup of the `graphs` collection (user-approved):
  1. Delete legacy docs that have no `cardType` (old schema junk).
  2. De-duplicate by title, keeping the most recently created card.

Run: .venv/bin/python cleanup_graphs.py
"""

from dotenv import load_dotenv
load_dotenv()

from app.firestore_client import _get_db


def main():
    db = _get_db()
    if db is None:
        print("No Firestore connection.")
        return

    docs = list(db.collection("graphs").stream())
    print(f"Found {len(docs)} docs total.")

    legacy = 0
    valid = []  # (createdAt, id, title, ref)
    for d in docs:
        data = d.to_dict()
        if not data.get("cardType"):
            d.reference.delete()
            legacy += 1
            continue
        valid.append((data.get("createdAt", ""), d.id, data.get("title", ""), d.reference))

    print(f"Deleted {legacy} legacy (no cardType) docs.")

    # Dedupe by title — keep newest createdAt.
    by_title: dict[str, list] = {}
    for created, did, title, ref in valid:
        by_title.setdefault(title, []).append((created, did, ref))

    dupes = 0
    for title, group in by_title.items():
        if len(group) > 1:
            group.sort(reverse=True)  # newest first
            for _created, _did, ref in group[1:]:
                ref.delete()
                dupes += 1
                print(f"  removed duplicate: {title}")

    print(f"Deleted {dupes} duplicate cards.")
    remaining = len(list(db.collection("graphs").stream()))
    print(f"Remaining: {remaining} clean cards.")


if __name__ == "__main__":
    main()
