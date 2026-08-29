#!/bin/bash
cd "$(dirname "$0")"
echo "NexusAI Studio - Starting..."
npm run dev &
SERVER_PID=$!
echo "Waiting for server..."
for i in $(seq 1 30); do curl -s http://localhost:1420 >/dev/null 2>&1 && break; sleep 1; done
# Open in app mode (Linux/Mac)
if command -v google-chrome &>/dev/null; then google-chrome --app=http://localhost:1420 --window-size=1440,960 &
elif command -v chromium-browser &>/dev/null; then chromium-browser --app=http://localhost:1420 --window-size=1440,960 &
elif [ "$(uname)" = "Darwin" ]; then open -a "Google Chrome" --args --app=http://localhost:1420 &
else xdg-open http://localhost:1420 &; fi
echo "NexusAI Studio running at http://localhost:1420"
wait $SERVER_PID
