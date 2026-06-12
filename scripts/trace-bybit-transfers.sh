#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# CoinAegis → ByBit Transfer Tracer
#
# Traces CC transfers from CoinAegis-controlled parties to ByBit and
# other exchanges. Uses multiple approaches since v0/transactions/by-party
# may timeout for high-volume parties.
#
# Run on a VM with Canton Scan API access.
# Results saved to /tmp/coinaegis-bybit/
# ════════════════════════════════════════════════════════════════════════════

# Use Cumberland as default (known healthy from prior investigation)
BASE="${SCAN_URL:-https://scan.sv-1.global.canton.network.cumberland.io/api/scan}"
OUT="/tmp/coinaegis-bybit"
mkdir -p "$OUT"

# CoinAegis key fingerprint (all 44+ parties share this)
KEY="122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3"

# CoinAegis party IDs
PARTY_COINAEGIS="coinaegis::${KEY}"
PARTY_VAULT="coinaegisVault::${KEY}"
PARTY_AEVUM="aevumWallet::${KEY}"
PARTY_CRYPTO="cryptolegacy-validator-1::${KEY}"

# ByBit party ID
PARTY_BYBIT="ByBit-MainNetValidator-1::12202c9fc5180723f14e87c88d316355817dd565afc2a897706a789086c33cd6a095"

# Other exchanges for cross-reference
BINANCE_PREFIX="binance-dp-1"
KUCOIN_PREFIX="kucoin-node-01"
MEXC_PREFIX="mexc-mainNet-01"
OKX_PREFIX="OKX-VALIDATOR"
KRAKEN_PREFIX="kraken-validator-01"

ALL_COINAEGIS=("$PARTY_COINAEGIS" "$PARTY_VAULT" "$PARTY_AEVUM" "$PARTY_CRYPTO")

# Fallback SV endpoints (healthy ones from prior probing)
FALLBACK_ENDPOINTS=(
  "https://scan.sv-1.global.canton.network.cumberland.io/api/scan"
  "https://scan.sv-1.global.canton.network.proofgroup.xyz/api/scan"
  "https://scan.sv-1.global.canton.network.tradeweb.com/api/scan"
  "https://scan.sv-1.global.canton.network.fivenorth.io/api/scan"
  "https://scan.sv.global.canton.network.sv-nodeops.com/api/scan"
)

echo "================================================================"
echo "  COINAEGIS → BYBIT TRANSFER TRACER"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Scan API: $BASE"
echo "  Output:   $OUT"
echo "================================================================"

# ── Step 0: Get current round and ACS snapshot ─────────────────────────

echo -e "\n--- Step 0: Current state ---"
curl -sf "$BASE/v0/round-of-latest-data" > "$OUT/00-latest-round.json"
LATEST_ROUND=$(python3 -c "import json; print(json.load(open('$OUT/00-latest-round.json'))['round'])")
EFFECTIVE_AT=$(python3 -c "import json; print(json.load(open('$OUT/00-latest-round.json'))['effectiveAt'])")
echo "  Latest round: $LATEST_ROUND (effective: $EFFECTIVE_AT)"

# Get ACS snapshot for holdings queries
for MID in 4 3 2 1 0; do
  SNAP=$(curl -sf "$BASE/v0/state/acs/snapshot-timestamp?before=${EFFECTIVE_AT}&migration_id=${MID}" 2>/dev/null || echo '{}')
  RECORD_TIME=$(echo "$SNAP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('record_time',''))" 2>/dev/null || echo "")
  if [ -n "$RECORD_TIME" ]; then
    echo "  ACS snapshot: migration_id=$MID, record_time=$RECORD_TIME"
    break
  fi
done

# ── Step 1: Query ByBit's transaction history ──────────────────────────
# Strategy: Query ByBit as the RECEIVER — its transaction list may be
# smaller/faster than querying CoinAegis's massive history.

echo -e "\n--- Step 1: ByBit transaction history (receiver side) ---"
echo "  Querying transactions for ByBit party..."

# Try each endpoint with a timeout
BYBIT_TX_FOUND=false
for EP in "${FALLBACK_ENDPOINTS[@]}"; do
  EP_NAME=$(echo "$EP" | grep -oP '(?<=network\.)[^/]+')
  echo "  Trying $EP_NAME..."

  HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT/01-bybit-transactions.json" \
    --max-time 60 \
    -X POST "$EP/v0/transactions/by-party" \
    -H 'Content-Type: application/json' \
    -d "{\"party\": \"$PARTY_BYBIT\", \"limit\": 500}" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ] && [ -s "$OUT/01-bybit-transactions.json" ]; then
    echo "  Got response from $EP_NAME (HTTP $HTTP_CODE)"
    BYBIT_TX_FOUND=true

    python3 -c "
import json

d = json.load(open('$OUT/01-bybit-transactions.json'))
txs = d.get('transactions', [])
print(f'  ByBit has {len(txs)} transactions')

key = '$KEY'
coinaegis_transfers = []

for tx in txs:
    tt = tx.get('transaction_type', '')
    if tt == 'transfer' and tx.get('transfer'):
        sender = tx['transfer'].get('sender', {}).get('party', '')
        for r in tx['transfer'].get('receivers', []):
            rparty = r.get('party', '')
            amt = float(r.get('amount', '0'))
            # Check if sender is a CoinAegis party (has their key)
            if key in sender:
                sname = sender.split('::')[0]
                coinaegis_transfers.append({
                    'date': tx.get('date', ''),
                    'sender': sname,
                    'sender_full': sender,
                    'amount': amt
                })
                print(f'  [INBOUND FROM COINAEGIS] {tx.get(\"date\",\"\")} {amt:.6f} CC from {sname}')

total = sum(t['amount'] for t in coinaegis_transfers)
print(f'')
print(f'  TOTAL from CoinAegis entities to ByBit: {total:.6f} CC')
print(f'  Number of transfers: {len(coinaegis_transfers)}')

# Save parsed results
with open('$OUT/01-bybit-coinaegis-transfers.json', 'w') as f:
    json.dump({'total_cc': total, 'count': len(coinaegis_transfers), 'transfers': coinaegis_transfers}, f, indent=2)
" 2>/dev/null || echo "  Error parsing ByBit transactions"
    break
  else
    echo "  $EP_NAME: HTTP $HTTP_CODE or timeout"
  fi
done

if [ "$BYBIT_TX_FOUND" = "false" ]; then
  echo "  WARNING: Could not get ByBit transaction history from any endpoint"
fi

# ── Step 2: Query CoinAegis party transactions (with short timeout) ────
# Try each CoinAegis party — some may have fewer transactions and respond

echo -e "\n--- Step 2: CoinAegis party transactions (30s timeout each) ---"

for P in "${ALL_COINAEGIS[@]}"; do
  NAME="${P%%::*}"
  SAFE_NAME=$(echo "$NAME" | tr -cd '[:alnum:]-_')
  echo -e "\n  Querying: $NAME"

  for EP in "${FALLBACK_ENDPOINTS[@]}"; do
    EP_NAME=$(echo "$EP" | grep -oP '(?<=network\.)[^/]+')

    HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT/02-tx-${SAFE_NAME}.json" \
      --max-time 30 \
      -X POST "$EP/v0/transactions/by-party" \
      -H 'Content-Type: application/json' \
      -d "{\"party\": \"$P\", \"limit\": 500}" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] && [ -s "$OUT/02-tx-${SAFE_NAME}.json" ]; then
      echo "  Got response from $EP_NAME"

      python3 -c "
import json

d = json.load(open('$OUT/02-tx-${SAFE_NAME}.json'))
txs = d.get('transactions', [])
print(f'    {len(txs)} transactions')

key = '$KEY'
transfers_out = []
transfers_in = []
exchange_keywords = {
    'ByBit': 'ByBit',
    'binance': 'Binance',
    'kucoin': 'KuCoin',
    'mexc': 'MEXC',
    'OKX': 'OKX',
    'kraken': 'Kraken',
    'edx': 'EDX',
    'Copper': 'Copper',
    'Cumberland': 'Cumberland'
}

for tx in txs:
    tt = tx.get('transaction_type', '')
    if tt == 'transfer' and tx.get('transfer'):
        sender = tx['transfer'].get('sender', {}).get('party', '')
        is_self_sender = key in sender
        for r in tx['transfer'].get('receivers', []):
            rparty = r.get('party', '')
            amt = float(r.get('amount', '0'))
            is_self_receiver = key in rparty
            rname = rparty.split('::')[0]

            # Identify exchange
            exchange = None
            for kw, ename in exchange_keywords.items():
                if kw.lower() in rparty.lower():
                    exchange = ename
                    break

            if is_self_sender and not is_self_receiver:
                tag = f' [{exchange}]' if exchange else ''
                transfers_out.append({
                    'date': tx.get('date', ''),
                    'to': rname,
                    'to_full': rparty,
                    'amount': amt,
                    'exchange': exchange
                })
                print(f'    [OUT] {tx.get(\"date\",\"\")} {amt:.6f} CC -> {rname}{tag}')
            elif not is_self_sender and is_self_receiver:
                sname = sender.split('::')[0]
                transfers_in.append({
                    'date': tx.get('date', ''),
                    'from': sname,
                    'amount': amt
                })

total_out = sum(t['amount'] for t in transfers_out)
total_in = sum(t['amount'] for t in transfers_in)
print(f'    TOTAL out: {total_out:.6f} CC ({len(transfers_out)} transfers)')
print(f'    TOTAL in: {total_in:.6f} CC ({len(transfers_in)} transfers)')

# Breakdown by exchange
by_exchange = {}
for t in transfers_out:
    dest = t['exchange'] or t['to']
    by_exchange[dest] = by_exchange.get(dest, 0) + t['amount']
if by_exchange:
    print(f'    By destination:')
    for dest, amt in sorted(by_exchange.items(), key=lambda x: -x[1]):
        print(f'      {dest}: {amt:.6f} CC')

with open('$OUT/02-transfers-${SAFE_NAME}.json', 'w') as f:
    json.dump({
        'party': '$NAME',
        'total_out': total_out,
        'total_in': total_in,
        'transfers_out': transfers_out,
        'transfers_in': transfers_in,
        'by_exchange': by_exchange
    }, f, indent=2)
" 2>/dev/null || echo "    Error parsing"
      break
    else
      if [ "$HTTP_CODE" = "000" ]; then
        echo "    $EP_NAME: timeout"
      else
        echo "    $EP_NAME: HTTP $HTTP_CODE"
      fi
    fi
  done
done

# ── Step 3: v2/updates scan for recent transfer activity ───────────────
# Paginate through recent ledger updates looking for transfers involving
# CoinAegis key and exchange parties

echo -e "\n--- Step 3: Recent ledger activity scan (v2/updates) ---"
echo "  Scanning recent updates for CoinAegis transfers..."

# Page through updates
MAX_PAGES=50
AFTER=""
TOTAL_UPDATES=0
MATCHING_EVENTS=0

for ((PAGE=0; PAGE<MAX_PAGES; PAGE++)); do
  if [ -z "$AFTER" ]; then
    BODY='{"page_size": 100}'
  else
    BODY="{\"page_size\": 100, \"after\": $AFTER}"
  fi

  HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT/03-updates-page-${PAGE}.json" \
    --max-time 30 \
    -X POST "$BASE/v2/updates" \
    -H 'Content-Type: application/json' \
    -d "$BODY" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" != "200" ] || [ ! -s "$OUT/03-updates-page-${PAGE}.json" ]; then
    echo "  Page $PAGE: HTTP $HTTP_CODE — stopping"
    break
  fi

  # Parse and check for CoinAegis-related events
  RESULT=$(python3 -c "
import json, sys

d = json.load(open('$OUT/03-updates-page-${PAGE}.json'))
txns = d.get('transactions', [])
if not txns:
    print('DONE')
    sys.exit(0)

key = '$KEY'
bybit_key = '12202c9fc5180723f14e87c88d316355817dd565afc2a897706a789086c33cd6a095'
exchange_keys = {
    bybit_key: 'ByBit',
    'binance': 'Binance',
    'kucoin': 'KuCoin',
    'mexc': 'MEXC',
    'OKX': 'OKX',
}

matches = 0
for tx in txns:
    events = tx.get('events_by_id', {})
    tx_json = json.dumps(tx)

    # Quick check: does this transaction involve the CoinAegis key?
    if key not in tx_json:
        continue

    # Check if it also involves an exchange
    for ek, ename in exchange_keys.items():
        if ek in tx_json:
            matches += 1
            # Extract more details
            update_id = tx.get('update_id', '')
            record_time = tx.get('record_time', '')
            migration_id = tx.get('migration_id', '')
            print(f'MATCH|{record_time}|{ename}|{update_id}|{migration_id}')
            break

# Get the pagination cursor for next page
last = txns[-1]
after_obj = {}
if 'update_id' in last:
    after_obj['update_id'] = last['update_id']
if 'migration_id' in last:
    after_obj['migration_id'] = last['migration_id']
if 'record_time' in last:
    after_obj['record_time'] = last['record_time']

print(f'PAGE_INFO|{len(txns)}|{matches}|{json.dumps(after_obj)}')
" 2>/dev/null || echo "ERROR")

  if [ "$RESULT" = "DONE" ] || [ "$RESULT" = "ERROR" ]; then
    echo "  Page $PAGE: no more data"
    break
  fi

  # Parse results
  while IFS= read -r line; do
    if [[ "$line" == MATCH* ]]; then
      IFS='|' read -r _ rtime exchange uid mid <<< "$line"
      echo "  [MATCH] $rtime — CoinAegis ↔ $exchange (update: ${uid:0:20}...)"
      MATCHING_EVENTS=$((MATCHING_EVENTS + 1))
    elif [[ "$line" == PAGE_INFO* ]]; then
      IFS='|' read -r _ count matches after_json <<< "$line"
      TOTAL_UPDATES=$((TOTAL_UPDATES + count))
      if [ -n "$after_json" ] && [ "$after_json" != "{}" ]; then
        AFTER="$after_json"
      else
        echo "  Page $PAGE: no pagination cursor — stopping"
        break 2
      fi
    fi
  done <<< "$RESULT"

  # Progress every 10 pages
  if [ $((PAGE % 10)) -eq 0 ] && [ $PAGE -gt 0 ]; then
    echo "  ... scanned $TOTAL_UPDATES updates, $MATCHING_EVENTS matches so far (page $PAGE)"
  fi
done

echo "  Scan complete: $TOTAL_UPDATES updates checked, $MATCHING_EVENTS CoinAegis↔exchange matches"

# ── Step 4: ByBit holdings check ───────────────────────────────────────
# Check ByBit's current holdings to see if CC is still there

echo -e "\n--- Step 4: ByBit current holdings ---"
curl -sf -X POST "$BASE/v0/holdings/summary" \
  -H 'Content-Type: application/json' \
  -d "{
    \"migration_id\": $MID,
    \"record_time\": \"$RECORD_TIME\",
    \"record_time_match\": \"exact\",
    \"owner_party_ids\": [\"$PARTY_BYBIT\"]
  }" > "$OUT/04-bybit-holdings.json"

python3 -c "
import json
d = json.load(open('$OUT/04-bybit-holdings.json'))
summaries = d.get('summaries', [])
if summaries:
    s = summaries[0]
    print(f'  ByBit holdings:')
    print(f'    Total:     {s.get(\"total_coin_holdings\", \"0\")} CC')
    print(f'    Unlocked:  {s.get(\"total_unlocked_coin\", \"0\")} CC')
    print(f'    Locked:    {s.get(\"total_locked_coin\", \"0\")} CC')
    print(f'    Available: {s.get(\"total_available_coin\", \"0\")} CC')
else:
    print('  ByBit: no holdings data returned')
" 2>/dev/null || echo "  Error fetching ByBit holdings"

# ── Step 5: Check other major exchange holdings for CoinAegis key ──────
# Query holdings for Binance, KuCoin, MEXC, OKX, Kraken

echo -e "\n--- Step 5: Other exchange holdings (for reference) ---"

EXCHANGES=(
  "binance-dp-1::12200ddf2f7f82d90289406b3cf65bc7dc62b1e00ec35d0e3218ac6f1e714e5e2455|Binance"
  "kucoin-node-01::1220e3a3cced9ff7d0df8e57cc72e4fba97e21a7fb201f9f3f7c1ad2e59d14a90e0d|KuCoin"
  "mexc-mainNet-01::1220bc0f44e40b49deb9da87f14b0a22f2e7d5a0e64b7b7fc66b5f4e0c93f1a2b3c4|MEXC"
  "OKX-VALIDATOR-2::1220a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2|OKX"
  "kraken-validator-01::12207c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d|Kraken"
)

# These party IDs with keys may not be exact — we need to look them up.
# Instead, query the featured apps list and find exchange FAs

echo "  Checking featured apps for exchange party IDs..."
curl -sf "$BASE/v0/featured-apps" > "$OUT/05-featured-apps.json"

python3 -c "
import json

d = json.load(open('$OUT/05-featured-apps.json'))
fas = d.get('featured_apps', [])

exchange_prefixes = {
    'binance-dp-1': 'Binance',
    'ByBit-MainNetValidator-1': 'ByBit',
    'kucoin-node-01': 'KuCoin',
    'mexc-mainNet-01': 'MEXC',
    'OKX-VALIDATOR-2': 'OKX',
    'kraken-validator-01': 'Kraken',
    'edx-validator-1': 'EDX Markets',
    'Copper': 'Copper',
    'Cumberland': 'Cumberland',
}

found = []
for fa in fas:
    provider = (fa.get('payload') or fa).get('provider', '') if isinstance(fa, dict) else ''
    if not provider:
        provider = fa.get('provider', '') if isinstance(fa, dict) else ''
    pname = provider.split('::')[0]
    for prefix, ename in exchange_prefixes.items():
        if pname.startswith(prefix) or prefix in pname:
            found.append({'exchange': ename, 'party_id': provider, 'name': pname})
            print(f'  [{ename}] {provider}')
            break

with open('$OUT/05-exchange-party-ids.json', 'w') as f:
    json.dump(found, f, indent=2)

print(f'  Found {len(found)} exchange Featured Apps')
" 2>/dev/null || echo "  Error parsing featured apps"

# ── Step 6: Query holdings for each discovered exchange party ──────────

echo -e "\n--- Step 6: Exchange holdings summary ---"

python3 -c "
import json, subprocess, sys

# Load exchange party IDs
try:
    exchanges = json.load(open('$OUT/05-exchange-party-ids.json'))
except:
    print('  No exchange party IDs found')
    sys.exit(0)

base = '$BASE'
mid = $MID
rt = '$RECORD_TIME'

for ex in exchanges:
    pid = ex['party_id']
    ename = ex['exchange']

    try:
        result = subprocess.run(
            ['curl', '-sf', '--max-time', '15', '-X', 'POST',
             f'{base}/v0/holdings/summary',
             '-H', 'Content-Type: application/json',
             '-d', json.dumps({
                 'migration_id': mid,
                 'record_time': rt,
                 'record_time_match': 'exact',
                 'owner_party_ids': [pid]
             })],
            capture_output=True, text=True, timeout=20
        )
        d = json.loads(result.stdout)
        summaries = d.get('summaries', [])
        if summaries:
            s = summaries[0]
            total = s.get('total_coin_holdings', '0')
            print(f'  {ename}: {total} CC total holdings')
        else:
            print(f'  {ename}: no holdings data')
    except Exception as e:
        print(f'  {ename}: error ({e})')
" 2>/dev/null || echo "  Error checking exchange holdings"

# ── Step 7: Direct transfer query — CoinAegis → specific exchanges ─────
# Use v0/transactions/by-party with begin_after_record_time filter
# to limit the query window (May 15 - Jun 1 when most mining happened)

echo -e "\n--- Step 7: Targeted transfer query (May 2026 window) ---"
echo "  Querying CoinAegis transactions with date filter..."

# Try the smaller parties first (less likely to timeout)
for P in "$PARTY_VAULT" "$PARTY_COINAEGIS" "$PARTY_AEVUM" "$PARTY_CRYPTO"; do
  NAME="${P%%::*}"
  SAFE_NAME=$(echo "$NAME" | tr -cd '[:alnum:]-_')
  echo -e "\n  $NAME (with begin_after filter):"

  for EP in "${FALLBACK_ENDPOINTS[@]}"; do
    EP_NAME=$(echo "$EP" | grep -oP '(?<=network\.)[^/]+')

    # Try with begin_after_record_time to limit results
    HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT/07-tx-filtered-${SAFE_NAME}.json" \
      --max-time 45 \
      -X POST "$EP/v0/transactions/by-party" \
      -H 'Content-Type: application/json' \
      -d "{
        \"party\": \"$P\",
        \"limit\": 500,
        \"begin_after_record_time\": \"2026-05-01T00:00:00Z\"
      }" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] && [ -s "$OUT/07-tx-filtered-${SAFE_NAME}.json" ]; then
      echo "    Got response from $EP_NAME"

      python3 -c "
import json

d = json.load(open('$OUT/07-tx-filtered-${SAFE_NAME}.json'))
txs = d.get('transactions', [])
print(f'    {len(txs)} transactions since May 1')

key = '$KEY'
transfers_out = []

for tx in txs:
    tt = tx.get('transaction_type', '')
    if tt == 'transfer' and tx.get('transfer'):
        sender = tx['transfer'].get('sender', {}).get('party', '')
        if key not in sender:
            continue
        for r in tx['transfer'].get('receivers', []):
            rparty = r.get('party', '')
            amt = float(r.get('amount', '0'))
            if key not in rparty:  # Transfer OUT (not self-transfer)
                rname = rparty.split('::')[0]
                is_bybit = 'ByBit' in rparty
                is_exchange = any(x in rparty for x in ['ByBit','binance','kucoin','mexc','OKX','kraken','edx','Copper','Cumberland'])
                tag = ''
                if is_bybit: tag = ' [BYBIT]'
                elif is_exchange: tag = ' [EXCHANGE]'
                transfers_out.append({
                    'date': tx.get('date', ''),
                    'to': rname,
                    'to_full': rparty,
                    'amount': amt,
                    'is_bybit': is_bybit,
                    'is_exchange': is_exchange
                })
                print(f'    [OUT] {tx.get(\"date\",\"\")} {amt:.6f} CC -> {rname}{tag}')

total = sum(t['amount'] for t in transfers_out)
bybit_total = sum(t['amount'] for t in transfers_out if t['is_bybit'])
exchange_total = sum(t['amount'] for t in transfers_out if t['is_exchange'])

print(f'    TOTAL out: {total:.6f} CC ({len(transfers_out)} transfers)')
print(f'    To ByBit: {bybit_total:.6f} CC')
print(f'    To exchanges: {exchange_total:.6f} CC')

# Group by destination
by_dest = {}
for t in transfers_out:
    by_dest[t['to']] = by_dest.get(t['to'], 0) + t['amount']
if by_dest:
    print(f'    By destination:')
    for dest, amt in sorted(by_dest.items(), key=lambda x: -x[1]):
        print(f'      {dest}: {amt:.6f} CC')

with open('$OUT/07-transfers-${SAFE_NAME}.json', 'w') as f:
    json.dump({
        'party': '$NAME',
        'total_out': total,
        'bybit_total': bybit_total,
        'count': len(transfers_out),
        'transfers': transfers_out,
        'by_destination': by_dest
    }, f, indent=2)
" 2>/dev/null || echo "    Error parsing"
      break
    else
      if [ "$HTTP_CODE" = "000" ]; then
        echo "    $EP_NAME: timeout"
      else
        echo "    $EP_NAME: HTTP $HTTP_CODE"
      fi
    fi
  done
done

# ── Summary ────────────────────────────────────────────────────────────

echo -e "\n================================================================"
echo "  SUMMARY"
echo "================================================================"
echo ""
echo "  Output files saved to: $OUT/"
echo "  Key files:"
echo "    01-bybit-coinaegis-transfers.json — ByBit's view of CoinAegis transfers"
echo "    02-transfers-*.json — Per-party outbound transfers"
echo "    05-exchange-party-ids.json — Exchange party IDs on Canton"
echo "    07-transfers-*.json — May 2026 filtered transfers"
echo ""
echo "  To combine all transfer data:"
echo "    python3 -c \""
echo "import json, glob"
echo "total = 0"
echo "for f in glob.glob('$OUT/07-transfers-*.json'):"
echo "    d = json.load(open(f))"
echo "    total += d.get('total_out', 0)"
echo "    print(f'{d[\"party\"]}: {d[\"total_out\"]:.2f} CC out')"
echo "print(f'TOTAL: {total:.2f} CC')"
echo "\""
echo ""
echo "  Done: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================"
