#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

PIDS=()

cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  sleep 1
  for pid in "${PIDS[@]}"; do
    kill -9 "$pid" 2>/dev/null
  done
  exit 0
}
trap cleanup INT TERM

echo "Starting Convex backend..."
(cd "$ROOT" && npx convex dev) &
PIDS+=($!)

echo "Starting Mastra agent server..."
(cd "$ROOT/mastra" && npx mastra dev) &
PIDS+=($!)

echo "Starting ngrok tunnel to Mastra (port 4111)..."
(ngrok http 4111 --log=stdout | grep --line-buffered "url=" | while IFS= read -r line; do
  URL=$(echo "$line" | grep -o 'https://[^ ]*')
  if [ -n "$URL" ]; then
    echo ""
    echo "  ngrok tunnel: $URL"
    echo "  Wire it up:   npx convex env set MASTRA_URL $URL/mastra"
    echo ""
  fi
done) &
PIDS+=($!)

echo "Starting frontend..."
(cd "$ROOT" && npm run dev) &
PIDS+=($!)

(sleep 4 && open -a "Google Chrome" http://localhost:5173) &
PIDS+=($!)

echo ""
echo "All services starting:"
echo "  Convex   — http://localhost:3210"
echo "  Mastra   — http://localhost:4111"
echo "  Frontend — http://localhost:5173"
echo "  ngrok    — tunneling port 4111 (URL printed above once ready)"
echo ""
echo "Press Ctrl+C to stop all."

wait