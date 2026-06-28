"""
Creates the admin Firebase Auth account for nehemyadnk4@gmail.com.
Run once: python3 create_admin.py
"""
import os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import credentials, auth, firestore

key_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "firebase-adminsdk.json")
if not os.path.isabs(key_path):
    key_path = str(Path(__file__).parent / key_path)

if not firebase_admin._apps:
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        "projectId": os.getenv("FIREBASE_PROJECT_ID", "weirdstatsai-aaaf7"),
    })

ADMIN_EMAIL    = "nehemyadnk4@gmail.com"
ADMIN_PASSWORD = "WeirdStats@2025!"          # change after first login
ADMIN_NAME     = "Nehemiah Maddela"

db = firestore.client()

try:
    # Try to get existing user
    user = auth.get_user_by_email(ADMIN_EMAIL)
    print(f"User already exists: {user.uid}")
    # Update password just in case
    auth.update_user(user.uid, password=ADMIN_PASSWORD, display_name=ADMIN_NAME)
    print("Password and display name updated.")
except auth.UserNotFoundError:
    user = auth.create_user(
        email=ADMIN_EMAIL,
        password=ADMIN_PASSWORD,
        display_name=ADMIN_NAME,
        email_verified=True,
    )
    print(f"Admin user created: {user.uid}")

# Save to Firestore users collection
db.collection("users").document(user.uid).set({
    "uid": user.uid,
    "name": ADMIN_NAME,
    "email": ADMIN_EMAIL,
    "plan": {"id": "admin", "name": "Admin", "type": "pro"},
    "isAdmin": True,
}, merge=True)

print(f"\n✓ Admin account ready:")
print(f"  Email:    {ADMIN_EMAIL}")
print(f"  Password: {ADMIN_PASSWORD}")
print(f"  UID:      {user.uid}")
print(f"\nChange your password after first login.")
