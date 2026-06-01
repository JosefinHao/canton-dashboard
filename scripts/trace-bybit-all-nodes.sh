#!/usr/bin/env bash
set -euo pipefail

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

# Fetch ALL validator licenses (paginated endpoint)
echo "  Fetching validator licenses from v0/admin/validator/licenses..."
ALL_LICENSES="$OUT/all-validator-licenses.json"
echo '[]' > "$ALL_LICENSES"

AFTER=""
PAGE=0
while true; do
  URL="$BASE/v0/admin/validator/licenses?limit=500"
  if [ -n "$AFTER" ]; then
    URL="${URL}&after=${AFTER}"
  fi

  HTTP_CODE=$(curl -sf -w "%{http_code}" -o "$OUT/licenses-page-${PAGE}.json" \
    --max-time 30 "$URL" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" != "200" ]; then
    echo "  Page $PAGE: HTTP $HTTP_CODE — stopping"
    break
  fi

  COUNT=$(python3 -c "
import json
d = json.load(open('$OUT/licenses-page-${PAGE}.json'))
lics = d.get('validator_licenses', [])
print(len(lics))

# Append to all licenses
existing = json.load(open('$ALL_LICENSES'))
existing.extend(lics)
with open('$ALL_LICENSES', 'w') as f:
    json.dump(existing, f)

npt = d.get('next_page_token', '')
if npt:
    print(npt, file=open('$OUT/next-page-token.txt', 'w'))
else:
    open('$OUT/next-page-token.txt', 'w').write('')
" 2>/dev/null || echo "0")

  AFTER=$(cat "$OUT/next-page-token.txt" 2>/dev/null || echo "")
  PAGE=$((PAGE + 1))
  echo "  Page $PAGE: $COUNT licenses"

  if [ -z "$AFTER" ] || [ "$COUNT" = "0" ]; then
    break
  fi
done

# Extract ByBit parties
echo "  Filtering for ByBit..."
python3 -c "
import json

licenses = json.load(open('$ALL_LICENSES'))
print(f'  Total licenses fetched: {len(licenses)}')

bybit = []
seen = set()
for lic in licenses:
    payload = lic.get('payload') or lic
    validator = payload.get('validator', '')
    name = validator.split('::')[0] if '::' in validator else validator

    if ('bybit' in name.lower()) and validator and validator not in seen:
        seen.add(validator)
        bybit.append({'name': name, 'party_id': validator})
        print(f'  Found: {name} → {validator[:60]}...')

print(f'\n  Total ByBit party IDs: {len(bybit)}')

with open('$OUT/bybit-all-party-ids.json', 'w') as f:
    json.dump(bybit, f, indent=2)
" 2>/dev/null || echo "  Error parsing licenses"

# ── Step 2: Holdings timeline for all ByBit nodes ─────────────────────
echo -e "\n--- Step 2: ByBit node holdings at key dates ---"

DATES="2026-05-25 2026-05-26 2026-05-27 2026-05-28 2026-05-29 2026-05-30 2026-05-31 2026-06-01"

BYBIT_FILE="$OUT/bybit-all-party-ids.json" SCAN_BASE="$BASE" python3 << 'PYEOF'
import json, subprocess, os

base = os.environ['SCAN_BASE']
mid = 4
bybit_parties = json.load(open(os.environ['BYBIT_FILE']))
dates = os.environ.get('DATES', '').split() if os.environ.get('DATES') else []

if not bybit_parties:
    print("  No ByBit parties found!")
    exit(0)

dates_ts = [f"{d}T00:00:00Z" for d in "2026-05-25 2026-05-26 2026-05-27 2026-05-28 2026-05-29 2026-05-30 2026-05-31".split()]
dates_ts.append("2026-06-01T15:00:00Z")

# Resolve snapshots
snapshots = []
for dt in dates_ts:
    try:
        r = subprocess.run(
            ['curl', '-sf', '--max-time', '10',
             f'{base}/v0/state/acs/snapshot-timestamp?before={dt}&migration_id={mid}'],
            capture_output=True, text=True, timeout=15
        )
        d = json.loads(r.stdout)
        snapshots.append(d.get('record_time', ''))
    except:
        snapshots.append('')

# Print header
date_labels = [dt[:10] for dt in dates_ts]
header = f"  {'Party':<32}"
for dl in date_labels:
    header += f" {dl:>14}"
print(header)
print("  " + "-" * (32 + 15 * len(date_labels)))

totals = [0.0] * len(dates_ts)

for bp in bybit_parties:
    pid = bp['party_id']
    name = bp['name']
    row = f"  {name:<32}"

    for i, (dt, rt) in enumerate(zip(dates_ts, snapshots)):
        if not rt:
            row += f" {'no snap':>14}"
            continue
        try:
            r = subprocess.run(
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
            resp = json.loads(r.stdout)
            s = (resp.get('summaries') or [{}])[0]
            val = float(s.get('total_coin_holdings', '0'))
            totals[i] += val
            row += f" {val:>14,.2f}"
        except:
            row += f" {'err':>14}"

    print(row)

# Totals row
print("  " + "-" * (32 + 15 * len(date_labels)))
total_row = f"  {'TOTAL':<32}"
for t in totals:
    total_row += f" {t:>14,.2f}"
print(total_row)

# Deltas
print()
print("  Day-over-day changes:")
for i in range(1, len(dates_ts)):
    delta = totals[i] - totals[i-1]
    sign = "+" if delta >= 0 else ""
    print(f"    {date_labels[i-1]} → {date_labels[i]}: {sign}{delta:>12,.2f} CC")

print()
PYEOF

echo "================================================================"
echo "  Done: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================"
