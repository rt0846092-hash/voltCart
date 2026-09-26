#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Staff account from ADMIN_EMAIL / ADMIN_PASSWORD, only if it doesn't exist yet
python manage.py ensure_admin

# Sample products for the demo. Does nothing once products exist.
if [ "${SEED_STORE:-False}" = "True" ]; then
  python manage.py seed_store
fi
