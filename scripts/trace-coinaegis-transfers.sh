#!/usr/bin/env bash
set -euo pipefail

BASE="${SCAN_URL:-https://scan.sv-1.global.canton.network.cumberland.io/api/scan}"
OUT="/tmp/coinaegis-bybit"
mkdir -p "$OUT"

KEY="122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3"
PARTY="cryptolegacy-validator-1::${KEY}"

echo "================================================================"
echo "  COINAEGIS TRANSFER DISCOVERY"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Target: $PARTY"
echo "================================================================"

# ── Probe: Which transaction endpoints exist? ──────────────────────────
echo -e "\n--- Probing available endpoints ---"

for EP in "v0/transactions" "v0/transactions/by-party" "v0/activities" "v2/updates" "v0/updates"; do
  HTTP=$(curl -sf -w "%{http_code}" -o /dev/null --max-time 10 \
    -X POST "$BASE/$EP" \
    -H 'Content-Type: application/json' \
    -d '{"page_size": 1}' 2>/dev/null || echo "000")
  echo "  POST $EP → HTTP $HTTP"
done

# Also try GET for transactions
for EP in "v0/transactions" "v0/activities"; do
  HTTP=$(curl -sf -w "%{http_code}" -o /dev/null --max-time 10 \
    "$BASE/$EP?limit=1" 2>/dev/null || echo "000")
  echo "  GET  $EP → HTTP $HTTP"
done

# ── Approach 1: v0/transactions (global, paginated) ───────────────────
echo -e "\n--- Approach 1: v0/transactions (scan for CoinAegis transfers) ---"

# First check what format we get back
curl -sf --max-time 15 -X POST "$BASE/v0/transactions" \
  -H 'Content-Type: application/json' \
  -d '{"page_size": 5, "sort_order": "desc"}' > "$OUT/tx-sample.json" 2>/dev/null || echo '{}' > "$OUT/tx-sample.json"

python3 -c "
import json
d = json.load(open('$OUT/tx-sample.json'))
txns = d.get('transactions', [])
print(f'  Sample: {len(txns)} transactions')
if txns:
    tx = txns[0]
    print(f'  Keys: {list(tx.keys())}')
    print(f'  Type: {tx.get(\"transaction_type\", \"?\")}')
    print(f'  Date: {tx.get(\"date\", \"?\")}')
    if tx.get('transfer'):
        t = tx['transfer']
        print(f'  Transfer sender: {t.get(\"sender\", {}).get(\"party\", \"?\")[:50]}...')
        print(f'  Transfer receivers: {len(t.get(\"receivers\", []))}')
    print(f'  Event ID: {tx.get(\"event_id\", \"?\")}')
    # Check for pagination
    print(f'  Has page_end_event_id field: {\"page_end_event_id\" in tx or \"offset\" in tx}')
    print(f'  Offset: {tx.get(\"offset\", \"none\")}')
" 2>/dev/null || echo "  Error or endpoint unavailable"

# Now paginate through recent transactions looking for CoinAegis key
echo ""
echo "  Scanning recent transactions for CoinAegis party..."

MATCH_FILE="$OUT/coinaegis-transfer-matches.jsonl"
> "$MATCH_FILE"

MAX_PAGES=200
PAGE_END=""
TOTAL_TX=0
TOTAL_MATCHES=0

for ((P=0; P<MAX_PAGES; P++)); do
  if [ -z "$PAGE_END" ]; then
    BODY='{"page_size": 100, "sort_order": "desc"}'
  else
    BODY="{\"page_size\": 100, \"sort_order\": \"desc\", \"page_end_event_id\": \"$PAGE_END\"}"
  fi

  HTTP=$(curl -sf -w "%{http_code}" -o "$OUT/tx-page.json" --max-time 20 \
    -X POST "$BASE/v0/transactions" \
    -H 'Content-Type: application/json' \
    -d "$BODY" 2>/dev/null || echo "000")

  if [ "$HTTP" != "200" ]; then
    echo "  Page $P: HTTP $HTTP — stopping"
    break
  fi

  RESULT=$(COINAEGIS_KEY="$KEY" MATCH_OUT="$MATCH_FILE" python3 -c "
import json, os, sys

key = os.environ['COINAEGIS_KEY']
match_file = os.environ['MATCH_OUT']

d = json.load(open('$OUT/tx-page.json'))
txns = d.get('transactions', [])
if not txns:
    print('DONE|0|0|')
    sys.exit(0)

matches = 0
last_event_id = ''

with open(match_file, 'a') as mf:
    for tx in txns:
        last_event_id = tx.get('event_id') or tx.get('offset') or ''
        tx_type = tx.get('transaction_type', '')

        # Check if CoinAegis key appears anywhere in the transaction
        tx_str = json.dumps(tx)
        if key not in tx_str:
            continue

        if tx_type == 'transfer' and tx.get('transfer'):
            t = tx['transfer']
            sender = t.get('sender', {}).get('party', '')
            sender_amt = t.get('sender', {}).get('input_amulet_amount', '0')

            for r in t.get('receivers', []):
                rparty = r.get('party', '')
                ramt = r.get('amount', '0')
                rname = rparty.split('::')[0] if '::' in rparty else rparty

                is_coinaegis_sender = key in sender
                is_coinaegis_receiver = key in rparty

                if is_coinaegis_sender and not is_coinaegis_receiver:
                    direction = 'OUT'
                elif is_coinaegis_receiver and not is_coinaegis_sender:
                    direction = 'IN'
                else:
                    direction = 'SELF'

                match = {
                    'date': tx.get('date', ''),
                    'direction': direction,
                    'sender': sender.split('::')[0],
                    'sender_full': sender,
                    'receiver': rname,
                    'receiver_full': rparty,
                    'amount': ramt,
                    'round': tx.get('round'),
                }
                mf.write(json.dumps(match) + '\n')
                matches += 1

                print(f'MATCH|{tx.get(\"date\",\"\")}|{direction}|{float(ramt):,.2f} CC|{sender.split(\"::\"[0])[:25]} → {rname[:25]}')

        elif key in tx_str:
            # Non-transfer activity involving CoinAegis
            match = {
                'date': tx.get('date', ''),
                'type': tx_type,
                'direction': 'OTHER',
            }
            mf.write(json.dumps(match) + '\n')
            matches += 1

print(f'PAGE|{len(txns)}|{matches}|{last_event_id}')
" 2>/dev/null || echo "ERROR|0|0|")

  if [[ "$RESULT" == DONE* ]] || [[ "$RESULT" == ERROR* ]]; then
    echo "  Page $P: $RESULT"
    break
  fi

  while IFS= read -r line; do
    if [[ "$line" == MATCH* ]]; then
      IFS='|' read -r _ date dir amt parties <<< "$line"
      echo "  [$dir] $date $amt — $parties"
      TOTAL_MATCHES=$((TOTAL_MATCHES + 1))
    elif [[ "$line" == PAGE* ]]; then
      IFS='|' read -r _ count matches new_end <<< "$line"
      TOTAL_TX=$((TOTAL_TX + count))
      PAGE_END="$new_end"
    fi
  done <<< "$RESULT"

  if [ $((P % 20)) -eq 0 ]; then
    echo "  ... page $P: scanned $TOTAL_TX transactions, $TOTAL_MATCHES matches"
  fi

  # If we've gone past May 15 in desc order, we can stop
  OLDEST=$(python3 -c "
import json
d = json.load(open('$OUT/tx-page.json'))
txns = d.get('transactions', [])
if txns:
    print(txns[-1].get('date', ''))
" 2>/dev/null || echo "")

  if [ -n "$OLDEST" ] && [[ "$OLDEST" < "2026-05-15" ]]; then
    echo "  Reached $OLDEST — past the relevant window, stopping"
    break
  fi
done

echo ""
echo "  Scan complete: $TOTAL_TX transactions, $TOTAL_MATCHES CoinAegis matches"

# ── Summary ────────────────────────────────────────────────────────────
echo -e "\n--- Transfer Summary ---"

if [ -s "$MATCH_FILE" ]; then
  python3 -c "
import json

matches = []
with open('$MATCH_FILE') as f:
    for line in f:
        if line.strip():
            matches.append(json.loads(line))

out_transfers = [m for m in matches if m.get('direction') == 'OUT']
in_transfers = [m for m in matches if m.get('direction') == 'IN']
self_transfers = [m for m in matches if m.get('direction') == 'SELF']
other = [m for m in matches if m.get('direction') == 'OTHER']

print(f'  Total matches: {len(matches)}')
print(f'  Outbound transfers: {len(out_transfers)}')
print(f'  Inbound transfers: {len(in_transfers)}')
print(f'  Self-transfers: {len(self_transfers)}')
print(f'  Other activity: {len(other)}')

if out_transfers:
    total_out = sum(float(t.get('amount', 0)) for t in out_transfers)
    print(f'\n  TOTAL CC TRANSFERRED OUT: {total_out:,.6f} CC')

    by_receiver = {}
    for t in out_transfers:
        r = t.get('receiver', 'unknown')
        by_receiver[r] = by_receiver.get(r, 0) + float(t.get('amount', 0))

    print(f'\n  By receiver (top 20):')
    for r, amt in sorted(by_receiver.items(), key=lambda x: -x[1])[:20]:
        print(f'    {r:<40} {amt:>15,.2f} CC')

    # Time range
    dates = sorted([t['date'] for t in out_transfers if t.get('date')])
    if dates:
        print(f'\n  Transfer date range: {dates[0]} to {dates[-1]}')
else:
    print('  No outbound transfers found')
" 2>/dev/null
else
  echo "  No matches found"
fi

echo -e "\n================================================================"
echo "  Done: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================"
