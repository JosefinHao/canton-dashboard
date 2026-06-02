# CoinAegis Incident Audit Report

**Date:** 2026-06-01

---

## Executive Summary

CoinAegis operated a large-scale reward farming scheme on the Canton Network using **44+ party IDs** all controlled by the same cryptographic key. The core mechanism was **wash trading**: 253,397 self-transfers (80% of all activity) shuttled tiny amounts (0.1–4 CC) between CoinAegis-controlled parties to generate AppRewardCoupons through their own Featured Apps (aevumWallet and goldacorn). Only **36 out of 315,418 transfers (0.01%)** were genuine external transactions — the rest were circular.

The entity registered multiple FA grants under different names (CoinAegis, Aevum Wallet, Goldacorn), created 40+ additional `auth0_*` party IDs, and harvested the majority of rewards through a validator node (`cryptolegacy-validator-1`) that was never itself a Featured App. After the AevumWallet pause vote reached threshold on May 28 at 21:41:38 UTC, the last reward coupon was generated **39 seconds later** — the operator was monitoring governance in real time. Within 31 minutes, they consolidated 665K CC for extraction. 1,065,002 CC was sent to ByBit and 700,001 CC to Gate.io — partially routed through intermediary wallets to obscure the money trail.

---

## Key Fingerprint

All party IDs share the same key:
```
122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3
```

This proves single-entity control over all 44+ party IDs.

---

## Total CC Mined (All Entities)

| Party ID | App Rewards Harvested (CC) | Type |
|---|---:|---|
| `cryptolegacy-validator-1` | 2,598,113.64 | Validator (never an FA) |
| `aevumWallet` | 155,970.47 | FA (revoked May 28) |
| `coinaegis` | 7,201.82 | FA (revoked May 29) |
| `coinaegisVault` | 4,232.76 | FA (**STILL ACTIVE**) |
| 40 `auth0_*` party IDs | ~39,001.13 | Not FAs |
| **TOTAL** | **~2,804,520 CC** | |

### auth0 Party Breakdown

| Group | Count | Total CC |
|---|---:|---:|
| `auth0_007c69eb*` | 3 | ~4,012 |
| `auth0_007c6a003e*` | 1 | ~1,293 |
| `auth0_007c6a003f*` | 6 | ~7,704 |
| `auth0_007c6a03c*` | 5 | ~6,060 |
| `auth0_007c6a066ea*` | 10 | ~9,290 |
| `auth0_007c6a07b6*` | 15 | ~10,641 |
| **Total auth0** | **40** | **~39,001** |

---

## Current Holdings (What Remains in Wallets)

| Party | Holdings (CC) | Contract Created |
|---|---:|---|
| `cryptolegacy-validator-1` | 8,723.16 | 2026-05-29 |
| `aevumWallet` | 1,000.00 | 2026-05-29 |
| `coinaegis` | 1,000.00 | 2026-05-28 |
| `coinaegisVault` | 199.99 | 2026-05-27 |
| **Total remaining** | **~10,923 CC** | |

All contracts were created May 27-29, indicating wallets were swept recently. Only 0.4% of mined CC remains.

---

## Governance Timeline

| Date | Event | Details |
|---|---|---|
| 2026-04-20 | FA granted: `coinaegis` | "Dual-Vault RWA yield engine" |
| 2026-04-20 | FA granted: `aevumWallet` | "Aevum Extension Wallet" — same key as CoinAegis |
| 2026-04-20 | FA granted: `goldacorn` | "Goldacorn OTC/P2P swapping platform" — same key |
| 2026-05-01 | FA granted: `coinaegisVault` | "2nd partyID" for CoinAegis |
| 2026-05-28 20:00:01 | **AevumWallet pause vote initiated** | Requester: Global-Synchronizer-Foundation. "Tokenomics Committee has voted to pause the AevumWallet App due to recent on-chain activity that needs further investigation" |
| 2026-05-28 21:41:38 | **AevumWallet pause vote reached threshold** | 10 SVs voted to pause |
| 2026-05-28 21:42:17 | **Last aevumWallet AppRewardCoupon** | Round 97923 — 39 seconds after vote threshold |
| 2026-05-28 22:12:56 | 665K CC consolidated | Pre-existing amulets (635K) + harvested rewards (29.7K) merged |
| 2026-05-29 09:15:17 | **Coinaegis pause vote initiated** | Same reason |
| 2026-05-29 10:38–10:45 | **Final extraction** | 415K to ByBit + 250K to Gate in 7 minutes (83 min after coinaegis vote) |
| 2026-06-01 | `coinaegisVault` | **STILL ACTIVE** |
| 2026-06-01 | `goldacorn` | Not in current FA list (revoked or expired) |

---

## Mining Timeline (cryptolegacy-validator-1)

This validator was the primary mining vehicle, earning 93% of all CC:

| Date (approx) | Round | Cumulative App CC | Cumulative Val CC | Note |
|---|---:|---:|---:|---|
| ~Mar 11 | 87000 | **0** | 7,604 | Validator rewards only |
| ~Apr 9 | 91000 | **0** | 26,197 | Still just validator |
| ~Apr 23 | 93000 | **0** | 33,587 | FA grants were Apr 20 |
| ~May 15 | 96000 | **1,142,873** | 50,072 | 1.1M app CC appeared |
| ~May 22 | 97000 | 1,432,292 | 152,543 | Val CC also tripled |
| ~May 28 | 97900 | 2,249,579 | 290,087 | **Day of first pause** |
| ~May 29 | 98000 | ~2,300,000 | ~295,000 | **Day of second pause** |
| Jun 1 | 98443 | **2,598,114** | >292,000 (last measured 292,142 at round 97910) | **Still mining** |

### Mining rate
- Rounds 96000-97000 (~7 days): ~290,000 CC/week in app rewards
- Rounds 97000-97900 (~6 days): ~817,000 CC/week (accelerating)
- Rounds 97900-98443 (~3 days): ~349,000 CC in post-pause period

---

## Post-Pause Illegal Mining Estimate

### After aevumWallet pause (May 28, 2026)

At round ~97900 (May 28):
- `cryptolegacy-validator-1` app_cc: 2,249,579
- `aevumWallet` app_cc: 150,360

Current:
- `cryptolegacy-validator-1` app_cc: 2,598,114
- `aevumWallet` app_cc: 155,970

| Party | CC mined after May 28 pause |
|---|---:|
| `cryptolegacy-validator-1` (app rewards) | ~348,535 |
| `aevumWallet` | ~5,610 |
| `coinaegisVault` (still active) | unknown portion of 4,233 |
| auth0 parties | unknown portion |
| **Minimum post-pause total** | **~354,145 CC** |

---

## Violations Identified

### 1. Identity Fraud — Multiple FA Applications Under Different Names
The same entity (same key) applied for and received FA status under at least 3 different identities:
- CoinAegis ("Dual-Vault RWA yield engine")
- Aevum Extension Wallet ("non-custodial browser gateway")
- Goldacorn ("OTC/P2P swapping platform")

These were presented as separate companies/products in the governance vote reasons.

### 2. Wash Trading — Self-Transfers to Farm Rewards
Created 40+ `auth0_*` party IDs all controlled by the same key. Used them to execute **253,397 self-transfers** (80.4% of all CoinAegis transfers) shuffling tiny amounts (0.1–4 CC) between their own parties. Each transfer generated an AppRewardCoupon through their Featured Apps (aevumWallet, goldacorn). The CC never left CoinAegis's control — it just circled between their 44+ party IDs while the FA earned fresh reward CC on every hop.

**Daily wash trading volume (BigQuery-verified):**

| Date | Self-Transfers | CC Volume | Note |
|---|---:|---:|---|
| May 9 | 25 | 39 | Testing begins |
| May 10–17 | 21,832 | 175,731 | Ramp-up |
| May 18 | 17,819 | 161,239 | First big burst |
| May 19–21 | 6,155 | 40,694 | Quiet period |
| **May 22** | **100,135** | **675,031** | **Massive burst #1** |
| May 23–27 | 4,078 | 21,892 | Low activity |
| **May 28** | **103,294** | **472,427** | **Massive burst #2 — day of governance vote** |
| May 29 | 59 | 8,687 | FA paused — scheme stopped |

80% of all self-transfers occurred on just two days (May 22 and May 28). On May 29, after the FA pause, activity dropped to 59 transfers.

**Sample wash trade pattern** (May 9, BigQuery):
```
auth0_...a4a1 → auth0_...adde   0.10 CC
auth0_...a4a1 → auth0_...a3ac   3.00 CC
auth0_...adde → auth0_...a4a1   0.71 CC
auth0_...a4a1 → auth0_...a3ac   1.00 CC
auth0_...a3ac → auth0_...adde   1.00 CC
auth0_...adde → auth0_...a3ac   0.20 CC
```

### 3. Validator Used as Primary Mining Vehicle
`cryptolegacy-validator-1` earned **2.6M CC in app rewards** despite never being registered as a Featured App. It earned more than any FA in the network.

### 4. Continued Mining After Pause
After the Tokenomics Committee paused two FAs (May 28-29), at least **~354,000 CC** continued to be mined through:
- `cryptolegacy-validator-1` (never paused — not an FA)
- `coinaegisVault` (FA never revoked)

### 5. Funds Extracted — Complete Money Trail
57.5% of all CC (~1.77M CC) was transferred to external exchange wallets (fba188/ByBit and Gate.io). An additional 42.3% (~1.3M CC) was consumed as network traffic fees to sustain the high-volume farming operation. Only 0.4% (~10.9K CC) remains in wallets. Contracts were recreated May 27-29 (just before/during the pauses), suggesting a deliberate sweep.

#### Transfer Destinations (BigQuery-confirmed)

CoinAegis used a three-phase extraction strategy with `quokka-validator-1` as an intermediary:

**Phase 1 — Via quokka intermediary (Apr 24-25, 2026):**

CoinAegis (`cryptolegacy-validator-1`) transferred CC to two auth0 party IDs controlled by quokka's key (`12200587db65aee55ac8d877208df0903c0dc9795909ee91347b0d1b6f7b43aa124e`). These quokka auth0 parties then forwarded to final destinations.

| # | Timestamp (UTC) | Sender | Receiver | Amount (CC) | Provider | Event ID |
|---|---|---|---|---:|---|---|
| 1 | 2026-04-24 23:27:55 | `cryptolegacy-validator-1` | `auth0_007c69ebf59a...` (quokka) | 10.00 | quokka-validator-1 | `1220034729...4ade:2` |
| 2 | 2026-04-24 23:35:20 | `cryptolegacy-validator-1` | `auth0_007c69ebf59a...` (quokka) | 200,000.00 | quokka-validator-1 | `1220eb2848...e4bb:2` |
| 3 | 2026-04-24 23:36:53 | `cryptolegacy-validator-1` | `auth0_007c69ebf59a...` (quokka) | 250,000.00 | quokka-validator-1 | `1220ff6134...97b9:2` |
| 4 | 2026-04-25 04:54:14 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 20.00 | quokka-validator-1 | `1220a6ebc8...18c4:2` |
| 5 | 2026-04-25 04:59:27 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 200,000.00 | quokka-validator-1 | `1220e2d296...5aaa:2` |
| 6 | 2026-04-25 05:00:48 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 200,000.00 | quokka-validator-1 | `122049c22b...1793:2` |
| 7 | 2026-04-25 05:14:14 | `cryptolegacy-validator-1` | `auth0_007c69ec1703...` (quokka) | 250,000.00 | quokka-validator-1 | `12207dd007...d612:2` |
| | | | **Phase 1 subtotal** | **1,100,030.00** | | |

Quokka intermediary forwarding — same day, hours later. Note the small test transactions (1 CC, 2 CC) before large transfers:

| # | Timestamp (UTC) | Sender | Receiver | Amount (CC) | Provider | Event ID |
|---|---|---|---|---:|---|---|
| 1a | 2026-04-25 07:30:14 | `auth0_...ff52` (quokka) | `Gate` (Gate.io) | 1.00 | gate-mainnet-1 | `1220fd47...00e7:2` |
| 1b | 2026-04-25 08:12:43 | `auth0_...ff52` (quokka) | `Gate` (Gate.io) | 250,000.00 | gate-mainnet-1 | `122006bc...5fa1:2` |
| 1c | 2026-04-25 11:37:37 | `auth0_...ff52` (quokka) | `Gate` (Gate.io) | 200,000.00 | gate-mainnet-1 | `12202c75...1f7e:2` |
| | | | **Subtotal → Gate** | **450,001.00** | | |
| 1d | 2026-04-25 12:09:00 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 2.00 | **ByBit-MainNetValidator-1** | `12207bdd...a665:2` |
| 1e | 2026-04-25 12:29:41 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 50,000.00 | **ByBit-MainNetValidator-1** | `122059c4...79d0:2` |
| 1f | 2026-04-25 13:08:12 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 200,000.00 | **ByBit-MainNetValidator-1** | `1220dd36...9b96:2` |
| 1g | 2026-04-25 17:08:23 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 200,000.00 | **ByBit-MainNetValidator-1** | `12200977...323f:2` |
| 1h | 2026-04-26 14:20:35 | `auth0_...056d` (quokka) | `fba188` (ByBit) | 200,000.00 | **ByBit-MainNetValidator-1** | `1220b6ab...a4f1:2` |
| | | | **Subtotal → fba188** | **650,002.00** | | |

**Phase 2 — Small drip transfers to quokka (May 27, 2026):**

`coinaegisVault` and one auth0 party sent 26 small transfers to `quokka-validator-1` over ~6.5 hours:

| # | Timestamp (UTC) | Sender | Amount (CC) | Event ID |
|---|---|---|---:|---|
| 8 | 2026-05-27 08:45:36 | `auth0_007c6a07b6...` (CoinAegis) | 1.00 | `1220816a83...3833:1` |
| 9 | 2026-05-27 08:47:54 | `auth0_007c6a07b6...` (CoinAegis) | 200.00 | `122001f9c2...5061:1` |
| 10 | 2026-05-27 10:56:36 | `coinaegisVault` | 190.31 | `1220fa2544...49c2:2` |
| 11 | 2026-05-27 11:25:50 | `coinaegisVault` | 155.83 | `1220db7c14...6c71:2` |
| 12 | 2026-05-27 11:33:59 | `coinaegisVault` | 207.20 | `12208676...cf61:2` |
| 13 | 2026-05-27 11:48:07 | `coinaegisVault` | 117.99 | `1220fe1f...a093:2` |
| 14 | 2026-05-27 11:54:11 | `coinaegisVault` | 178.25 | `1220907e...9644:2` |
| 15 | 2026-05-27 12:08:19 | `coinaegisVault` | 202.34 | `1220d6da...5a4:2` |
| 16 | 2026-05-27 12:18:25 | `coinaegisVault` | 152.17 | `1220f2b2...4efa:2` |
| 17 | 2026-05-27 12:28:31 | `coinaegisVault` | 176.78 | `12204f4c...e446:2` |
| 18 | 2026-05-27 12:36:38 | `coinaegisVault` | 160.31 | `1220d451...d986:2` |
| 19 | 2026-05-27 12:48:45 | `coinaegisVault` | 182.37 | `1220402f...29e2:2` |
| 20 | 2026-05-27 12:58:51 | `coinaegisVault` | 158.88 | `12203c37...a69c:2` |
| 21 | 2026-05-27 13:08:58 | `coinaegisVault` | 174.19 | `122098fd...307d:2` |
| 22 | 2026-05-27 13:19:04 | `coinaegisVault` | 174.30 | `1220ec16...e34c:2` |
| 23 | 2026-05-27 13:27:11 | `coinaegisVault` | 181.52 | `12202372...c2d4:2` |
| 24 | 2026-05-27 13:35:16 | `coinaegisVault` | 150.54 | `12204409...592f:2` |
| 25 | 2026-05-27 13:47:24 | `coinaegisVault` | 158.41 | `1220ca5c...6b85:2` |
| 26 | 2026-05-27 14:01:32 | `coinaegisVault` | 158.34 | `1220bfdc...ed94:2` |
| 27 | 2026-05-27 14:19:41 | `coinaegisVault` | 144.31 | `1220c6de...fd43:2` |
| 28 | 2026-05-27 14:27:53 | `coinaegisVault` | 137.51 | `1220743f...2e9e:2` |
| 29 | 2026-05-27 14:42:01 | `coinaegisVault` | 183.92 | `12201d3d...8b20:2` |
| 30 | 2026-05-27 14:52:08 | `coinaegisVault` | 181.95 | `12209528...d5b1:2` |
| 31 | 2026-05-27 15:02:15 | `coinaegisVault` | 139.84 | `122038cb...3fea:2` |
| 32 | 2026-05-27 15:12:21 | `coinaegisVault` | 169.66 | `1220c897...c5c3:2` |
| 33 | 2026-05-27 15:18:27 | `coinaegisVault` | 195.84 | `1220af5f...8702:2` |
| | | **Phase 2 subtotal** | **4,233.76** | |

**Phase 3 — Direct large transfers to exchanges (May 29, 2026):**

Three transfers in a 7-minute window, the day `coinaegis` FA was revoked:

| # | Timestamp (UTC) | Sender | Receiver | Amount (CC) | Provider | Event ID |
|---|---|---|---|---:|---|---|
| 34 | 2026-05-29 10:38:47 | `cryptolegacy-validator-1` | `fba188` (ByBit wallet) | 200,000.00 | **ByBit-MainNetValidator-1** | `1220aadeb4...96ba:2` |
| 35 | 2026-05-29 10:43:12 | `cryptolegacy-validator-1` | `Gate` (Gate.io) | 250,000.00 | gate-mainnet-1 | `122056fd6a...137a:2` |
| 36 | 2026-05-29 10:45:48 | `cryptolegacy-validator-1` | `fba188` (ByBit wallet) | 215,000.00 | **ByBit-MainNetValidator-1** | `1220cb1006...fdc8:2` |
| | | | **Phase 3 subtotal** | **665,000.00** | | |

#### Aggregated Destinations

| Final Destination | Total CC | Route |
|---|---:|---|
| **fba188** (ByBit-hosted wallet) | **1,065,002** | 415K direct + 650K via intermediary |
| **Gate** (Gate.io exchange) | **700,001** | 250K direct + 450K via intermediary |
| **quokka-validator-1** | **4,234** | Small direct transfers |
| Retained by intermediary wallets | 27 | Test amounts not forwarded |
| **Total left CoinAegis control** | **1,769,264** | BigQuery verified (36 transfers to 5 recipients) |

#### Complete CC Accounting (BigQuery-verified)

| Item | CC | Verification |
|---|---:|---|
| App rewards earned | 2,804,520 | Canton Scan API |
| Validator + faucet rewards harvested | ~268,325 | BigQuery (`exercise_result.summary`) |
| **Total CC entered system** | **~3,072,845** | |
| | | |
| Transferred to external parties | -1,769,264 | BigQuery (36 transfers to 5 recipients) |
| Consumed by BuyMemberTraffic | -1,301,539 | BigQuery (see breakdown below) |
| Remaining in wallets | -10,923 | Canton Scan API |
| Holding fees (demurrage) | ~-9,000 | Residual (<0.3% of total) |
| **Balance** | **~0** | **Fully reconciled** |

All app rewards (2,804,520 CC) have been fully claimed into amulets — confirmed by summing `inputAppRewardAmount` across all transfer and traffic purchase events: 1,971,768 CC (via transfers) + 832,752 CC (via BuyMemberTraffic) = **2,804,520 CC exact**.

#### Transfer Fees Are Zero

The Canton Network protocol config confirms `transferFee.initialRate: "0E-10"` — transfer fees are zero by design. The `senderChangeFee` field in every sampled exercise result (self-transfers, consolidations, and external transfers to exchanges) is `0E-10`. No CC was burned by transfer fees.

#### Network Traffic Consumption (BuyMemberTraffic)

CoinAegis spent ~1.3M CC buying network bandwidth to sustain its high-volume transaction farming. The 1,929 `BuyMemberTraffic` events consumed CC from multiple sources:

| Input Source | CC |
|---|---:|
| Existing amulets (`inputAmuletAmount`) | 153,004,392 (recycled) |
| App reward coupons (`inputAppRewardAmount`) | 832,752 (freshly claimed) |
| Validator reward coupons (`inputValidatorRewardAmount`) | 159,401 (freshly claimed) |
| Validator faucet coupons (`inputValidatorFaucetAmount`) | 4 |
| **Total input** | **153,996,549** |
| Returned as change (`senderChangeAmount`) | -152,695,010 |
| **Net CC consumed for traffic** | **1,301,539** |

This reveals the circular farming scheme: self-transfers generate app activity markers → markers convert to app reward coupons → reward coupons are consumed during BuyMemberTraffic to purchase more network bandwidth → bandwidth enables more self-transfers.

#### On-Chain Activity (BigQuery-verified)

| Activity | Count | Notes |
|---|---:|---|
| `AmuletRules_Transfer` | 315,418 | 253,397 wash trades + 61,985 consolidations + 36 external |
| `AmuletRules_BuyMemberTraffic` | 1,929 | Consumed ~1.3M CC for network traffic |
| `AmuletRules_Fetch` | 1,929 | Config reads — does not consume CC |
| `AmuletRules_CreateTransferPreapproval` | 43 | Preapproving transfers |
| **Total on-chain actions (AmuletRules)** | **319,319** |

Of the 315,418 transfers:
- **253,397** (80.4%) were wash trades — sender and receiver both have the CoinAegis key
- **61,985** (19.6%) had NULL receivers — consolidation/merge-split operations
- **36** (0.01%) were genuine external transfers to 5 recipients (ByBit, Gate, quokka, and 2 intermediary wallets)

#### AppRewardCoupon Generation by Featured App (BigQuery-verified)

The wash trades generated AppRewardCoupons attributed to these FAs:

| FA (provider) | Coupons Created (CC) | Coupons Claimed (CC) | Unclaimed/Expired (CC) |
|---|---:|---:|---:|
| `aevumWallet` | 3,290,000 | ~1,970,000 | ~1,320,000 |
| `goldacorn` | 2,090,000 | 0 | 2,090,000 |
| `coinaegis` | 12,000 | ~12,000 | ~0 |
| `coinaegisVault` | 7,600 | ~7,600 | ~0 |
| **Total** | **~5,400,000** | **~2,804,520** | **~2,600,000** |

The Scan API's `v0/top-providers-by-app-rewards` attributes 2,598,114 CC to `cryptolegacy-validator-1` because that validator HARVESTED the rewards (via transfers and BuyMemberTraffic). The FAs that GENERATED the coupons were aevumWallet and goldacorn. Goldacorn's entire 2.09M CC in coupons expired unclaimed.

Note: the 2,804,520 CC total reflects **app rewards claimed into amulets**. Validator rewards (~268,325 CC harvested, ~292,000 CC earned) are separate. An additional ~2.6M CC in AppRewardCoupons were generated but expired unclaimed.

#### Key Entity: fba188

- **Full party ID:** `fba188::1220b5c7e1c4c31c691712a9e660bc611ad91ee0aad58580108db04b84b560b3aa31`
- **Hosted on:** ByBit-MainNetValidator-1 (confirmed by `provider` field in transfer payloads)
- **Status:** Reported frozen by ByBit
- **Received:** ~1,065,002 CC from CoinAegis (largest single recipient)

#### Key Entity: Gate

- **Full party ID:** `Gate::1220660fcee9042e5d36a50eccee8b6ff3e79cc3612ad41b7ec056c5c6cddacf864b`
- **Hosted on:** gate-mainnet-1
- **Received:** ~700,001 CC from CoinAegis

#### Key Entity: quokka-validator-1 (Intermediary)

- **Full party ID:** `quokka-validator-1::12200587db65aee55ac8d877208df0903c0dc9795909ee91347b0d1b6f7b43aa124e`
- **Role:** Intermediary/money mule — received 1,100,030 CC from CoinAegis on Apr 24-25, forwarded 1,100,003 CC to fba188 and Gate on Apr 25-26
- **Also controls auth0 parties** used as hop addresses:
  - `auth0_007c69ec1703012e7f3c0b7f056d::quokka-key` (forwarded 650,002 to fba188)
  - `auth0_007c69ebf59ab2450880196fff52::quokka-key` (forwarded 450,001 to Gate)

---

## Data Sources

All data queried from Canton Scan API and BigQuery on 2026-06-01:

**Canton Scan API:**
- `v0/round-of-latest-data` — current round (98443)
- `v0/featured-apps` — on-chain FA status (156 active)
- `v0/top-providers-by-app-rewards` — cumulative CC per provider
- `v0/admin/sv/voteresults` — governance vote history
- `v0/holdings/summary` — current wallet balances
- `v0/holdings/state` — active contract details
- `v0/round-party-totals` — per-round cumulative rewards timeline
- `v0/admin/validator/licenses` — ByBit node discovery (8 nodes confirmed)

**BigQuery (governence-483517.transformed.events_parsed):**
- Transfer tracing via `AmuletRules_Transfer` exercised events
- Fee verification via `exercise_result.summary.senderChangeFee` (confirmed zero)
- Reward harvesting via `exercise_result.summary.inputAppRewardAmount`, `inputValidatorRewardAmount`, `inputValidatorFaucetAmount`
- Traffic consumption via `AmuletRules_BuyMemberTraffic` input/output analysis
- Protocol config via `AmuletRules_Fetch` exercise results (`transferFee.initialRate: "0E-10"`, `holdingFee.rate: 0.0000190259`)
- Activity counts verified: `choice` column grouped by type, filtered on `acting_parties` containing CoinAegis key
- External recipient verification: `payload.transfer.outputs[0].receiver` grouped by receiver, excluding CoinAegis key
- Template: `c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules`
- Date range: 2026-04-20 to 2026-06-01, migration_id = 4
- Verification queries: `scripts/bigquery-fee-burn-verification.sql`

SV endpoints used: Cumberland (`scan.sv-1.global.canton.network.cumberland.io`)
