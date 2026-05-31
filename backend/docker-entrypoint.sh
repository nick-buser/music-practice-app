#!/usr/bin/env sh
set -e

# Apply migrations before serving. Fine for a single-instance homelab deploy;
# revisit (e.g. a dedicated migration job) if you ever run multiple replicas.
alembic upgrade head

exec "$@"
