#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# CoinAegis Incident Audit — Standalone curl commands
#
# Run on a VM with Canton Scan API access. No Node.js required.
# Results are saved to /tmp/coinaegis-audit/
# ════════════════════════════════════════════════════════════════════════════

BASE="${SCAN_URL:-https://scan.sv-1.global.canton.network.sync.global/api/scan}"
OUT="/tmp/coinaegis-audit"
mkdir -p "$OUT"

KEY="122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3"

# All known party IDs controlled by CoinAegis (same key fingerprint)
PARTY_COINAEGIS="coinaegis::${KEY}"
PARTY_VAULT="coinaegisVault::${KEY}"
PARTY_AEVUM="aevumWallet::${KEY}"
PARTY_CRYPTO="cryptolegacy-validator-1::${KEY}"
PARTY_BYBIT="ByBit-MainNetValidator-1::12202c9fc5180723f14e87c88d316355817dd565afc2a897706a789086c33cd6a095"

ALL_PARTIES=("$PARTY_COINAEGIS" "$PARTY_VAULT" "$PARTY_AEVUM" "$PARTY_CRYPTO")

echo "================================================================"
echo "  COINAEGIS INCIDENT AUDIT"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Scan API: $BASE"
echo "  Output:   $OUT"
echo "================================================================"

# ── Step 1: Health check & current round ──────────────────────────────────

echo -e "\n--- Step 1: Current round ---"
curl -sf "$BASE/v0/round-of-latest-data" | tee "$OUT/01-latest-round.json" | python3 -m json.tool
EFFECTIVE_AT=$(python3 -c "import json; print(json.load(open('$OUT/01-latest-round.json'))['effectiveAt'])")
LATEST_ROUND=$(python3 -c "import json; print(json.load(open('$OUT/01-latest-round.json'))['round'])")
echo "Effective at: $EFFECTIVE_AT"
echo "Latest round: $LATEST_ROUND"

# ── Step 2: ACS snapshot ─────────────────────────────────────────────────

echo -e "\n--- Step 2: ACS snapshot ---"
RECORD_TIME=""
for MID in 4 3 2 1 0; do
  SNAP=$(curl -sf "$BASE/v0/state/acs/snapshot-timestamp?before=$EFFECTIVE_AT&migration_id=$MID" 2>/dev/null || echo '{}')
  RT=$(echo "$SNAP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('record_time',''))" 2>/dev/null || echo "")
  if [ -n "$RT" ]; then
    RECORD_TIME="$RT"
    echo "Migration ID: $MID"
    echo "Record time: $RECORD_TIME"
    echo "$SNAP" > "$OUT/02-snapshot.json"
    break
  fi
done
if [ -z "$RECORD_TIME" ]; then
  echo "ERROR: No usable ACS snapshot found"
  MID=4
  RECORD_TIME="$EFFECTIVE_AT"
fi

# ── Step 3: Featured Apps — check current status ─────────────────────────

echo -e "\n--- Step 3: Current Featured Apps status ---"
curl -sf "$BASE/v0/featured-apps" > "$OUT/03-featured-apps.json"
echo "Total on-chain FAs: $(python3 -c "import json; d=json.load(open('$OUT/03-featured-apps.json')); print(len(d.get('featured_apps',[])))")"

for P in "${ALL_PARTIES[@]}"; do
  NAME="${P%%::*}"
  FOUND=$(python3 -c "
import json
data = json.load(open('$OUT/03-featured-apps.json'))
fas = data.get('featured_apps', [])
found = any((a.get('payload',a) or a).get('provider','') == '$P' for a in fas)
print('ACTIVE' if found else 'NOT ON CHAIN')
" 2>/dev/null)
  echo "  $NAME: $FOUND"
done

# ── Step 4: Cumulative mining rewards ────────────────────────────────────

echo -e "\n--- Step 4: Cumulative mining rewards (top-providers-by-app-rewards) ---"
curl -sf "$BASE/v0/top-providers-by-app-rewards?round=$LATEST_ROUND&limit=2000" > "$OUT/04-top-providers.json"

TOTAL_CC=0
for P in "${ALL_PARTIES[@]}"; do
  NAME="${P%%::*}"
  CC=$(python3 -c "
import json
data = json.load(open('$OUT/04-top-providers.json'))
providers = data.get('providersAndRewards', [])
match = next((p for p in providers if (p.get('provider') or p.get('party','')) == '$P'), None)
print(float(match['rewards']) if match else 0.0)
" 2>/dev/null)
  echo "  $NAME: ${CC} CC"
  TOTAL_CC=$(python3 -c "print($TOTAL_CC + $CC)")
done
echo "  TOTAL across all entities: $TOTAL_CC CC"

# ── Step 5: Holdings summary for each party ──────────────────────────────

echo -e "\n--- Step 5: Current holdings ---"
for P in "${ALL_PARTIES[@]}"; do
  NAME="${P%%::*}"
  SAFE_NAME=$(echo "$NAME" | tr -cd '[:alnum:]-_')
  echo -e "\n  Holdings for: $NAME"
  curl -sf -X POST "$BASE/v0/holdings/summary" \
    -H 'Content-Type: application/json' \
    -d "{
      \"migration_id\": $MID,
      \"record_time\": \"$RECORD_TIME\",
      \"record_time_match\": \"exact\",
      \"owner_party_ids\": [\"$P\"]
    }" | tee "$OUT/05-holdings-${SAFE_NAME}.json" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for s in d.get('summaries', []):
    print(f'    Total holdings:  {s[\"total_coin_holdings\"]} CC')
    print(f'    Unlocked:        {s[\"total_unlocked_coin\"]} CC')
    print(f'    Locked:          {s[\"total_locked_coin\"]} CC')
    print(f'    Available:       {s[\"total_available_coin\"]} CC')
    print(f'    Holding fees:    {s[\"accumulated_holding_fees_total\"]} CC')
if not d.get('summaries'):
    print('    No holdings found')
" 2>/dev/null || echo "    Error fetching holdings"
done

# ── Step 6: Holdings state (contract-level detail) ───────────────────────

echo -e "\n--- Step 6: Holdings state (contracts) ---"
for P in "${ALL_PARTIES[@]}"; do
  NAME="${P%%::*}"
  SAFE_NAME=$(echo "$NAME" | tr -cd '[:alnum:]-_')
  echo -e "\n  Contracts for: $NAME"
  curl -sf -X POST "$BASE/v0/holdings/state" \
    -H 'Content-Type: application/json' \
    -d "{
      \"migration_id\": $MID,
      \"record_time\": \"$RECORD_TIME\",
      \"record_time_match\": \"exact\",
      \"page_size\": 500,
      \"owner_party_ids\": [\"$P\"]
    }" > "$OUT/06-contracts-${SAFE_NAME}.json"
  python3 -c "
import json
d = json.load(open('$OUT/06-contracts-${SAFE_NAME}.json'))
events = d.get('created_events', [])
print(f'    {len(events)} active contracts')
for ev in events[:10]:
    tmpl = ev.get('template_id','').split(':')[-1]
    amt = ev.get('create_arguments',{}).get('amount',{}).get('initialAmount','?')
    created = ev.get('created_at','?')
    locked = 'LOCKED' if 'LockedAmulet' in ev.get('template_id','') else 'UNLOCKED'
    print(f'    [{locked}] {tmpl}: {amt} CC (created {created})')
" 2>/dev/null || echo "    Error fetching contracts"
done

# ── Step 7: Transaction history ──────────────────────────────────────────

echo -e "\n--- Step 7: Transaction history ---"
for P in "${ALL_PARTIES[@]}"; do
  NAME="${P%%::*}"
  SAFE_NAME=$(echo "$NAME" | tr -cd '[:alnum:]-_')
  echo -e "\n  Transactions for: $NAME"
  curl -sf -X POST "$BASE/v0/transactions/by-party" \
    -H 'Content-Type: application/json' \
    -d "{\"party\": \"$P\", \"limit\": 500}" \
    > "$OUT/07-transactions-${SAFE_NAME}.json" 2>/dev/null

  python3 -c "
import json
try:
    d = json.load(open('$OUT/07-transactions-${SAFE_NAME}.json'))
except:
    print('    Not available on this SV endpoint')
    exit(0)

txs = d.get('transactions', [])
print(f'    {len(txs)} transactions')

transfers_out = []
for tx in txs:
    tt = tx.get('transaction_type','')
    if tt == 'transfer' and tx.get('transfer'):
        sender = tx['transfer'].get('sender',{}).get('party','')
        for r in tx['transfer'].get('receivers',[]):
            rparty = r.get('party','')
            amt = float(r.get('amount','0'))
            is_self = '${KEY}' in rparty
            if '${KEY}' in sender and not is_self:
                rname = rparty.split('::')[0]
                is_bybit = 'ByBit' in rparty
                tag = ' [BYBIT]' if is_bybit else ''
                transfers_out.append((tx.get('date',''), rname, amt, tag))
                print(f'    [OUT] {tx.get(\"date\",\"\")} {amt:.6f} CC -> {rname}{tag}')

total_out = sum(t[2] for t in transfers_out)
if transfers_out:
    print(f'    TOTAL transferred out: {total_out:.6f} CC across {len(transfers_out)} transfers')
" 2>/dev/null || echo "    Error/not available"
done

# ── Step 8: Governance votes — grant/revoke/pause ────────────────────────

echo -e "\n--- Step 8: Governance votes ---"

echo -e "\n  GrantFeaturedAppRight votes (accepted):"
curl -sf -X POST "$BASE/v0/admin/sv/voteresults" \
  -H 'Content-Type: application/json' \
  -d '{"actionName":"SRARC_GrantFeaturedAppRight","accepted":true,"limit":500}' \
  > "$OUT/08-grant-votes.json"
python3 -c "
import json
d = json.load(open('$OUT/08-grant-votes.json'))
votes = d.get('dso_rules_vote_results', [])
key = '${KEY}'
for vr in votes:
    j = json.dumps(vr)
    if key in j or 'coinaegis' in j.lower() or 'aevumwallet' in j.lower() or 'cryptolegacy' in j.lower():
        ca = vr.get('completedAt') or vr.get('completed_at','')
        reason = (vr.get('request',{}).get('reason',{}).get('body',''))[:200]
        # find provider
        av = vr.get('request',{}).get('action',{}).get('value',{})
        provider = av.get('dsoAction',{}).get('value',{}).get('provider','') or av.get('provider','')
        pname = provider.split('::')[0] if provider else '?'
        print(f'    GRANT {pname} at {ca}')
        if reason: print(f'      Reason: {reason}')
" 2>/dev/null

for ACTION in "SRARC_RevokeFeaturedAppRight" "SRARC_PauseFeaturedAppRight" "SRARC_SetFeaturedAppRight"; do
  echo -e "\n  $ACTION votes:"
  for ACCEPTED in true false; do
    curl -sf -X POST "$BASE/v0/admin/sv/voteresults" \
      -H 'Content-Type: application/json' \
      -d "{\"actionName\":\"$ACTION\",\"accepted\":$ACCEPTED,\"limit\":500}" \
      > "$OUT/08-${ACTION}-${ACCEPTED}.json" 2>/dev/null
    python3 -c "
import json
try:
    d = json.load(open('$OUT/08-${ACTION}-${ACCEPTED}.json'))
except:
    exit(0)
votes = d.get('dso_rules_vote_results', [])
key = '${KEY}'
for vr in votes:
    j = json.dumps(vr)
    if key in j or 'coinaegis' in j.lower() or 'aevum' in j.lower() or 'cryptolegacy' in j.lower():
        ca = vr.get('completedAt') or vr.get('completed_at','')
        reason = (vr.get('request',{}).get('reason',{}).get('body',''))[:200]
        print(f'    [${ACCEPTED}] ${ACTION} at {ca}')
        if reason: print(f'      Reason: {reason}')
" 2>/dev/null
  done
done

# Also search ALL vote results broadly
echo -e "\n  All governance actions mentioning CoinAegis entities:"
for ACCEPTED in true false; do
  curl -sf -X POST "$BASE/v0/admin/sv/voteresults" \
    -H 'Content-Type: application/json' \
    -d "{\"accepted\":$ACCEPTED,\"limit\":500}" \
    > "$OUT/08-all-votes-${ACCEPTED}.json" 2>/dev/null
  python3 -c "
import json
try:
    d = json.load(open('$OUT/08-all-votes-${ACCEPTED}.json'))
except:
    exit(0)
votes = d.get('dso_rules_vote_results', [])
key = '${KEY}'
for vr in votes:
    j = json.dumps(vr)
    if key in j or 'coinaegis' in j.lower() or 'aevumwallet' in j.lower() or 'cryptolegacy' in j.lower():
        ca = vr.get('completedAt') or vr.get('completed_at','')
        action_tag = vr.get('request',{}).get('action',{}).get('tag','')
        inner_tag = vr.get('request',{}).get('action',{}).get('value',{}).get('dsoAction',{}).get('tag','')
        reason = (vr.get('request',{}).get('reason',{}).get('body',''))[:200]
        print(f'    [$ACCEPTED] {action_tag}/{inner_tag} at {ca}')
        if reason: print(f'      Reason: {reason}')
" 2>/dev/null
done

# ── Step 9: Round-party-totals timeline ──────────────────────────────────

echo -e "\n--- Step 9: Mining rewards timeline (round-party-totals) ---"
echo "  Sampling round ranges to build cumulative CC timeline..."

# Sample recent rounds in larger batches for the timeline
STEP=$((LATEST_ROUND / 30))
if [ "$STEP" -lt 500 ]; then STEP=500; fi

TIMELINE_FILE="$OUT/09-timeline.csv"
echo "party,round,cumulative_app_rewards,cumulative_validator_rewards" > "$TIMELINE_FILE"

START_ROUND=$((LATEST_ROUND - STEP * 30))
if [ "$START_ROUND" -lt 0 ]; then START_ROUND=0; fi

for ((R=START_ROUND; R<=LATEST_ROUND; R+=STEP)); do
  END_R=$((R + 49))
  if [ "$END_R" -gt "$LATEST_ROUND" ]; then END_R="$LATEST_ROUND"; fi

  curl -sf -X POST "$BASE/v0/round-party-totals" \
    -H 'Content-Type: application/json' \
    -d "{\"start_round\":$R,\"end_round\":$END_R}" 2>/dev/null | \
  python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except:
    exit(0)
key = '${KEY}'
for e in d.get('entries', []):
    party = e.get('party','')
    if key in party:
        rnd = e.get('closed_round','')
        app = e.get('cumulative_app_rewards','0')
        val = e.get('cumulative_validator_rewards','0')
        pname = party.split('::')[0]
        print(f'{pname},{rnd},{app},{val}')
" >> "$TIMELINE_FILE" 2>/dev/null
done

echo "  Timeline saved to $TIMELINE_FILE"
echo "  Preview:"
head -20 "$TIMELINE_FILE"
echo "  ..."
tail -10 "$TIMELINE_FILE"

# ── Step 10: Scan recent ledger updates for CoinAegis activity ───────────

echo -e "\n--- Step 10: Recent ledger activity (v2/updates scan) ---"
echo "  Scanning recent updates for CoinAegis entity activity..."

python3 - "$BASE" "$KEY" "$OUT" <<'PYEOF'
import json, sys, urllib.request

base = sys.argv[1]
key = sys.argv[2]
out = sys.argv[3]

parties = [
    f"coinaegis::{key}",
    f"coinaegisVault::{key}",
    f"aevumWallet::{key}",
    f"cryptolegacy-validator-1::{key}",
]
party_set = set(parties)

matching = []
after = None

for page in range(20):
    body = {"page_size": 100}
    if after:
        body["after"] = after

    try:
        req = urllib.request.Request(
            f"{base}/v2/updates",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  Page {page}: error — {e}")
        break

    txns = data.get("transactions", [])
    if not txns:
        break

    for tx in txns:
        events = tx.get("events_by_id", {})
        for eid, ev in events.items():
            all_parties = (ev.get("signatories", []) + ev.get("observers", [])
                          + ev.get("acting_parties", []))
            matched = [p for p in all_parties if p in party_set]
            if matched:
                matching.append({
                    "update_id": tx.get("update_id"),
                    "record_time": tx.get("record_time"),
                    "event_id": eid,
                    "event_type": ev.get("event_type"),
                    "template_id": ev.get("template_id"),
                    "choice": ev.get("choice"),
                    "matched_parties": matched,
                })

    last = txns[-1]
    after = {
        "after_migration_id": last.get("migration_id", 0),
        "after_record_time": last.get("record_time"),
    }

print(f"  Found {len(matching)} events involving CoinAegis entities")

# Categorize
by_template = {}
for ev in matching:
    tmpl = (ev["template_id"] or "").split(":")[-1] or ev.get("choice") or "unknown"
    by_template[tmpl] = by_template.get(tmpl, 0) + 1

print("  By template:")
for tmpl, count in sorted(by_template.items(), key=lambda x: -x[1]):
    print(f"    {tmpl}: {count}")

rewards = [e for e in matching if "RewardCoupon" in (e["template_id"] or "")]
transfers = [e for e in matching if "Transfer" in (e["template_id"] or "") or e.get("choice") == "Transfer"]
print(f"  Reward coupons (mining): {len(rewards)}")
print(f"  Transfer events: {len(transfers)}")

with open(f"{out}/10-ledger-activity.json", "w") as f:
    json.dump({"total_events": len(matching), "by_template": by_template,
               "events": matching[:200]}, f, indent=2)
PYEOF

# ── Summary ──────────────────────────────────────────────────────────────

echo -e "\n================================================================"
echo "  AUDIT COMPLETE"
echo "  All raw data saved to: $OUT"
echo "  Files:"
ls -la "$OUT"/*.json "$OUT"/*.csv 2>/dev/null
echo ""
echo "  KEY NEXT STEPS:"
echo "  1. Check 08-*.json files for the exact pause/revocation date"
echo "  2. Cross-reference 09-timeline.csv to find CC mined AFTER pause date"
echo "  3. Check 07-transactions-*.json for all outbound transfers"
echo "  4. Review 10-ledger-activity.json for post-pause activity"
echo "================================================================"
