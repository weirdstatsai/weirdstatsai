#!/usr/bin/env python3
"""
Copy ALL Firestore data from the old WeirdStats project to the new one.

Preserves document IDs and nested subcollections, so anything keyed by uid
(e.g. user docs, cards) stays valid after the Auth users are imported with the
same UIDs.

Usage:
    python migrate_firestore.py \
        --src /path/to/old-firebase-adminsdk.json \
        --dst /path/to/new-firebase-adminsdk.json \
        [--dry-run] [--collection stats]

Safe to re-run: writes use set() with merge=False, so it overwrites docs in the
destination with the source copy (idempotent for a one-way migration).
"""
import argparse
import sys

import firebase_admin
from firebase_admin import credentials, firestore


def copy_collection(src_coll, dst_coll, stats, dry_run):
    """Recursively copy a collection (docs + subcollections)."""
    for src_doc in src_coll.stream():
        data = src_doc.to_dict()
        dst_doc = dst_coll.document(src_doc.id)
        path = dst_doc.path
        stats["docs"] += 1
        if dry_run:
            print(f"  [dry-run] would write {path}")
        else:
            dst_doc.set(data)  # full overwrite, preserves id
            print(f"  wrote {path}")
        # Recurse into any subcollections of this document.
        for sub in src_doc.reference.collections():
            copy_collection(sub, dst_doc.collection(sub.id), stats, dry_run)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="source (old) service-account JSON")
    ap.add_argument("--dst", required=True, help="destination (new) service-account JSON")
    ap.add_argument("--collection", help="copy only this top-level collection")
    ap.add_argument("--dry-run", action="store_true", help="list without writing")
    args = ap.parse_args()

    src_app = firebase_admin.initialize_app(
        credentials.Certificate(args.src), name="src"
    )
    dst_app = firebase_admin.initialize_app(
        credentials.Certificate(args.dst), name="dst"
    )
    src_db = firestore.client(src_app)
    dst_db = firestore.client(dst_app)

    print(f"Source:      {src_app.project_id}")
    print(f"Destination: {dst_app.project_id}")
    if args.dry_run:
        print(">>> DRY RUN — no writes <<<")
    print("-" * 50)

    stats = {"docs": 0}
    if args.collection:
        roots = [src_db.collection(args.collection)]
    else:
        roots = list(src_db.collections())

    for coll in roots:
        print(f"Collection: {coll.id}")
        copy_collection(coll, dst_db.collection(coll.id), stats, args.dry_run)

    print("-" * 50)
    verb = "would copy" if args.dry_run else "copied"
    print(f"Done. {verb} {stats['docs']} documents.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
