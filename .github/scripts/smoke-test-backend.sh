#!/usr/bin/env bash
# Smoke test for a built smo-backend image: starts it against a throwaway PostGIS and
# checks that it boots, migrates, resolves its services and serves HTTP + SignalR.
#
# Catches failures that only show up when the real image starts, e.g. a base image
# whose .NET runtime doesn't match <TargetFramework> (the .NET 11 bump in #807), a
# migration that doesn't apply, or a DI/route/hub registration error.
# Doesn't depend on the SimRail API being reachable.
#
# Usage: bash .github/scripts/smoke-test-backend.sh <image>
set -euo pipefail

IMAGE="${1:?usage: $0 <image>}"
NAME="smo-smoke-${GITHUB_RUN_ID:-local}-$$"
failures=0

cleanup() {
  docker rm -f "$NAME-app" "$NAME-db" >/dev/null 2>&1 || true
  docker network rm "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*"
  echo "----- app logs -----"
  docker logs "$NAME-app" 2>&1 | tail -60 || true
  exit 1
}

echo "Starting PostGIS..."
docker network create "$NAME" >/dev/null
docker run -d --name "$NAME-db" --network "$NAME" --network-alias db \
  -e POSTGRES_USER=smo -e POSTGRES_PASSWORD=smoke -e POSTGRES_DB=smo \
  postgis/postgis:16-3.4 >/dev/null
for _ in $(seq 1 60); do
  # the image restarts postgres once after init scripts (PostGIS), so require a real query
  docker exec -e PGPASSWORD=smoke "$NAME-db" psql -h localhost -U smo -d smo -c "SELECT PostGIS_Version()" >/dev/null 2>&1 && break
  sleep 2
done
docker exec -e PGPASSWORD=smoke "$NAME-db" psql -h localhost -U smo -d smo -c "SELECT PostGIS_Version()" >/dev/null 2>&1 \
  || fail "PostGIS did not start"

echo "Starting $IMAGE..."
# Sentry is disabled so smoke runs don't report to the production project.
docker run -d --name "$NAME-app" --network "$NAME" \
  -e DATABASE_URL="Host=db;Port=5432;Database=smo;Username=smo;Password=smoke" \
  -e Sentry__Dsn= -e Sentry__Enabled=false \
  "$IMAGE" >/dev/null

# Requests run inside the app container (the image ships curl), so no host ports are needed.
request() { # method path -> "<status> <content-type>"
  docker exec "$NAME-app" curl -s -o /dev/null -X "$1" -w "%{http_code} %{content_type}" "http://localhost:3000$2"
}

for _ in $(seq 1 90); do
  [ "$(docker inspect -f '{{.State.Running}}' "$NAME-app")" = true ] || fail "container exited during startup"
  [ "$(request GET /health 2>/dev/null | cut -d' ' -f1)" = 200 ] && break
  sleep 2
done
[ "$(request GET /health | cut -d' ' -f1)" = 200 ] || fail "/health did not return 200 within 180s"
echo "Started: runtime launched, migrations applied, /health is 200"

expect() { # method path "<allowed statuses>" content-type [note]
  local got status type
  got=$(request "$1" "$2"); status=${got%% *}; type=${got#* }
  if [[ " $3 " == *" $status "* ]] && [[ "$type" == "$4"* ]]; then
    printf "  ok    %-5s %-38s %s %s\n" "$1" "$2" "$status" "${5:-}"
  else
    printf "  FAIL  %-5s %-38s got %s (%s), want %s %s\n" "$1" "$2" "$status" "$type" "$3" "$4"
    failures=$((failures + 1))
  fi
}

echo "Checking endpoints:"
expect GET  /health                                 "200"     text/plain       "(database check)"
expect GET  /status                                 "200"     application/json "(controller + its 11 services resolve)"
expect GET  /status/route-lines                     "200"     application/json "(EF + PostGIS query)"
expect GET  /status/known-stations                  "200"     application/json
expect GET  /status/restarts/next                   "200 404" application/json "(404 until SimRail data arrives)"
expect GET  /openapi/v1.json                        "200"     application/json "(OpenAPI generation)"
expect POST "/signalr/negotiate?negotiateVersion=1" "200"     application/json "(SignalR hub mapped)"
expect GET  /does-not-exist                         "404"     ""               "(unknown route)"

[ "$(docker inspect -f '{{.State.Running}}' "$NAME-app")" = true ] || fail "container crashed while handling requests"
crit=$(docker logs "$NAME-app" 2>&1 | grep -cE "\] crit:|Unhandled exception" || true)
[ "$crit" -eq 0 ] || { failures=$((failures + 1)); echo "  FAIL  $crit critical/unhandled log line(s)"; }
[ "$failures" -eq 0 ] || fail "$failures check(s) failed"
echo "Smoke test passed"
