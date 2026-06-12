#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# ByBit & Exchange Holdings Timeline
#
# Checks holdings at multiple timestamps to detect inflows during the
# CoinAegis wallet sweep window (May 27-29, 2026).
#
# If ByBit's balance jumped by ~2.8M CC during that window, it confirms
# CoinAegis transferred proceeds there.
# ════════════════════════════════════════════════════════════════════════════

BASE="${SCAN_URL:-https://scan.sv-1.global.canton.network.cumberland.io/api/scan}"
OUT="/tmp/coinaegis-bybit"
mkdir -p "$OUT"

KEY="122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3"
MID=4

# Exchange party IDs (from prior discovery)
PARTY_BYBIT="ByBit-MainNetValidator-1::12202c9fc5180723f14e87c88d316355817dd565afc2a897706a789086c33cd6a095"
PARTY_BINANCE="binance-dp-1::12206a8a77e900f10dbaa57e4741f2d50d9318dd87e40f8dbf28f7ec4da657bb27b4"
PARTY_KRAKEN="kraken-validator-01::12201a93a967d6aa33310fb8b15a5b92a69ff48b7f326f20a26622a56a0ccea4168a"
PARTY_MEXC="mexc-mainNet-01::12200e0228fa4b2652d5364068ed4e518bfb20e8be9ca062397bd068c8b2817fc5c7"
PARTY_OKX="OKX-VALIDATOR-2::1220cee0952e1990834afe7d07ad60c02bb55f0b389b82f14753d76e283d3610577d"
PARTY_KUCOIN="kucoin-node-01::1220a9f52878b918c523d04b7b77fde73b39ba9842292e88bf2e7ce3b86eb25a3978"
PARTY_CUMBERLAND="Cumberland-GasStation-1::1220987fe52357fc17dc0a3552a691d1e1e685152bbe467acff604503cf301780bcf"

# CoinAegis parties
PARTY_COINAEGIS="coinaegis::${KEY}"
PARTY_VAULT="coinaegisVault::${KEY}"
PARTY_AEVUM="aevumWallet::${KEY}"
PARTY_CRYPTO="cryptolegacy-validator-1::${KEY}"

# Timestamps to check — before, during, and after the sweep window
TIMESTAMPS=(
  "2026-05-15T00:00:00Z"
  "2026-05-20T00:00:00Z"
  "2026-05-25T00:00:00Z"
  "2026-05-26T00:00:00Z"
  "2026-05-27T00:00:00Z"
  "2026-05-27T12:00:00Z"
  "2026-05-28T00:00:00Z"
  "2026-05-28T12:00:00Z"
  "2026-05-29T00:00:00Z"
  "2026-05-29T12:00:00Z"
  "2026-05-30T00:00:00Z"
  "2026-05-31T00:00:00Z"
  "2026-06-01T00:00:00Z"
  "2026-06-01T15:00:00Z"
)

echo "================================================================"
echo "  EXCHANGE HOLDINGS TIMELINE"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Scan API: $BASE"
echo "  Checking ${#TIMESTAMPS[@]} timestamps from May 15 to Jun 1"
echo "================================================================"

# Helper: get ACS snapshot for a given timestamp
get_snapshot() {
  local BEFORE="$1"
  local SNAP
  SNAP=$(curl -sf --max-time 10 "$BASE/v0/state/acs/snapshot-timestamp?before=${BEFORE}&migration_id=${MID}" 2>/dev/null || echo '{}')
  echo "$SNAP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('record_time',''))" 2>/dev/null || echo ""
}

# Helper: get holdings for a party at a record_time
get_holdings() {
  local PARTY="$1"
  local RT="$2"
  curl -sf --max-time 15 -X POST "$BASE/v0/holdings/summary" \
    -H 'Content-Type: application/json' \
    -d "{
      \"migration_id\": $MID,
      \"record_time\": \"$RT\",
      \"record_time_match\": \"exact\",
      \"owner_party_ids\": [\"$PARTY\"]
    }" 2>/dev/null || echo '{}'
}

# ── Step 1: Resolve ACS snapshots for each timestamp ───────────────────

echo -e "\n--- Step 1: Resolving ACS snapshots ---"

declare -a RECORD_TIMES
for TS in "${TIMESTAMPS[@]}"; do
  RT=$(get_snapshot "$TS")
  if [ -n "$RT" ]; then
    RECORD_TIMES+=("$RT")
    echo "  $TS → snapshot: $RT"
  else
    RECORD_TIMES+=("")
    echo "  $TS → no snapshot available"
  fi
done

# ── Step 2: Query ByBit holdings at each snapshot ──────────────────────

echo -e "\n--- Step 2: ByBit holdings timeline ---"
echo ""

BYBIT_CSV="$OUT/bybit-holdings-timeline.csv"
echo "requested_time,snapshot_time,total_holdings,unlocked,locked" > "$BYBIT_CSV"

for i in "${!TIMESTAMPS[@]}"; do
  TS="${TIMESTAMPS[$i]}"
  RT="${RECORD_TIMES[$i]}"

  if [ -z "$RT" ]; then
    echo "  $TS: no snapshot"
    continue
  fi

  RESP=$(get_holdings "$PARTY_BYBIT" "$RT")
  python3 -c "
import json, sys
d = json.loads('$( echo "$RESP" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))" 2>/dev/null || echo "{}" )')
s = (d.get('summaries') or [{}])[0]
total = s.get('total_coin_holdings', '0')
unlocked = s.get('total_unlocked_coin', '0')
locked = s.get('total_locked_coin', '0')
print(f'  $TS: {float(total):>15,.2f} CC (unlocked: {float(unlocked):,.2f}, locked: {float(locked):,.2f})')
print(f'$TS,$RT,{total},{unlocked},{locked}', file=open('$BYBIT_CSV', 'a'))
" 2>/dev/null || echo "  $TS: error"
done

# ── Step 3: Query CoinAegis holdings at each snapshot ──────────────────

echo -e "\n--- Step 3: CoinAegis total holdings timeline ---"
echo ""

CA_CSV="$OUT/coinaegis-holdings-timeline.csv"
echo "requested_time,snapshot_time,crypto_validator,coinaegis,coinaegisVault,aevumWallet,total" > "$CA_CSV"

for i in "${!TIMESTAMPS[@]}"; do
  TS="${TIMESTAMPS[$i]}"
  RT="${RECORD_TIMES[$i]}"

  if [ -z "$RT" ]; then
    echo "  $TS: no snapshot"
    continue
  fi

  # Query all 4 CoinAegis parties in one call
  RESP=$(curl -sf --max-time 15 -X POST "$BASE/v0/holdings/summary" \
    -H 'Content-Type: application/json' \
    -d "{
      \"migration_id\": $MID,
      \"record_time\": \"$RT\",
      \"record_time_match\": \"exact\",
      \"owner_party_ids\": [\"$PARTY_CRYPTO\", \"$PARTY_COINAEGIS\", \"$PARTY_VAULT\", \"$PARTY_AEVUM\"]
    }" 2>/dev/null || echo '{"summaries":[]}')

  COINAEGIS_KEY="$KEY" PARTY_C="$PARTY_CRYPTO" PARTY_A="$PARTY_COINAEGIS" PARTY_V="$PARTY_VAULT" PARTY_W="$PARTY_AEVUM" python3 -c "
import json, sys, os

resp = json.loads('''$(echo "$RESP" | sed "s/'/'\\\\''/g")''')
summaries = resp.get('summaries', [])

key = os.environ['COINAEGIS_KEY']
parties = {
    os.environ['PARTY_C']: 'crypto_validator',
    os.environ['PARTY_A']: 'coinaegis',
    os.environ['PARTY_V']: 'coinaegisVault',
    os.environ['PARTY_W']: 'aevumWallet',
}

holdings = {}
for s in summaries:
    pid = s.get('party', '')
    total = float(s.get('total_coin_holdings', '0'))
    for full_pid, label in parties.items():
        if full_pid == pid or (key in pid and label in pid.lower().replace('-','').replace('_','')):
            holdings[label] = total
            break
    else:
        if key in pid:
            name = pid.split('::')[0]
            holdings[name] = total

cv = holdings.get('crypto_validator', 0)
ca = holdings.get('coinaegis', 0)
vt = holdings.get('coinaegisVault', 0)
aw = holdings.get('aevumWallet', 0)
total = cv + ca + vt + aw

print(f'  $TS: {total:>15,.2f} CC  (validator: {cv:,.2f}, coinaegis: {ca:,.2f}, vault: {vt:,.2f}, aevum: {aw:,.2f})')
" 2>/dev/null || echo "  $TS: error"
done

# ── Step 4: Other exchange holdings at key dates ───────────────────────

echo -e "\n--- Step 4: All exchange holdings at key dates ---"
echo "  Checking May 25 (before), May 29 (after sweep), Jun 1 (now)"
echo ""

KEY_DATES=("2026-05-25T00:00:00Z" "2026-05-29T00:00:00Z" "2026-06-01T15:00:00Z")

declare -A EXCHANGE_PARTIES
EXCHANGE_PARTIES=(
  ["ByBit"]="$PARTY_BYBIT"
  ["Binance"]="$PARTY_BINANCE"
  ["Kraken"]="$PARTY_KRAKEN"
  ["MEXC"]="$PARTY_MEXC"
  ["OKX"]="$PARTY_OKX"
  ["KuCoin"]="$PARTY_KUCOIN"
  ["Cumberland"]="$PARTY_CUMBERLAND"
)

EXCHANGES_CSV="$OUT/exchanges-holdings-timeline.csv"
echo "exchange,date,total_holdings" > "$EXCHANGES_CSV"

for DATE in "${KEY_DATES[@]}"; do
  RT=$(get_snapshot "$DATE")
  if [ -z "$RT" ]; then
    echo "  $DATE: no snapshot"
    continue
  fi

  echo "  === $DATE (snapshot: $RT) ==="

  for ENAME in ByBit Binance Kraken MEXC OKX KuCoin Cumberland; do
    EPID="${EXCHANGE_PARTIES[$ENAME]}"
    RESP=$(get_holdings "$EPID" "$RT")
    TOTAL=$(echo "$RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
s = (d.get('summaries') or [{}])[0]
print(s.get('total_coin_holdings', '0'))
" 2>/dev/null || echo "0")
    printf "    %-12s %15s CC\n" "$ENAME" "$(python3 -c "print(f'{float(\"$TOTAL\"):,.2f}')" 2>/dev/null || echo "$TOTAL")"
    echo "$ENAME,$DATE,$TOTAL" >> "$EXCHANGES_CSV"
  done
  echo ""
done

# ── Summary ────────────────────────────────────────────────────────────

echo "================================================================"
echo "  ANALYSIS"
echo "================================================================"
echo ""
echo "  Compare ByBit holdings BEFORE (May 25) vs AFTER (May 29) the"
echo "  CoinAegis wallet sweep to detect if ~2.8M CC flowed to ByBit."
echo ""
echo "  CSV files for further analysis:"
echo "    $BYBIT_CSV"
echo "    $CA_CSV"
echo "    $EXCHANGES_CSV"
echo ""
echo "  Done: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================"
