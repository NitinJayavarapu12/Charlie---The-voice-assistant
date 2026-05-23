#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting ngrok tunnels..."
ngrok start --all --config "$ROOT/ngrok.yml" > /dev/null 2>&1 &
NGROK_PID=$!

# Wait for ngrok API to be ready
echo "Waiting for tunnels to come up..."
for i in $(seq 1 20); do
  sleep 1
  STATUS=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null)
  if [ -n "$STATUS" ]; then break; fi
done

if [ -z "$STATUS" ]; then
  echo "ERROR: ngrok did not start. Check that your authtoken is set."
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

# Extract URLs
BACKEND_URL=$(echo "$STATUS" | python3 -c "
import sys, json
tunnels = json.load(sys.stdin)['tunnels']
for t in tunnels:
    if t['name'] == 'backend' and t['proto'] == 'https':
        print(t['public_url'])
        break
")

FRONTEND_URL=$(echo "$STATUS" | python3 -c "
import sys, json
tunnels = json.load(sys.stdin)['tunnels']
for t in tunnels:
    if t['name'] == 'frontend' and t['proto'] == 'https':
        print(t['public_url'])
        break
")

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
  echo "ERROR: Could not read tunnel URLs from ngrok."
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

echo ""
echo "Tunnels active:"
echo "  Backend  → $BACKEND_URL"
echo "  Frontend → $FRONTEND_URL"
echo ""

# Update frontend/.env
FRONTEND_ENV="$ROOT/frontend/.env"
sed -i '' "s|VITE_API_URL=.*|VITE_API_URL=$BACKEND_URL|" "$FRONTEND_ENV"
echo "Updated frontend/.env → VITE_API_URL=$BACKEND_URL"

# Update backend/.env
BACKEND_ENV="$ROOT/backend/.env"
sed -i '' "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|" "$BACKEND_ENV"
echo "Updated backend/.env → FRONTEND_URL=$FRONTEND_URL"

echo ""
echo "------------------------------------------------------"
echo "Vapi webhook URL (update in Vapi dashboard):"
echo "  $BACKEND_URL/webhooks/vapi"
echo ""
echo "Share this interview link with candidates:"
echo "  $FRONTEND_URL"
echo "------------------------------------------------------"
echo ""
echo "Now restart your backend and frontend servers."
echo "Press Ctrl+C to stop tunnels."

wait $NGROK_PID
