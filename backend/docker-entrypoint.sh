#!/usr/bin/env sh
set -e

# Apply migrations before serving. Fine for a single-instance homelab deploy;
# revisit (e.g. a dedicated migration job) if you ever run multiple replicas.
# RUN_MIGRATIONS=0 skips this (e.g. a k8s Job runs migrations separately);
# defaults to "1" so the existing docker-compose flow is unchanged.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    alembic upgrade head
fi

exec "$@"
