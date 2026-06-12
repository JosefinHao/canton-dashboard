#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# CoinAegis → Exchange Transfer Tracer (v2)
#
# Uses v2/updates with correct pagination to scan ledger activity
# for transfers between CoinAegis parties and exchanges.
#
# The v0/transactions/by-party endpoint returns 404 on all SVs,
# so this script relies on v2/updates pagination instead.
#
# Run on a VM with Canton Scan API access.
# Results saved to /tmp/coinaegis-bybit/
# ════════════════════════════════════════════════════════════════════════════

BASE="${SCAN_URL:-https://scan.sv-1.global.canton.network.cumberland.io/api/scan}"
OUT="/tmp/coinaegis-bybit"
mkdir -p "$OUT"

KEY="122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3"

# ByBit party ID
PARTY_BYBIT="ByBit-MainNetValidator-1::12202c9fc5180723f14e87c88d316355817dd565afc2a897706a789086c33cd6a095"

echo "================================================================"
echo "  COINAEGIS TRANSFER TRACER v2"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Scan API: $BASE"
echo "  Output:   $OUT"
echo "================================================================"

# ── Step 0: Current state ─────────────────────────────────────────────
echo -e "\n--- Step 0: Current state ---"
curl -sf "$BASE/v0/round-of-latest-data" > "$OUT/00-latest-round.json"
python3 -c "
import json
d = json.load(open('$OUT/00-latest-round.json'))
print(f'  Latest round: {d[\"round\"]} (effective: {d[\"effectiveAt\"]})')
"

# ── Step 1: v2/updates scan with correct pagination ────────────────────
# Scan backwards from recent time looking for CoinAegis transfer activity.
# The after param format is: {"after_migration_id": N, "after_record_time": "..."}

echo -e "\n--- Step 1: Ledger scan via v2/updates (starting May 25, 2026) ---"
echo "  Jumping to May 25, 2026 (just before wallet sweeps on May 27-29)..."

MAX_PAGES=500
PAGE=0
AFTER_MIG="4"
AFTER_TIME="2026-05-25T00:00:00Z"
TOTAL_UPDATES=0
MATCH_FILE="$OUT/v2-transfer-matches.jsonl"
> "$MATCH_FILE"

while [ $PAGE -lt $MAX_PAGES ]; do
  # Build request body — always use after cursor (starting from May 2026)
  BODY="{\"page_size\": 100, \"after\": {\"after_migration_id\": $AFTER_MIG, \"after_record_time\": \"$AFTER_TIME\"}}"

  RESP_FILE="$OUT/v2-page-${PAGE}.json"
  HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$RESP_FILE" \
    --max-time 30 \
    -X POST "$BASE/v2/updates" \
    -H 'Content-Type: application/json' \
    -d "$BODY" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" != "200" ] || [ ! -s "$RESP_FILE" ]; then
    echo "  Page $PAGE: HTTP $HTTP_CODE — stopping pagination"
    break
  fi

  # Parse page and look for CoinAegis↔exchange transfers
  RESULT=$(PAGE_NUM=$PAGE COINAEGIS_KEY="$KEY" OUT_DIR="$OUT" python3 -c "
import json, sys, os

page = int(os.environ.get('PAGE_NUM', '0'))
key = os.environ['COINAEGIS_KEY']
out_dir = os.environ['OUT_DIR']
bybit_key = '12202c9fc5180723f14e87c88d316355817dd565afc2a897706a789086c33cd6a095'

exchange_keys = {
    bybit_key: 'ByBit',
    '12206a8a77e900f10dbaa57e4741f2d50d9318dd87e40f8dbf28f7ec4da657bb27b4': 'Binance',
    '1220a9f52878b918c523d04b7b77fde73b39ba9842292e88bf2e7ce3b86eb25a3978': 'KuCoin',
    '12200e0228fa4b2652d5364068ed4e518bfb20e8be9ca062397bd068c8b2817fc5c7': 'MEXC',
    '1220cee0952e1990834afe7d07ad60c02bb55f0b389b82f14753d76e283d3610577d': 'OKX',
    '12201a93a967d6aa33310fb8b15a5b92a69ff48b7f326f20a26622a56a0ccea4168a': 'Kraken',
    '1220a195571be41cc06440b9ea0ca30a137636d824fc1bd37ea62376ccc5a80e6a83': 'EDX',
}

try:
    d = json.load(open(f'{out_dir}/v2-page-{page}.json'))
except:
    print('ERROR|parse_failed')
    sys.exit(0)

txns = d.get('transactions', [])
if not txns:
    print('DONE|0|0')
    sys.exit(0)

matches = 0
with open(f'{out_dir}/v2-transfer-matches.jsonl', 'a') as match_file:
    for tx in txns:
        tx_str = json.dumps(tx)
        if key not in tx_str:
            continue
        for ekey, ename in exchange_keys.items():
            if ekey in tx_str:
                matches += 1
                record_time = tx.get('record_time', '')
                migration_id = tx.get('migration_id', '')
                inner = tx.get('transaction') or tx.get('reassignment') or tx
                events = inner.get('events_by_id') or inner.get('eventsById') or {}
                amounts = []
                for eid, ev in events.items():
                    ca = ev.get('create_arguments') or ev.get('createArguments') or {}
                    amt = ca.get('amount') or ca.get('initialAmount')
                    if amt:
                        if isinstance(amt, dict):
                            amt = amt.get('initialAmount') or amt.get('amount', '0')
                        amounts.append(str(amt))
                match_data = {
                    'record_time': record_time,
                    'exchange': ename,
                    'migration_id': migration_id,
                    'amounts': amounts,
                    'event_count': len(events),
                }
                match_file.write(json.dumps(match_data) + '\n')
                amt_str = ', '.join(amounts[:3]) if amounts else '?'
                print(f'MATCH|{record_time}|{ename}|{len(events)} events|amounts: {amt_str}')
                break

last = txns[-1]
last_mid = last.get('migration_id', 0)
last_rt = last.get('record_time', '')
print(f'PAGE|{len(txns)}|{matches}|{last_mid}|{last_rt}')
" 2>/dev/null || echo "ERROR|python_failed")

  if [[ "$RESULT" == DONE* ]] || [[ "$RESULT" == ERROR* ]]; then
    echo "  Page $PAGE: $RESULT — stopping"
    break
  fi

  # Parse matches and pagination
  while IFS= read -r line; do
    if [[ "$line" == MATCH* ]]; then
      IFS='|' read -r _ rtime exchange details amounts <<< "$line"
      echo "  [MATCH] $rtime — CoinAegis ↔ $exchange ($details, $amounts)"
    elif [[ "$line" == PAGE* ]]; then
      IFS='|' read -r _ count matches new_mid new_rt <<< "$line"
      TOTAL_UPDATES=$((TOTAL_UPDATES + count))
      AFTER_MIG="$new_mid"
      AFTER_TIME="$new_rt"
    fi
  done <<< "$RESULT"

  # Progress every 10 pages
  if [ $((PAGE % 10)) -eq 0 ]; then
    echo "  ... page $PAGE: scanned $TOTAL_UPDATES updates so far (cursor at $AFTER_TIME)"
  fi

  PAGE=$((PAGE + 1))

  # Clean up intermediate files (keep only last 2)
  if [ $PAGE -gt 2 ]; then
    rm -f "$OUT/v2-page-$((PAGE - 3)).json" 2>/dev/null || true
  fi
done

echo "  Scan complete: $TOTAL_UPDATES updates checked across $PAGE pages"

# Count matches
if [ -f "$MATCH_FILE" ]; then
  MATCH_COUNT=$(wc -l < "$MATCH_FILE")
  echo "  CoinAegis ↔ exchange matches: $MATCH_COUNT"
fi

# ── Step 2: Summarize transfer matches ─────────────────────────────────

echo -e "\n--- Step 2: Transfer match summary ---"

if [ -f "$MATCH_FILE" ] && [ -s "$MATCH_FILE" ]; then
  python3 -c "
import json

matches = []
with open('$MATCH_FILE') as f:
    for line in f:
        line = line.strip()
        if line:
            matches.append(json.loads(line))

print(f'  Total matches: {len(matches)}')

by_exchange = {}
for m in matches:
    ex = m['exchange']
    by_exchange[ex] = by_exchange.get(ex, 0) + 1

print(f'  By exchange:')
for ex, count in sorted(by_exchange.items(), key=lambda x: -x[1]):
    print(f'    {ex}: {count} transactions')

# Sort by time
matches.sort(key=lambda x: x.get('record_time', ''))
if matches:
    print(f'  Time range: {matches[0][\"record_time\"]} to {matches[-1][\"record_time\"]}')
" 2>/dev/null
else
  echo "  No CoinAegis ↔ exchange matches found in scanned window"
fi

# ── Step 3: Exchange holdings (already collected) ──────────────────────

echo -e "\n--- Step 3: Exchange holdings (from prior run) ---"
if [ -f "$OUT/04-bybit-holdings.json" ]; then
  echo "  (Using cached holdings data)"
  python3 -c "
import json
d = json.load(open('$OUT/04-bybit-holdings.json'))
s = d.get('summaries', [{}])[0]
print(f'  ByBit: {s.get(\"total_coin_holdings\", \"0\")} CC')
" 2>/dev/null
else
  echo "  Run trace-bybit-transfers.sh first for holdings data"
fi

# ── Step 4: (Merged into Step 1 — scan starts from May 2026 directly) ──
echo -e "\n--- Step 4: Skipped (covered by Step 1) ---"

# ── Step 5: Try v0/updates endpoint as alternative ─────────────────────

echo -e "\n--- Step 5: Try v0/updates endpoint ---"

HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT/v0-updates-test.json" \
  --max-time 15 \
  -X POST "$BASE/v0/updates" \
  -H 'Content-Type: application/json' \
  -d '{"page_size": 10}' 2>/dev/null || echo "000")

echo "  v0/updates: HTTP $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "  v0/updates is available — can use as alternative"
  python3 -c "
import json
d = json.load(open('$OUT/v0-updates-test.json'))
txns = d.get('transactions', [])
print(f'  Sample: {len(txns)} updates returned')
if txns:
    print(f'  First record_time: {txns[0].get(\"record_time\", \"?\")}')
" 2>/dev/null
fi

# ── Step 6: Try v0/activities endpoint ─────────────────────────────────

echo -e "\n--- Step 6: Try v0/activities endpoint ---"

HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT/v0-activities-test.json" \
  --max-time 15 \
  -X POST "$BASE/v0/activities" \
  -H 'Content-Type: application/json' \
  -d '{"page_size": 10}' 2>/dev/null || echo "000")

echo "  v0/activities: HTTP $HTTP_CODE"

# ── Summary ────────────────────────────────────────────────────────────

echo -e "\n================================================================"
echo "  RESULTS SUMMARY"
echo "================================================================"
echo ""
echo "  Endpoint availability:"
echo "    v0/transactions/by-party: 404 (not available)"
echo "    v2/updates:               (check above)"
echo "    v0/updates:               HTTP $(cat /dev/null && echo "$HTTP_CODE" || echo "?")"
echo "    v0/activities:            (check above)"
echo ""
echo "  Exchange holdings (from Canton Scan):"
echo "    ByBit:    279,009.37 CC"
echo "    MEXC:     1,316,554.76 CC"
echo "    OKX:      332,924.50 CC"
echo "    Kraken:   250,658.05 CC"
echo "    Binance:  2,013.03 CC"
echo "    KuCoin:   7,504.06 CC"
echo "    Cumberland: 10,000.00 CC"
echo ""
echo "  Output: $OUT/"
echo "  Matches: $MATCH_FILE"
echo "  Done: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================"
