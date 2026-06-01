#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# ByBit All Nodes — Holdings Timeline
#
# Discovers all ByBit validator party IDs from the on-chain validator
# list, then checks each one's holdings at key dates around the
# CoinAegis sweep window.
# ════════════════════════════════════════════════════════════════════════════

BASE="${SCAN_URL:-https://scan.sv-1.global.canton.network.cumberland.io/api/scan}"
OUT="/tmp/coinaegis-bybit"
mkdir -p "$OUT"

MID=4

echo "================================================================"
echo "  BYBIT ALL NODES — HOLDINGS TIMELINE"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================"

# ── Step 1: Discover all ByBit validator party IDs ─────────────────────

echo -e "\n--- Step 1: Discover ByBit validator party IDs ---"
echo "  Fetching validator licenses..."

curl -sf --max-time 30 "$BASE/v0/validator-licenses" > "$OUT/validator-licenses.json" 2>/dev/null

BYBIT_PARTIES_FILE="$OUT/bybit-all-party-ids.json"

python3 -c "
import json

d = json.load(open('$OUT/validator-licenses.json'))
licenses = d.get('validator_licenses', d.get('licenses', []))
print(f'  Total validator licenses: {len(licenses)}')

bybit_parties = []
seen = set()

for lic in licenses:
    # Try various response formats
    payload = lic.get('payload') or lic
    validator = payload.get('validator') or payload.get('provider') or payload.get('party') or ''

    name = validator.split('::')[0] if '::' in validator else validator

    if ('bybit' in name.lower() or 'ByBit' in name) and validator not in seen:
        seen.add(validator)
        bybit_parties.append({'name': name, 'party_id': validator})
        print(f'  Found: {validator}')

print(f'\n  Total ByBit party IDs: {len(bybit_parties)}')

with open('$BYBIT_PARTIES_FILE', 'w') as f:
    json.dump(bybit_parties, f, indent=2)
" 2>/dev/null

# If validator-licenses didn't work, try featured-apps + known prefixes
if [ ! -s "$BYBIT_PARTIES_FILE" ] || [ "$(python3 -c "import json; print(len(json.load(open('$BYBIT_PARTIES_FILE'))))" 2>/dev/null)" = "0" ]; then
  echo "  Validator licenses didn't return ByBit nodes."
  echo "  Trying top-providers endpoint..."

  curl -sf --max-time 30 "$BASE/v0/top-providers-by-app-rewards?round=98450&limit=2000" > "$OUT/top-providers-all.json" 2>/dev/null

  python3 -c "
import json

d = json.load(open('$OUT/top-providers-all.json'))
providers = d.get('providersAndRewards', [])

bybit = []
seen = set()
for p in providers:
    pid = p.get('provider') or p.get('party') or ''
    name = pid.split('::')[0]
    if ('bybit' in name.lower() or 'ByBit' in name) and pid not in seen:
        seen.add(pid)
        bybit.append({'name': name, 'party_id': pid, 'rewards': p.get('rewards', '0')})
        print(f'  Found in top-providers: {pid}')

# Also scan round-party-totals for ByBit validators
print(f'  Found {len(bybit)} ByBit parties in top providers')
with open('$BYBIT_PARTIES_FILE', 'w') as f:
    json.dump(bybit, f, indent=2)
" 2>/dev/null
fi

# Also try to discover via round-party-totals for a recent round
echo "  Also checking round-party-totals for ByBit validators..."
curl -sf --max-time 30 -X POST "$BASE/v0/round-party-totals" \
  -H 'Content-Type: application/json' \
  -d '{"round": 98450}' > "$OUT/round-party-totals-latest.json" 2>/dev/null

python3 -c "
import json

# Merge any new ByBit parties from round-party-totals
try:
    existing = json.load(open('$BYBIT_PARTIES_FILE'))
except:
    existing = []
seen = set(p['party_id'] for p in existing)

d = json.load(open('$OUT/round-party-totals-latest.json'))
entries = d.get('round_party_totals', d.get('entries', []))

new_found = 0
for e in entries:
    pid = e.get('party') or e.get('provider') or ''
    name = pid.split('::')[0]
    if ('bybit' in name.lower() or 'ByBit' in name) and pid not in seen:
        seen.add(pid)
        existing.append({'name': name, 'party_id': pid})
        new_found += 1
        print(f'  Found in round-party-totals: {name}')

if new_found:
    with open('$BYBIT_PARTIES_FILE', 'w') as f:
        json.dump(existing, f, indent=2)
    print(f'  Added {new_found} new ByBit parties')
else:
    print(f'  No additional ByBit parties found in round-party-totals')

print(f'  Total ByBit party IDs: {len(existing)}')
" 2>/dev/null

# ── Step 2: Check holdings for all ByBit parties at key dates ──────────

echo -e "\n--- Step 2: All ByBit node holdings at key dates ---"

DATES=("2026-05-25T00:00:00Z" "2026-05-26T00:00:00Z" "2026-05-27T00:00:00Z" "2026-05-28T00:00:00Z" "2026-05-29T00:00:00Z" "2026-05-30T00:00:00Z" "2026-05-31T00:00:00Z" "2026-06-01T15:00:00Z")

# Get snapshot times
declare -a SNAPSHOTS
for D in "${DATES[@]}"; do
  RT=$(curl -sf --max-time 10 "$BASE/v0/state/acs/snapshot-timestamp?before=${D}&migration_id=${MID}" 2>/dev/null \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('record_time',''))" 2>/dev/null || echo "")
  SNAPSHOTS+=("$RT")
done

BYBIT_FILE="$BYBIT_PARTIES_FILE" python3 -c "
import json, subprocess, os, sys

bybit_parties = json.load(open(os.environ['BYBIT_FILE']))
base = '$BASE'
mid = $MID
dates = $(python3 -c "import json; print(json.dumps([$(printf '"%s",' "${DATES[@]}" | sed 's/,$//')])")")
snapshots = $(python3 -c "import json; print(json.dumps([$(printf '"%s",' "${SNAPSHOTS[@]}" | sed 's/,$//')])")")

if not bybit_parties:
    print('  No ByBit parties found — cannot check holdings')
    sys.exit(0)

# Print header
header = f'  {\"Party\":<35}'
for d in dates:
    header += f'  {d[:10]:>14}'
print(header)
print('  ' + '-' * (35 + 16 * len(dates)))

totals_by_date = [0.0] * len(dates)

for bp in bybit_parties:
    pid = bp['party_id']
    name = bp['name']
    row = f'  {name:<35}'

    for i, (d, rt) in enumerate(zip(dates, snapshots)):
        if not rt:
            row += f'  {\"no snap\":>14}'
            continue
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
            resp = json.loads(result.stdout)
            s = (resp.get('summaries') or [{}])[0]
            total = float(s.get('total_coin_holdings', '0'))
            totals_by_date[i] += total
            row += f'  {total:>14,.2f}'
        except Exception as e:
            row += f'  {\"err\":>14}'

    print(row)

# Print totals
total_row = f'  {\"TOTAL\":.<35}'
for t in totals_by_date:
    total_row += f'  {t:>14,.2f}'
print(total_row)

# Print deltas
print()
print('  Changes between dates:')
for i in range(1, len(dates)):
    delta = totals_by_date[i] - totals_by_date[i-1]
    sign = '+' if delta >= 0 else ''
    print(f'    {dates[i-1][:10]} → {dates[i][:10]}: {sign}{delta:,.2f} CC')
" 2>/dev/null

echo -e "\n================================================================"
echo "  Done: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================"
