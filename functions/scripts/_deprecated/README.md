# Deprecated ops scripts

These scripts are **not maintained** and violate the Roosevelt Master Mold rules:

- Hardcoded user IDs or emails
- Writes to root `admin/` collection (removed)

Use instead:

- `../purgeAllSubscriptions.js` — remove all subscription docs (dry-run / `--execute`)
- `../verifySubscriptionsEmpty.js` — confirm Firestore is clean

Do not run scripts in this folder.
