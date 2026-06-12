#!/usr/bin/env node

/**
 * CoinAegis Incident Audit — Post-Pause Mining & Transfer Investigation
 *
 * Investigates CoinAegis's activity after its Featured App (FA) rights were
 * paused/revoked. The same key fingerprint (1220...19c3) was used across
 * multiple party IDs to potentially continue mining CC and transferring
 * proceeds to exchanges (ByBit and others).
 *
 * Known party IDs sharing key 122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3:
 *   1. coinaegis                  — CoinAegis (FA approved 2026-04-20)
 *   2. coinaegisVault             — CoinAegis Vault (FA approved 2026-05-01)
 *   3. aevumWallet                — "Aevum Extension Wallet" (FA approved 2026-04-20)
 *   4. cryptolegacy-validator-1   — NOT in FA list (validator-only)
 *
 * Usage:
 *   node scripts/audit-coinaegis.mjs
 *   node scripts/audit-coinaegis.mjs --json          # machine-readable output
 *   node scripts/audit-coinaegis.mjs --verbose        # include raw API responses
 */

const SCAN_BASE =
  process.env.SCAN_URL ||
  'https://scan.sv-1.global.canton.network.sync.global/api/scan';

const SCAN_FALLBACKS = [
  SCAN_BASE,
  'https://scan.sv-1.global.canton.network.digitalasset.com/api/scan',
  'https://scan.sv-2.global.canton.network.digitalasset.com/api/scan',
  'https://scan.sv-1.global.canton.network.cumberland.io/api/scan',
  'https://scan.sv-1.global.canton.network.proofgroup.xyz/api/scan',
];

// ─── Known CoinAegis party IDs (same key fingerprint) ──────────────────────
const KEY_SUFFIX = '122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3';

const COINAEGIS_PARTIES = [
  {
    label: 'CoinAegis (primary FA)',
    partyId: `coinaegis::${KEY_SUFFIX}`,
    type: 'featured-app',
    faApproved: '2026-04-20',
  },
  {
    label: 'CoinAegis Vault',
    partyId: `coinaegisVault::${KEY_SUFFIX}`,
    type: 'featured-app',
    faApproved: '2026-05-01',
  },
  {
    label: 'Aevum Extension Wallet (same key as CoinAegis)',
    partyId: `aevumWallet::${KEY_SUFFIX}`,
    type: 'featured-app',
    faApproved: '2026-04-20',
  },
  {
    label: 'CryptoLegacy Validator (same key as CoinAegis)',
    partyId: `cryptolegacy-validator-1::${KEY_SUFFIX}`,
    type: 'validator',
    faApproved: null,
  },
];

// Known exchange party IDs for transfer tracking
const EXCHANGE_PARTIES = {
  'ByBit-MainNetValidator-1::12202c9fc5180723f14e87c88d316355817dd565afc2a897706a789086c33cd6a095': 'ByBit',
  'binance-dp-1': 'Binance',
  'kucoin-node-01': 'KuCoin',
  'mexc-mainNet-01': 'MEXC',
  'OKX-VALIDATOR-2': 'OKX',
  'kraken-validator-01': 'Kraken',
  'edx-validator-1': 'EDX Markets',
};

// ─── CLI flags ──────────────────────────────────────────────────────────────
const JSON_OUTPUT = process.argv.includes('--json');
const VERBOSE = process.argv.includes('--verbose');

function log(...args) { if (!JSON_OUTPUT) console.log(...args); }
function logErr(...args) { if (!JSON_OUTPUT) console.error(...args); }

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function scanRequest(method, path, body = null) {
  let lastErr = null;
  for (const base of SCAN_FALLBACKS) {
    try {
      const url = `${base}/${path}`;
      const opts = {
        method,
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      };
      if (body && (method === 'POST' || method === 'PUT')) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(url, opts);
      if (res.ok) return res.json();
      const text = await res.text().catch(() => '');
      if (res.status < 500) {
        lastErr = new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
        continue;
      }
      lastErr = new Error(`${method} ${path} -> ${res.status} from ${base}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`${method} ${path} -> all endpoints failed`);
}

function scanGet(path) { return scanRequest('GET', path); }
function scanPost(path, body) { return scanRequest('POST', path, body); }

function fmtCC(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(4)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(6);
}
function fmtDate(d) { return d ? new Date(d).toISOString().slice(0, 19) + 'Z' : 'N/A'; }

// ─── Phase 1: Governance — Find pause/revocation votes ──────────────────────

async function findGovernanceActions() {
  log('\n=== PHASE 1: Governance Actions (pause/revocation) ===\n');

  const results = { grantVotes: [], revokeVotes: [], pauseVotes: [], allVotesForParties: [] };

  // Search for GrantFeaturedAppRight votes for CoinAegis parties
  try {
    const grantData = await scanPost('v0/admin/sv/voteresults', {
      actionName: 'SRARC_GrantFeaturedAppRight',
      accepted: true,
      limit: 500,
    });
    const votes = grantData.dso_rules_vote_results || [];
    for (const vr of votes) {
      const actionValue = vr.request?.action?.value;
      const provider =
        actionValue?.dsoAction?.value?.provider ||
        actionValue?.provider ||
        (function deepFind(o, k) {
          if (!o || typeof o !== 'object') return undefined;
          if (k in o) return o[k];
          for (const v of Object.values(o)) { const f = deepFind(v, k); if (f !== undefined) return f; }
          return undefined;
        })(actionValue, 'provider');

      if (provider && provider.includes(KEY_SUFFIX)) {
        results.grantVotes.push({
          provider,
          appName: provider.split('::')[0],
          outcome: vr.outcome?.tag,
          completedAt: vr.completedAt || vr.completed_at,
          reason: vr.request?.reason?.body?.slice(0, 200),
        });
      }
    }
    log(`  Found ${results.grantVotes.length} GrantFeaturedAppRight votes for CoinAegis entities`);
    for (const v of results.grantVotes) {
      log(`    ${v.appName}: ${v.outcome} at ${fmtDate(v.completedAt)}`);
      if (v.reason) log(`      Reason: ${v.reason}`);
    }
  } catch (e) {
    logErr(`  Error fetching grant votes: ${e.message}`);
  }

  // Search for revocation / pause votes
  for (const actionName of [
    'SRARC_RevokeFeaturedAppRight',
    'SRARC_PauseFeaturedAppRight',
    'SRARC_SetFeaturedAppRight',
  ]) {
    try {
      const data = await scanPost('v0/admin/sv/voteresults', {
        actionName,
        accepted: true,
        limit: 500,
      });
      const votes = data.dso_rules_vote_results || [];
      for (const vr of votes) {
        const json = JSON.stringify(vr);
        if (json.includes(KEY_SUFFIX) || json.toLowerCase().includes('coinaegis') || json.toLowerCase().includes('aevum') || json.toLowerCase().includes('cryptolegacy')) {
          const entry = {
            actionName,
            outcome: vr.outcome?.tag,
            completedAt: vr.completedAt || vr.completed_at,
            reason: vr.request?.reason?.body?.slice(0, 300),
            raw: VERBOSE ? vr : undefined,
          };
          if (actionName.includes('Revoke')) results.revokeVotes.push(entry);
          else results.pauseVotes.push(entry);
        }
      }
      log(`  ${actionName}: ${votes.length} total, ${
        actionName.includes('Revoke') ? results.revokeVotes.length : results.pauseVotes.length
      } related to CoinAegis`);
    } catch (e) {
      logErr(`  ${actionName}: ${e.message}`);
    }
  }

  // Also search ALL vote results for any mention of these parties
  try {
    for (const accepted of [true, false]) {
      const data = await scanPost('v0/admin/sv/voteresults', {
        accepted,
        limit: 500,
      });
      const votes = data.dso_rules_vote_results || [];
      for (const vr of votes) {
        const json = JSON.stringify(vr);
        if (json.includes(KEY_SUFFIX) || json.toLowerCase().includes('coinaegis') || json.toLowerCase().includes('aevumwallet') || json.toLowerCase().includes('cryptolegacy')) {
          results.allVotesForParties.push({
            actionName: vr.request?.action?.tag || vr.request?.action?.value?.dsoAction?.tag || 'unknown',
            accepted,
            outcome: vr.outcome?.tag,
            completedAt: vr.completedAt || vr.completed_at,
            reason: vr.request?.reason?.body?.slice(0, 300),
          });
        }
      }
    }
    log(`\n  Total governance actions mentioning CoinAegis entities: ${results.allVotesForParties.length}`);
    for (const v of results.allVotesForParties) {
      log(`    [${v.accepted ? 'ACCEPTED' : 'REJECTED'}] ${v.actionName} at ${fmtDate(v.completedAt)}`);
      if (v.reason) log(`      ${v.reason.slice(0, 150)}`);
    }
  } catch (e) {
    logErr(`  Error searching all votes: ${e.message}`);
  }

  return results;
}

// ─── Phase 2: Check current FA status ───────────────────────────────────────

async function checkFeaturedAppStatus() {
  log('\n=== PHASE 2: Current Featured App Status ===\n');

  const results = { onChainFAs: [], removedFAs: [] };

  try {
    const faData = await scanGet('v0/featured-apps');
    const featuredApps = faData.featured_apps || [];
    log(`  Total on-chain Featured Apps: ${featuredApps.length}`);

    for (const party of COINAEGIS_PARTIES) {
      const match = featuredApps.find(a => {
        const provider = (a.payload || a).provider || a.provider;
        return provider === party.partyId;
      });
      if (match) {
        results.onChainFAs.push({ ...party, status: 'ACTIVE', contract: match });
        log(`  [ACTIVE] ${party.label}`);
      } else {
        results.removedFAs.push({ ...party, status: 'NOT_ON_CHAIN' });
        log(`  [NOT ON CHAIN] ${party.label}`);
      }
    }
  } catch (e) {
    logErr(`  Error: ${e.message}`);
  }

  return results;
}

// ─── Phase 3: Cumulative rewards per party ──────────────────────────────────

async function getCumulativeRewards() {
  log('\n=== PHASE 3: Cumulative Mining Rewards ===\n');

  const results = {};

  try {
    const latest = await scanGet('v0/round-of-latest-data');
    const latestRound = latest.round;
    log(`  Latest round: ${latestRound} (effective at ${fmtDate(latest.effectiveAt)})\n`);

    const topProviders = await scanGet(`v0/top-providers-by-app-rewards?round=${latestRound}&limit=1000`);
    const providers = topProviders.providersAndRewards || [];

    for (const party of COINAEGIS_PARTIES) {
      const match = providers.find(p => (p.provider || p.party) === party.partyId);
      const cumCC = match ? parseFloat(match.rewards || '0') : 0;
      results[party.partyId] = {
        label: party.label,
        cumulativeCC: cumCC,
        formattedCC: fmtCC(cumCC),
        inTopProviders: !!match,
      };
      log(`  ${party.label}`);
      log(`    Party ID: ${party.partyId.slice(0, 40)}...`);
      log(`    Cumulative CC mined: ${fmtCC(cumCC)} (${cumCC.toFixed(6)})`);
      log(`    In top providers: ${!!match}\n`);
    }

    const totalCC = Object.values(results).reduce((s, r) => s + r.cumulativeCC, 0);
    log(`  TOTAL CC mined across all CoinAegis entities: ${fmtCC(totalCC)} (${totalCC.toFixed(6)})\n`);
    results._total = totalCC;
  } catch (e) {
    logErr(`  Error: ${e.message}`);
  }

  return results;
}

// ─── Phase 4: Current holdings (what's still in the wallets) ────────────────

async function getCurrentHoldings() {
  log('\n=== PHASE 4: Current Holdings ===\n');

  const results = {};

  try {
    const latest = await scanGet('v0/round-of-latest-data');
    const effectiveAt = latest.effectiveAt;

    // Find snapshot timestamp
    let recordTime;
    for (const mid of [4, 3, 2, 1, 0]) {
      try {
        const snap = await scanGet(`v0/state/acs/snapshot-timestamp?before=${effectiveAt}&migration_id=${mid}`);
        if (snap.record_time) {
          recordTime = snap.record_time;
          results._migrationId = mid;
          results._recordTime = recordTime;
          log(`  Snapshot: migration_id=${mid}, record_time=${recordTime}\n`);
          break;
        }
      } catch {}
    }

    if (!recordTime) {
      logErr('  ERROR: Could not find usable ACS snapshot');
      return results;
    }

    const mid = results._migrationId;

    for (const party of COINAEGIS_PARTIES) {
      try {
        const holdingsResp = await scanPost('v0/holdings/summary', {
          migration_id: mid,
          record_time: recordTime,
          record_time_match: 'exact',
          owner_party_ids: [party.partyId],
        });

        const summary = (holdingsResp.summaries || [])[0] || null;

        if (summary) {
          results[party.partyId] = {
            label: party.label,
            totalUnlocked: summary.total_unlocked_coin,
            totalLocked: summary.total_locked_coin,
            totalHoldings: summary.total_coin_holdings,
            totalAvailable: summary.total_available_coin,
            holdingFees: summary.accumulated_holding_fees_total,
          };
          log(`  ${party.label}`);
          log(`    Holdings: ${summary.total_coin_holdings} CC`);
          log(`    Unlocked: ${summary.total_unlocked_coin} CC`);
          log(`    Locked:   ${summary.total_locked_coin} CC`);
          log(`    Available: ${summary.total_available_coin} CC\n`);
        } else {
          results[party.partyId] = { label: party.label, totalHoldings: '0', note: 'no holdings found' };
          log(`  ${party.label}: No holdings found\n`);
        }
      } catch (e) {
        logErr(`  ${party.label}: Error — ${e.message}`);
        results[party.partyId] = { label: party.label, error: e.message };
      }
    }
  } catch (e) {
    logErr(`  Error: ${e.message}`);
  }

  return results;
}

// ─── Phase 5: Transaction history — find transfers ──────────────────────────

async function getTransactionHistory() {
  log('\n=== PHASE 5: Transaction History (transfers) ===\n');

  const results = { transfersOut: [], transfersIn: [], mints: [], other: [] };
  let totalTransferred = 0;
  const transfersByReceiver = {};

  for (const party of COINAEGIS_PARTIES) {
    try {
      const txResp = await scanPost('v0/transactions/by-party', {
        party: party.partyId,
        limit: 500,
      });
      const txList = txResp.transactions || [];
      log(`  ${party.label}: ${txList.length} transactions`);

      for (const tx of txList) {
        const type = tx.transaction_type || '';
        if (type === 'transfer' && tx.transfer) {
          const senderParty = tx.transfer.sender?.party;
          const isCoinAegisSender = senderParty && senderParty.includes(KEY_SUFFIX);
          const receivers = (tx.transfer.receivers || []);

          for (const r of receivers) {
            const receiverParty = r.party || '';
            const amount = parseFloat(r.amount || '0');
            const isCoinAegisReceiver = receiverParty.includes(KEY_SUFFIX);
            const exchangeName = Object.entries(EXCHANGE_PARTIES)
              .find(([k]) => receiverParty.includes(k))?.[1] || null;
            const isExchange = !!exchangeName;

            if (isCoinAegisSender && !isCoinAegisReceiver) {
              totalTransferred += amount;
              const receiverKey = receiverParty.split('::')[0] || receiverParty;
              transfersByReceiver[receiverKey] = (transfersByReceiver[receiverKey] || 0) + amount;

              results.transfersOut.push({
                date: tx.date,
                from: party.label,
                fromParty: senderParty,
                toParty: receiverParty,
                toName: exchangeName || receiverKey,
                amount,
                isExchange,
              });
              log(`    [OUT] ${fmtDate(tx.date)}: ${fmtCC(amount)} CC -> ${exchangeName || receiverKey}${isExchange ? ' [EXCHANGE]' : ''}`);
            } else if (isCoinAegisReceiver && !isCoinAegisSender) {
              results.transfersIn.push({
                date: tx.date,
                fromParty: senderParty,
                to: party.label,
                amount,
              });
            }
          }
        } else if (type === 'mint' || type === 'tap') {
          const amount = parseFloat(tx.mint?.amulet_amount || tx.tap?.amulet_amount || '0');
          results.mints.push({ date: tx.date, type, party: party.label, amount });
        } else {
          results.other.push({ date: tx.date, type, party: party.label });
        }
      }
    } catch (e) {
      logErr(`  ${party.label}: ${e.message} (endpoint may not support transactions/by-party)`);
    }
  }

  results.totalTransferredOut = totalTransferred;
  results.transfersByReceiver = transfersByReceiver;

  log(`\n  TRANSFER SUMMARY:`);
  log(`    Total CC transferred OUT: ${fmtCC(totalTransferred)} (${totalTransferred.toFixed(6)})`);
  log(`    Outbound transfers: ${results.transfersOut.length}`);
  log(`    Inbound transfers: ${results.transfersIn.length}`);
  log(`    Mints/taps: ${results.mints.length}`);
  log(`\n  Transfers by receiver:`);
  for (const [receiver, amount] of Object.entries(transfersByReceiver).sort((a, b) => b[1] - a[1])) {
    const exch = Object.entries(EXCHANGE_PARTIES).find(([k]) => receiver.includes(k))?.[1];
    log(`    ${receiver}: ${fmtCC(amount)} CC${exch ? ` [${exch}]` : ''}`);
  }

  return results;
}

// ─── Phase 6: Ledger activity scan ──────────────────────────────────────────

async function scanLedgerActivity() {
  log('\n=== PHASE 6: Recent Ledger Activity (v2/updates) ===\n');

  const partyIds = COINAEGIS_PARTIES.map(p => p.partyId);
  const partySet = new Set(partyIds);
  const matchingEvents = [];
  let after = undefined;
  const MAX_PAGES = 20;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = { page_size: 100 };
    if (after) body.after = after;

    let resp;
    try {
      resp = await scanPost('v2/updates', body);
    } catch { break; }

    const txns = resp.transactions || [];
    if (txns.length === 0) break;

    for (const tx of txns) {
      const events = tx.events_by_id || {};
      for (const [eventId, ev] of Object.entries(events)) {
        const signatories = ev.signatories || [];
        const observers = ev.observers || [];
        const actingParties = ev.acting_parties || [];
        const allParties = [...signatories, ...observers, ...actingParties];

        if (allParties.some(p => partySet.has(p))) {
          matchingEvents.push({
            updateId: tx.update_id,
            recordTime: tx.record_time,
            effectiveAt: tx.effective_at,
            eventId,
            eventType: ev.event_type,
            templateId: ev.template_id,
            contractId: ev.contract_id,
            choice: ev.choice,
            consuming: ev.consuming,
            matchedParties: allParties.filter(p => partySet.has(p)),
          });
        }
      }
    }

    const lastTx = txns[txns.length - 1];
    if (lastTx) {
      after = {
        after_migration_id: lastTx.migration_id ?? 0,
        after_record_time: lastTx.record_time,
      };
    } else {
      break;
    }
  }

  log(`  Scanned ${MAX_PAGES} pages of updates`);
  log(`  Found ${matchingEvents.length} events involving CoinAegis entities\n`);

  // Categorize events
  const byTemplate = {};
  for (const ev of matchingEvents) {
    const tmpl = ev.templateId?.split(':').pop() || ev.choice || 'unknown';
    byTemplate[tmpl] = (byTemplate[tmpl] || 0) + 1;
  }

  log('  Events by template/type:');
  for (const [tmpl, count] of Object.entries(byTemplate).sort((a, b) => b[1] - a[1])) {
    log(`    ${tmpl}: ${count}`);
  }

  // Check for mining events after a certain date
  const rewardEvents = matchingEvents.filter(e =>
    (e.templateId || '').includes('AppRewardCoupon') ||
    (e.templateId || '').includes('ValidatorRewardCoupon')
  );
  const transferEvents = matchingEvents.filter(e =>
    (e.templateId || '').includes('Transfer') || e.choice === 'Transfer'
  );

  log(`\n  Reward coupons (mining): ${rewardEvents.length}`);
  log(`  Transfer events: ${transferEvents.length}`);

  if (rewardEvents.length > 0) {
    const earliest = rewardEvents.reduce((min, e) => !min || e.recordTime < min ? e.recordTime : min, null);
    const latest = rewardEvents.reduce((max, e) => !max || e.recordTime > max ? e.recordTime : max, null);
    log(`  Mining activity range: ${fmtDate(earliest)} to ${fmtDate(latest)}`);
  }

  return { matchingEvents, byTemplate, rewardEvents, transferEvents };
}

// ─── Phase 7: Round-party-totals timeline ───────────────────────────────────

async function getRewardsTimeline() {
  log('\n=== PHASE 7: Mining Rewards Timeline (per-round) ===\n');

  const results = {};

  try {
    const latest = await scanGet('v0/round-of-latest-data');
    const latestRound = latest.round;

    // Sample at intervals to build a timeline of cumulative CC for each party
    const samplePoints = [];
    const step = Math.max(500, Math.floor(latestRound / 40));
    for (let r = Math.max(0, latestRound - step * 40); r <= latestRound; r += step) {
      samplePoints.push(r);
    }
    if (!samplePoints.includes(latestRound)) samplePoints.push(latestRound);

    log(`  Sampling ${samplePoints.length} round ranges...`);

    for (const party of COINAEGIS_PARTIES) {
      results[party.partyId] = { label: party.label, timeline: [] };
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < samplePoints.length; i++) {
      const startRound = samplePoints[i];
      const endRound = Math.min(startRound + BATCH_SIZE - 1, latestRound);

      try {
        const rpt = await scanPost('v0/round-party-totals', { start_round: startRound, end_round: endRound });
        const entries = rpt.entries || [];

        for (const e of entries) {
          for (const party of COINAEGIS_PARTIES) {
            if (e.party === party.partyId) {
              results[party.partyId].timeline.push({
                round: e.closed_round,
                cumulativeCC: parseFloat(e.cumulative_app_rewards || '0'),
                cumulativeValidator: parseFloat(e.cumulative_validator_rewards || '0'),
              });
            }
          }
        }
      } catch {}
    }

    // Get round dates for key timeline points
    const roundsToDate = new Set();
    for (const party of COINAEGIS_PARTIES) {
      const tl = results[party.partyId].timeline;
      if (tl.length > 0) {
        roundsToDate.add(tl[0].round);
        roundsToDate.add(tl[tl.length - 1].round);
        // Add the round where CC first appeared
        const firstNonZero = tl.find(t => t.cumulativeCC > 0);
        if (firstNonZero) roundsToDate.add(firstNonZero.round);
      }
    }

    const roundDates = new Map();
    const roundsArr = [...roundsToDate].sort((a, b) => a - b);
    for (let i = 0; i < roundsArr.length; i += 50) {
      const batch = roundsArr.slice(i, i + 50);
      if (batch.length === 0) continue;
      try {
        const rt = await scanPost('v0/round-totals', { start_round: batch[0], end_round: batch[batch.length - 1] });
        for (const e of (rt.entries || [])) {
          if (e.closed_round != null && e.closed_round_effective_at) {
            roundDates.set(e.closed_round, e.closed_round_effective_at);
          }
        }
      } catch {}
    }

    // Print timeline summary
    for (const party of COINAEGIS_PARTIES) {
      const tl = results[party.partyId].timeline.sort((a, b) => a.round - b.round);
      if (tl.length === 0) {
        log(`  ${party.label}: No round-party-totals data found`);
        continue;
      }

      const first = tl[0];
      const last = tl[tl.length - 1];
      const firstDate = roundDates.get(first.round) || 'unknown';
      const lastDate = roundDates.get(last.round) || 'unknown';
      const firstNonZero = tl.find(t => t.cumulativeCC > 0);

      log(`\n  ${party.label}:`);
      log(`    Data range: round ${first.round} (${fmtDate(firstDate)}) to round ${last.round} (${fmtDate(lastDate)})`);
      log(`    First rewards at: round ${firstNonZero?.round || 'N/A'} (${fmtDate(roundDates.get(firstNonZero?.round))})`);
      log(`    Cumulative app rewards: ${fmtCC(last.cumulativeCC)}`);
      log(`    Cumulative validator rewards: ${fmtCC(last.cumulativeValidator)}`);

      // Show timeline snapshots
      const keyPoints = tl.filter((_, idx) => idx === 0 || idx === tl.length - 1 || idx % Math.max(1, Math.floor(tl.length / 5)) === 0);
      for (const pt of keyPoints) {
        log(`    Round ${pt.round}: appCC=${fmtCC(pt.cumulativeCC)}, valCC=${fmtCC(pt.cumulativeValidator)}`);
      }
    }
  } catch (e) {
    logErr(`  Error: ${e.message}`);
  }

  return results;
}

// ─── Phase 8: Cross-reference with validator licenses ───────────────────────

async function checkValidatorLicenses() {
  log('\n=== PHASE 8: Validator License Check ===\n');

  const results = [];

  try {
    // Check if cryptolegacy-validator-1 has a validator license
    // The validator list is available via the DSO endpoint
    const dsoData = await scanGet('v0/dso');
    const svPartyId = dsoData?.sv_party_id;
    log(`  DSO party: ${svPartyId ? svPartyId.slice(0, 30) + '...' : 'unknown'}`);

    // Try to find validator info
    for (const party of COINAEGIS_PARTIES) {
      if (party.type === 'validator') {
        log(`  Checking validator status for: ${party.label}`);
        log(`    Party: ${party.partyId.slice(0, 50)}...`);

        // Try holdings to see if this validator has any balance
        try {
          const latest = await scanGet('v0/round-of-latest-data');
          const topProviders = await scanGet(`v0/top-providers-by-app-rewards?round=${latest.round}&limit=2000`);
          const match = (topProviders.providersAndRewards || []).find(p =>
            (p.provider || p.party) === party.partyId
          );
          if (match) {
            results.push({ ...party, inRewards: true, rewards: match.rewards });
            log(`    In top providers: YES, rewards=${match.rewards}`);
          } else {
            results.push({ ...party, inRewards: false });
            log(`    In top providers: NO`);
          }
        } catch {}
      }
    }
  } catch (e) {
    logErr(`  Error: ${e.message}`);
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const auditTime = new Date().toISOString();

  log('================================================================');
  log('  COINAEGIS INCIDENT AUDIT — Post-Pause Mining Investigation');
  log(`  Run at: ${auditTime}`);
  log(`  Scan API: ${SCAN_BASE}`);
  log('================================================================');
  log(`\n  Key fingerprint: ${KEY_SUFFIX}`);
  log(`  Known entities with this key:`);
  for (const p of COINAEGIS_PARTIES) {
    log(`    - ${p.label} (${p.type}, FA: ${p.faApproved || 'N/A'})`);
  }

  const governance = await findGovernanceActions();
  const faStatus = await checkFeaturedAppStatus();
  const rewards = await getCumulativeRewards();
  const holdings = await getCurrentHoldings();
  const transactions = await getTransactionHistory();
  const ledgerActivity = await scanLedgerActivity();
  const timeline = await getRewardsTimeline();
  const validators = await checkValidatorLicenses();

  // ── Final report ──
  log('\n================================================================');
  log('  AUDIT FINDINGS SUMMARY');
  log('================================================================');

  log('\n  1. ENTITIES (same key fingerprint):');
  for (const p of COINAEGIS_PARTIES) {
    const fa = faStatus.onChainFAs.find(f => f.partyId === p.partyId);
    const r = rewards[p.partyId];
    const h = holdings[p.partyId];
    log(`\n    ${p.label}`);
    log(`      FA Status: ${fa ? 'STILL ACTIVE' : 'NOT ON CHAIN (paused/revoked)'}`);
    log(`      Cumulative CC Mined: ${r ? r.formattedCC : 'unknown'}`);
    log(`      Current Holdings: ${h?.totalHoldings || h?.totalAvailable || 'unknown'} CC`);
  }

  log('\n  2. MINING TOTALS:');
  log(`    Total CC mined (all entities): ${fmtCC(rewards._total || 0)}`);

  log('\n  3. TRANSFERS:');
  log(`    Total CC transferred OUT: ${fmtCC(transactions.totalTransferredOut || 0)}`);
  log(`    Outbound transfers: ${transactions.transfersOut.length}`);
  if (Object.keys(transactions.transfersByReceiver || {}).length > 0) {
    log('    By receiver:');
    for (const [r, amt] of Object.entries(transactions.transfersByReceiver).sort((a, b) => b[1] - a[1])) {
      const exch = Object.entries(EXCHANGE_PARTIES).find(([k]) => r.includes(k))?.[1];
      log(`      ${r}: ${fmtCC(amt)} CC${exch ? ` [${exch}]` : ''}`);
    }
  }

  log('\n  4. GOVERNANCE TIMELINE:');
  log(`    Grant votes: ${governance.grantVotes.length}`);
  log(`    Revoke votes: ${governance.revokeVotes.length}`);
  log(`    Pause votes: ${governance.pauseVotes.length}`);
  log(`    All related governance actions: ${governance.allVotesForParties.length}`);

  log('\n  5. ILLEGAL MINING ESTIMATE:');
  log('    (Requires identifying the exact pause date and calculating rewards');
  log('    earned after that date — see timeline data in Phase 7 above)');

  log('\n================================================================');

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      auditTime,
      keyFingerprint: KEY_SUFFIX,
      parties: COINAEGIS_PARTIES,
      governance,
      faStatus,
      rewards,
      holdings,
      transactions: {
        ...transactions,
        transfersOut: transactions.transfersOut,
      },
      ledgerActivity: {
        totalEvents: ledgerActivity.matchingEvents.length,
        byTemplate: ledgerActivity.byTemplate,
        rewardEvents: ledgerActivity.rewardEvents.length,
        transferEvents: ledgerActivity.transferEvents.length,
      },
      timeline,
      validators,
    }, null, 2));
  }
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(2);
});
