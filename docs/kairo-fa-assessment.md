# Kairo FA Assessment — Data Summary for Tokenomics Committee

**Date**: June 3, 2026
**Subject**: AngelHack Kairo FA (DEX) — On-chain activity and performance data
**Party ID**: `kairo-mainnet::12205162445638c3f71c9942b74360134b4ebc953b5bea2c25adc99bff130bffd060`

---

## 1. FA Status & Leaderboard Position

| Metric | Value | Source |
|--------|-------|--------|
| App Name | kairo-mainnet | Scan API `/v0/featured-apps` |
| Company | Kairo | `docs/featured-app-company-names.json` |
| FA Approval Date | 2025-12-16 | Scan API vote results (GrantFeaturedAppRight) |
| Days as FA | 168 (as of June 3, 2026) | Derived from approval date |
| Leaderboard Rank | #47 of all Featured Apps | Scan API `/v0/top-providers-by-app-rewards` |
| Cumulative CC (Scan API) | 25,650,297 CC | Scan API `round-party-totals` at round 98,649 |
| Pre-FA CC | 0 | `featured-apps-report.mjs` output |

For context, the top 5 Featured Apps by cumulative CC:

| Rank | CC |
|------|-----|
| #1 | 2,005,169,532 |
| #2 | 1,542,497,027 |
| #3 | 1,413,324,002 |
| #4 | 1,057,823,949 |
| #5 | 494,946,408 |
| **#47 (Kairo)** | **25,650,297** |

## 2. FeaturedAppRight Contract Lifecycle

Two `FeaturedAppRight` contract creation events exist on-chain for Kairo's provider party ID:

| Event Type | Effective At | Contract ID (prefix) |
|------------|-------------|---------------------|
| created | 2025-12-16 23:00:48 UTC | `00ed9793b287...` |
| created | 2026-04-21 20:44:37 UTC | `00d6ad7cca91...` |

Source: BigQuery `events_parsed`, filtered by `template_id LIKE '%:FeaturedAppRight'` and Kairo's provider party ID, `event_type IN ('created', 'archived')`. No `archived` events were returned by this query; however, archived events have minimal/empty payloads on the Canton ledger, so a payload-filtered query would not capture them.

The vote reason recorded for Kairo's FA grant states:

> "Tokenomics has agreed to reinstate the FA rights for the Kairo app and give them the same opportunity as all other apps to be fully compliant with the existing FA Guidelines by Monday, Apr 20th 2026, 5 pm ET."

Source: `featured-apps-report.mjs --json` output, `reasonSnippet` field (extracted from on-chain `GrantFeaturedAppRight` vote result `reason.body`).

## 3. Active Wallets

**Zero unique external wallets have interacted with Kairo across its entire lifetime.**

| Query | Result |
|-------|--------|
| All unique parties interacting with Kairo (excluding Kairo and DSO system parties), all time | **No data returned** |
| Unique parties per month (same exclusions) | **No data returned** |

Source: BigQuery `events_parsed`. Queried all parties appearing in `signatories`, `acting_parties`, and `observers` arrays on events where Kairo appears in `signatories` or `witness_parties`, with `effective_at >= '2025-12-01'`. Excluded Kairo's own party ID and `DSO::%` system parties. Both queries returned empty result sets.

## 4. Monthly Transfer Volume

Kairo is the `acting_party` on 620,172 `AmuletRules_Transfer` events. However, zero unique senders were identifiable from transfer payloads (`JSON_VALUE(payload, '$.sender')` returned NULL on all events), and zero external wallets were found on these events (Section 3).

| Month | Transfer Events | Input CC (from `exercise_result`) | Unique Senders |
|-------|----------------|----------------------------------|----------------|
| 2025-12 | 265 | 1,580,178 | 0 |
| 2026-01 | 6,596 | 1,746,646,435 | 0 |
| 2026-02 | 109,980 | 44,258,051,224 | 0 |
| 2026-03 | 386,141 | 180,844,816,521 | 0 |
| 2026-04 | 114,506 | 10,475,393,744 | 0 |
| 2026-05 | 2,571 | 4,892,656,363 | 0 |
| 2026-06 (3 days) | 113 | 266,655,676 | 0 |
| **Total** | **620,172** | **242,485,800,142** | **0** |

Source: BigQuery `events_parsed`, `event_type = 'exercised'`, `choice IN ('AmuletRules_Transfer', 'Transfer', 'AmuletRules_BuyMemberTraffic')`. Kairo matched via `signatories`, `witness_parties`, `acting_parties`, `observers` arrays and payload JSON fields (`$.provider`, `$.sender`, `$.buyer`). The `acting_parties` filter (Q1c) returned identical event counts and volumes, confirming Kairo initiates all of these transfers.

## 5. Daily Transfer Volume

Selected daily data points (full dataset available in BigQuery):

| Day | Transfer Events | Input CC | Unique Senders |
|-----|----------------|----------|----------------|
| 2025-12-04 | 2 | 40 | 0 |
| 2025-12-31 | 90 | 1,414,041,665 | 0 |
| 2026-01-15 | 138 | 57,269,049,623 | 0 |
| 2026-02-14 | 11,801 | 2,554,145,342 | 0 |
| 2026-02-23 | 7,008 | 2,580,916,203 | 0 |
| 2026-03-22 | 26,353 | 10,797,698,404 | 0 |
| 2026-03-24 | 26,446 | 11,292,727,063 | 0 |
| 2026-04-03 | 30,819 | 647,547,627 | 0 |
| 2026-05-20 | 141 | 234,219,148 | 0 |
| 2026-05-30 | 140 | 389,561,152 | 0 |
| 2026-06-02 | 110 | 259,871,186 | 0 |

Source: Same BigQuery query as Section 4, grouped by `DATE(effective_at)`.

## 6. Monthly App Reward CC Earned

All reward coupons are tagged `featured = true`. Zero unfeatured coupons exist.

| Month | Reward Coupons | CC Earned | ~USD (at $0.149/CC) | Featured | Unfeatured |
|-------|---------------|-----------|---------------------|----------|------------|
| 2025-12 | 737 | 5,566 | $830 | 737 | 0 |
| 2026-01 | 36,443 | 265,065 | $39,529 | 36,443 | 0 |
| 2026-02 | 214,134 | 4,671,441 | $696,647 | 214,134 | 0 |
| 2026-03 | 442,771 | 20,544,805 | $3,063,826 | 442,771 | 0 |
| 2026-04 | 34,689 | 10,305,771 | $1,536,889 | 34,689 | 0 |
| 2026-05 | 3,650 | 8,081,166 | $1,205,136 | 3,650 | 0 |
| 2026-06 (3 days) | 188 | 345,621 | $51,542 | 188 | 0 |
| **Total** | **732,612** | **~44.2M** | **~$6.6M** | **732,612** | **0** |

Source: BigQuery `events_parsed`, `template_id LIKE '%:AppRewardCoupon'`, `event_type = 'created'`, filtered by Kairo's provider party ID in payload.

Note: The ~$USD column uses the current amulet price ($0.149129) for all months. Actual USD value at the time of each reward may differ. The BigQuery total (~44.2M CC) differs from the Scan API cumulative (25.65M CC); the Scan API metric may account for coupon consumption, holding fees, or other adjustments.

## 7. Network Traffic Purchased

| Metric | Value | Source |
|--------|-------|--------|
| Cumulative traffic purchased | 0 | Scan API `round-party-totals` (all sampled rounds) |
| Cumulative traffic CC spent | 0.0000000000 | Scan API `round-party-totals` |
| Traffic num purchases | 0 | Scan API `round-party-totals` |

Sampled at rounds 74,649 through 98,649 (covering Kairo's full FA lifetime). Every sample returned `cumulative_traffic_purchased: 0`.

## 8. On-Chain Activity Fingerprint

The only contract types where Kairo appears as a party (`signatories` or `witness_parties`):

| Template | Event Type | Active Months | Peak Monthly Events |
|----------|-----------|---------------|-------------------|
| `Splice.Amulet:Amulet` | created | Dec 2025 – Jun 2026 | 272,274 (Mar 2026) |
| `Splice.Amulet:LockedAmulet` | created | Feb – Apr 2026 | 89,235 (Mar 2026) |
| `Splice.AmuletAllocation:AmuletAllocation` | created | Feb – Apr 2026 | 89,235 (Mar 2026) |

Source: BigQuery `events_parsed`, grouped by `template_id`, `event_type`, and month. No DEX-specific contract templates (order books, liquidity pools, swap contracts) were found.

## 9. Scan API Per-Round Trajectory

Cumulative CC at sampled rounds, from Scan API `round-party-totals`:

| ~Date | Round | Cumulative CC | Per-Round CC | Traffic |
|-------|-------|--------------|-------------|---------|
| Jan 14, 2026 | 78,649 | 367,230 | 134 | 0 |
| Feb 11 | 82,649 | 680,488 | 56 | 0 |
| Mar 12 | 86,649 | 5,711,183 | 1,938 | 0 |
| Apr 8 | 90,648 | 17,621,550 | 1,934 | 0 |
| May 6 | 94,648 | 20,218,127 | 2,396 | 0 |
| May 20 | 96,649 | 22,495,584 | 3,893 | 0 |
| May 27 | 97,649 | 24,096,985 | 5,392 | 0 |
| Jun 3 | 98,649 | 25,650,297 | 3,050 | 0 |

Validator rewards are 0.0 at every sampled round. `cumulative_traffic_purchased` is 0 at every sampled round.

---

## Data Sources

All data in this report comes from:

1. **Canton Scan API** (free, real-time): `https://scan.sv-1.global.canton.network.sync.global/api/scan`
   - `GET /v0/featured-apps`
   - `GET /v0/top-providers-by-app-rewards?round={N}&limit=1000`
   - `GET /v0/round-of-latest-data`
   - `POST /v0/round-party-totals`

2. **BigQuery** (project `governence-483517`, table `transformed.events_parsed`):
   - Partitioned by `DATE(effective_at)`, clustered by `template_id, event_type, migration_id`
   - 3.6B+ rows, covering full Canton Network ledger history
   - All queries filtered `effective_at >= '2025-12-01'` for partition pruning

3. **`featured-apps-report.mjs`**: Script in this repository that queries Scan API endpoints and computes FA milestones, approval dates, and company names from on-chain vote records.

4. **Repository reference files**: `docs/featured-app-company-names.json`, `docs/party-id-company-map.json`
