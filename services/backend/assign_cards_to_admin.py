"""
Reassigns all seed/anonymous cards to the admin user.
Cards become private drafts in the admin's Profile.
Run: python3 assign_cards_to_admin.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, firestore, auth

key_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "firebase-adminsdk.json")
if not os.path.isabs(key_path):
    key_path = str(Path(__file__).parent / key_path)

if not firebase_admin._apps:
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        "projectId": os.getenv("FIREBASE_PROJECT_ID", "weirdstatsai-aaaf7"),
    })

ADMIN_EMAIL = "nehemyadnk4@gmail.com"
ADMIN_NAME  = "Nehemiah Maddela"

db = firestore.client()

# Get admin UID
admin_user = auth.get_user_by_email(ADMIN_EMAIL)
admin_uid  = admin_user.uid
print(f"Admin UID: {admin_uid}")

# Find all cards not yet owned by admin
stats_ref = db.collection("stats")
all_docs  = stats_ref.stream()

updated = 0
skipped = 0

for doc in all_docs:
    data = doc.to_dict()
    current_owner = data.get("createdBy", "")

    # Skip if already owned by admin
    if current_owner == admin_uid:
        skipped += 1
        continue

    # Reassign to admin as a draft
    stats_ref.document(doc.id).update({
        "createdBy":     admin_uid,
        "createdByName": ADMIN_NAME,
        "publishStatus": "draft",      # private — won't show on Explore
    })
    print(f"  ✓ Moved → {data.get('data', {}).get('title', doc.id)[:50]}")
    updated += 1

print(f"\nDone. Moved {updated} cards to admin profile. Skipped {skipped} already-owned.")
print("Explore is now empty. Go to Profile → Published tab to publish cards back to Explore.")
