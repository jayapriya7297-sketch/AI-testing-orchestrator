#!/bin/sh
# POSTs a sample failure payload to the n8n webhook, to test the workflow without breaking a test.
# Usage: scripts/send-test-failure.sh [few|mass] [webhook URL]
#   few  (default): 2 failures + 1 unexpected pass → 2 Bugs + 1 Task
#   mass:           7 failures + 1 unexpected pass → 1 mass Bug + 1 Task
# URL default: the production webhook (workflow active). While "Listen for test event" is on in
# the editor, pass http://localhost:5678/webhook-test/test-failure instead.
# Fixed test ids: sending the same sample again takes the "repeat" path (comments, no new issues).
set -eu
cd "$(dirname "$0")/.."

case "${1:-few}" in
  few) sample=n8n/samples/few-failures.json ;;
  mass) sample=n8n/samples/mass-failure.json ;;
  *) echo "usage: $0 [few|mass] [webhook URL]" >&2; exit 2 ;;
esac
url=${2:-http://localhost:5678/webhook/test-failure}

echo "send-test-failure: POST $sample to $url"
status=$(curl -sS -o /dev/stderr -w '%{http_code}' --max-time 20 \
  -H 'Content-Type: application/json' --data @"$sample" "$url")
echo
echo "send-test-failure: HTTP $status"
[ "$status" -ge 200 ] && [ "$status" -lt 300 ]
