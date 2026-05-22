#!/usr/bin/env node

/**
 * Featured Apps Report Generator (Local / Internal Use)
 *
 * Queries Canton Scan API directly to produce a detailed report of:
 * - All Featured Apps with cumulative CC mined
 * - FA approval dates (from on-chain vote results)
 * - Precise milestone tracking: days from FA approval to $10M / $25M CC
 * - CIP Locking readiness assessment
 *
 * Usage:
 *   node scripts/featured-apps-report.mjs
 *   node scripts/featured-apps-report.mjs --json
 *   node scripts/featured-apps-report.mjs --csv
 *   node scripts/featured-apps-report.mjs --debug
 *   SCAN_URL=https://... node scripts/featured-apps-report.mjs
 *
 * Data sources (all from Canton Scan API):
 *   GET  /v0/featured-apps                      → current on-chain FAs
 *   GET  /v0/round-of-latest-data               → latest round number
 *   GET  /v0/top-providers-by-app-rewards       → cumulative CC per provider
 *   POST /v0/admin/sv/voteresults               → FA approval dates
 *   POST /v0/round-totals                       → round timestamps (date mapping)
 *   POST /v0/round-party-totals                 → per-party cumulative CC at a round
 */

const SCAN_BASE =
  process.env.SCAN_URL ||
  'https://scan.sv-1.global.canton.network.sync.global/api/scan';

// Fallback SV endpoints for retrying on 503/5xx errors
const SCAN_FALLBACKS = [
  SCAN_BASE,
  'https://scan.sv-1.global.canton.network.digitalasset.com/api/scan',
  'https://scan.sv-2.global.canton.network.digitalasset.com/api/scan',
  'https://scan.sv-1.global.canton.network.cumberland.io/api/scan',
  'https://scan.sv-1.global.canton.network.proofgroup.xyz/api/scan',
];

const THRESHOLDS = {
  LOCK_AMOUNT: 25_000_000,
  MILESTONE_10M: 10_000_000,
  MILESTONE_25M: 25_000_000,
};

// ─── HTTP helpers ───────────────────────────────────────────────────────────

/** Make a request with automatic fallback across SV endpoints on 5xx errors. */
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
        throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
      }
      // 5xx — try next endpoint
      lastErr = new Error(`${method} ${path} → ${res.status} from ${base}`);
    } catch (e) {
      lastErr = e;
      // If it's a client error (4xx) we already threw above, so this is network/5xx — continue
    }
  }
  throw lastErr || new Error(`${method} ${path} → all endpoints failed`);
}

function scanGet(path) { return scanRequest('GET', path); }
function scanPost(path, body) { return scanRequest('POST', path, body); }

// ─── Parsing helpers ────────────────────────────────────────────────────────

/** Parse Canton/DAML timestamps (string, microsecondsSinceEpoch, {seconds,nanos}). */
function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') { const d = new Date(value); return isNaN(d) ? null : d.toISOString(); }
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'object') {
    if (value.microsecondsSinceEpoch != null) {
      const m = Number(value.microsecondsSinceEpoch);
      if (!isNaN(m)) return new Date(m / 1000).toISOString();
    }
    if (value.seconds != null) {
      const s = Number(value.seconds), n = value.nanos ? Number(value.nanos) : 0;
      if (!isNaN(s)) return new Date(s * 1000 + Math.floor(n / 1e6)).toISOString();
    }
    if (value.unixtime != null) { const s = Number(value.unixtime); if (!isNaN(s)) return new Date(s * 1000).toISOString(); }
    if (typeof value.value === 'string') return parseTimestamp(value.value);
  }
  return null;
}

/** Deep-search a JSON value for a key. */
function deepFind(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) { const f = deepFind(v, key); if (f !== undefined) return f; }
  return undefined;
}

// ─── Company name extraction ────────────────────────────────────────────────

// Fallback overrides for cases where reason.body doesn't contain the company name
// or is too ambiguous to parse. Keyed by app name (provider prefix before ::).
const COMPANY_OVERRIDES = {
  '3trade_validator_admin': '3Trade',
  'Cumberland-GasStation-1': 'Cumberland',
  'IntellectEU-validator-1': 'IntellectEU',
  'nodetech-mainnet-1': 'NodeTech',
  'Fairmint-validator-1': 'Fairmint',
  'Bridge-Operator': 'USDC Bridge',
  'dfns1': 'Dfns',
  'handlpay-main-1': 'HandlPay',
  'elk-Validator-2': 'TRNGLE',
  'fulcrum-point': 'SciFeCap',
  'SatsTerminal-main-1': 'OneSwap',
  'CopperClearLoop': 'Copper',
  'CopperWrappedAssets': 'Copper',
  'CoinMetrics-validator-1': 'CoinMetrics',
  'Tokino-validator-1': 'Tokino',
  'Thetamarkets': 'Thetamarkets',
  'twmain-treasury-1': 'Tradeweb',
  'HeliosFinance-Mainnet-1': 'Helios',
  'mexc-mainNet-01': 'MEXC',
  'lithiumdigital-validator-1': 'Lithium Digital',
  'Tradecraft': 'Tradecraft',
  'blackmantacapital-primary-1': 'Black Manta Capital',
  'TextureCapital-validator-1': 'Texture Capital',
  '23d169c2-0909-4c70-81d1-1922': 'Copper',
  'auth0_007c691c4d28726455d23d': 'Axymos',
};

/**
 * Best-effort extraction of company/app name from a vote result reason.body.
 * Returns { name, snippet } or { name: null, snippet }.
 */
function extractCompanyName(reasonBody, appName) {
  if (!reasonBody && !appName) return { name: null, snippet: '' };

  // Check overrides first
  if (appName && COMPANY_OVERRIDES[appName]) {
    const text = (reasonBody || '').trim();
    const sentenceEnd = text.search(/(?<=[.!?])\s/);
    const snippet = sentenceEnd > 0 ? text.slice(0, sentenceEnd + 1).trim() : text;
    return { name: COMPANY_OVERRIDES[appName], snippet };
  }

  if (!reasonBody) return { name: null, snippet: '' };
  const text = reasonBody.trim();
  // Extract the first sentence for the note column
  const sentenceEnd = text.search(/(?<=[.!?])\s/);
  const snippet = sentenceEnd > 0 ? text.slice(0, sentenceEnd + 1).trim() : text;

  // Clean up an extracted name: strip possessive suffixes, trailing prepositions, etc.
  function clean(raw) {
    let name = raw
      .replace(/['']s\s+App$/i, '')
      .replace(/'s App$/i, '')
      .replace(/\s+app$/i, '')
      .replace(/\s+by\s+.+$/i, '')
      .trim();
    // Strip leading "The" only when followed by a multi-word phrase (article, not part of name)
    // Keep it for short names like "The Tie"
    if (/^The\s+/i.test(name) && name.split(/\s+/).length > 2) {
      name = name.replace(/^The\s+/i, '');
    }
    return name;
  }

  // ── Tokenomics reinstatement pattern ──────────────────────────────────
  // “Tokenomics has agreed to reinstate the FA rights for the {Name} app”
  const reinstateMatch = text.match(/reinstate the FA rights for the (.+?)(?:\s+app\b)/i);
  if (reinstateMatch) return { name: clean(reinstateMatch[1]), snippet };

  // ── Indirect patterns (name is NOT at the start) ──────────────────────

  // “Grant Feature App right to {Name}'s app ...”
  const grantToMatch = text.match(/^Grant (?:Feature|featured)(?: App)? (?:right|rights) to (.+?)(?:'s|['']s)\s/i);
  if (grantToMatch) return { name: clean(grantToMatch[1]), snippet };

  // “Grant Feature App right to {Name} “{AppName}” per ...”
  const grantToQuotedMatch = text.match(/^Grant (?:Feature|featured)(?: App)? (?:right|rights) to (.+?)\s*[“””]/i);
  if (grantToQuotedMatch) {
    const extracted = clean(grantToQuotedMatch[1]).replace(/\s*[“”“”].*$/, '').trim();
    return { name: extracted, snippet };
  }

  // “Grant featured app rights to {Name} app ...” / “Grant feature app right for the new {Name} app”
  const grantToAppMatch = text.match(/^Grant (?:Feature|featured)(?: App)? (?:right|rights) (?:to|for the new|for) (.+?)(?:\s+app\b|\s+per\b|\s*$)/i);
  if (grantToAppMatch) return { name: clean(grantToAppMatch[1]), snippet };

  // “A second PartyID has been approved for {Name}'s ...”
  const secondPartyMatch = text.match(/PartyID (?:has been|was) approved for (.+?)(?:'s|['']s)\s/i);
  if (secondPartyMatch) return { name: clean(secondPartyMatch[1]), snippet };

  // “This is the provider party for the {Name} app”
  const providerPartyMatch = text.match(/provider party for (?:the )?(.+?)(?:\s+app\b|[;.,])/i);
  if (providerPartyMatch) return { name: clean(providerPartyMatch[1]), snippet };

  // “This vote corrects the ... for the {Name} ...” or “...PartyID for the {Name} ...”
  const correctsMatch = text.match(/(?:corrects|updates|fixes).*?(?:for|of) (?:the )?(.+?)(?:\s+(?:app|wallet|platform|Vault)\b|[;.,]|\s+(?:C8|FA)\b)/i);
  if (correctsMatch) return { name: clean(correctsMatch[1]), snippet };

  // “Featuring the party for {Name} ...”
  const featuringPartyMatch = text.match(/^Featuring the (?:party|decentralized party) for (.+?)(?:[;.,]|\s*$)/i);
  if (featuringPartyMatch) return { name: clean(featuringPartyMatch[1]), snippet };

  // “Featuring the {Name} application from {Company}”
  const featuringAppMatch = text.match(/^Featuring the (.+?) application/i);
  if (featuringAppMatch) return { name: clean(featuringAppMatch[1]), snippet };

  // “Corrected proposal to feature {Name}'s ...”
  const correctedFeatureMatch = text.match(/proposal to feature (.+?)(?:'s|['']s)\s/i);
  if (correctedFeatureMatch) return { name: clean(correctedFeatureMatch[1]), snippet };

  // “Corrected vote provide featured app status to {Name}'s ...”
  const correctedVoteMatch = text.match(/(?:vote|proposal)\s+provide\s+featured app status to (.+?)(?:'s|['']s)\s/i);
  if (correctedVoteMatch) return { name: clean(correctedVoteMatch[1]), snippet };

  // “Proposal to feature the {Name} by ...”
  const proposalMatch = text.match(/proposal to feature (?:the )?(.+?) by /i);
  if (proposalMatch) return { name: clean(proposalMatch[1]), snippet };

  // “{Requester} requests approval to feature {Name} ...”
  const requestsApprovalMatch = text.match(/requests approval to feature (.+?)(?:\s+(?:App|on)\b|[;.,])/i);
  if (requestsApprovalMatch) return { name: clean(requestsApprovalMatch[1]), snippet };

  // “feature the {Name} ...” (generic)
  const featureTheMatch = text.match(/feature the (.+?)(?:\s+(?:app|per|from)\b|[;.,(\[])/i);
  if (featureTheMatch && featureTheMatch[1].length < 40) return { name: clean(featureTheMatch[1]), snippet };

  // “{Thing} by {Name} are ...” (e.g., “Data by Kaiko are key...”)
  const byNameMatch = text.match(/^\w+ by (.+?) (?:are|is|has|was)\b/i);
  if (byNameMatch) return { name: clean(byNameMatch[1]), snippet };

  // “In a meeting ... {Name} received ...”
  const meetingReceivedMatch = text.match(/(?:meeting|committee).*?\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)\s+received/i);
  if (meetingReceivedMatch) return { name: clean(meetingReceivedMatch[1]), snippet };

  // “Following the review period...” — extract from later mention: “...the {Name} app...”
  const followingMatch = text.match(/^Following\b.*?\bthe\s+(.+?)\s+(?:app|application|platform)\b/i);
  if (followingMatch) return { name: clean(followingMatch[1]), snippet };

  // ── Direct patterns (name IS at the start) ────────────────────────────

  // “New partyID for {Name}. ...”
  const newPartyMatch = text.match(/^New partyID for ([^.,]+)/i);
  if (newPartyMatch) return { name: clean(newPartyMatch[1]), snippet };

  // “{Name}'s App has been...” / “{Name}'s App is approved...”
  const possessiveAppMatch = text.match(/^(.+?)(?:'s|['']s|s') App\b/i);
  if (possessiveAppMatch) return { name: clean(possessiveAppMatch[1]), snippet };

  // “{Name}'s vision is...” / “{Name}'s app has...” (possessive + other nouns)
  const possessiveMatch = text.match(/^(.+?)(?:'s|['']s)\s+(?:vision|app|support|wallet|platform)\b/i);
  if (possessiveMatch) return { name: clean(possessiveMatch[1]), snippet };

  // “{Name} App is approved...”
  const appApprovedMatch = text.match(/^(.+?) App is approved/i);
  if (appApprovedMatch) return { name: clean(appApprovedMatch[1]), snippet };

  // “{Name} is approved for...”
  const isApprovedMatch = text.match(/^(.+?) is approved/i);
  if (isApprovedMatch) return { name: clean(isApprovedMatch[1]), snippet };

  // “{Name} is granted...”
  const isGrantedMatch = text.match(/^(.+?) is granted/i);
  if (isGrantedMatch) return { name: clean(isGrantedMatch[1]), snippet };

  // “{Name} has been restored...”
  const restoredMatch = text.match(/^(.+?) has been restored/i);
  if (restoredMatch) return { name: clean(restoredMatch[1]), snippet };

  // “{Name} has been pre-approved...” / “{Name} has been approved...”
  const preApprovedMatch = text.match(/^(.+?) has been (?:pre-)?approved/i);
  if (preApprovedMatch && preApprovedMatch[1].length < 40) return { name: clean(preApprovedMatch[1]), snippet };

  // “{Name} has created...” / “{Name} has ...”
  const hasMatch = text.match(/^(.+?) has /i);
  if (hasMatch && hasMatch[1].length < 40) return { name: clean(hasMatch[1]), snippet };

  // “{Name} would like...”
  const wouldMatch = text.match(/^(.+?) would like/i);
  if (wouldMatch) return { name: clean(wouldMatch[1]), snippet };

  // “{Name} lets users...” / “{Name} lets ...”
  const letsMatch = text.match(/^(.+?) lets /i);
  if (letsMatch) return { name: clean(letsMatch[1]), snippet };

  // “{Name} (by {Company})” — parenthetical company
  const parenMatch = text.match(/^(.+?)\s*\(/i);
  if (parenMatch && parenMatch[1].length < 40 && parenMatch[1].length >= 3) {
    return { name: clean(parenMatch[1]), snippet };
  }

  // “{Name} is a ...” (description pattern)
  const isAMatch = text.match(/^(.+?) is a /i);
  if (isAMatch && isAMatch[1].length < 40) return { name: clean(isAMatch[1]), snippet };

  // “{Name} is the ...”
  const isTheMatch = text.match(/^(.+?) is the /i);
  if (isTheMatch && isTheMatch[1].length < 40) return { name: clean(isTheMatch[1]), snippet };

  // “{Name} is expanding...” / “{Name} is ...” + gerund
  const isGerundMatch = text.match(/^(.+?) is \w+ing\b/i);
  if (isGerundMatch && isGerundMatch[1].length < 40) return { name: clean(isGerundMatch[1]), snippet };

  // “{Name} - the ...” (dash separator, e.g., “Supanova - the consumer superapp”)
  const dashMatch = text.match(/^(.+?)\s+[-–—]\s+/);
  if (dashMatch && dashMatch[1].length < 40) return { name: clean(dashMatch[1]), snippet };

  // “{Name} – ...” (em-dash without spaces, e.g., “PropNotary – Trusted Document”)
  const emDashMatch = text.match(/^(.+?)\s*[–—]\s*/);
  if (emDashMatch && emDashMatch[1].length < 40 && emDashMatch[1].length >= 3) {
    return { name: clean(emDashMatch[1]), snippet };
  }

  // “{Name} tokenizes...” / “{Name} enables...” / etc.
  const verbMatch = text.match(/^(.+?) (?:tokenizes|enables|creates|records|manages|provides|offers|connects|partners|brings|serves|presents|operates|plans|will|calculates|acting|acts|changes|proposes|received)/i);
  if (verbMatch && verbMatch[1].length < 40) return { name: clean(verbMatch[1]), snippet };

  // “{Name} operating ...”
  const operatingMatch = text.match(/^(.+?) operating /i);
  if (operatingMatch && operatingMatch[1].length < 40) return { name: clean(operatingMatch[1]), snippet };

  // Fallback: take first sentence fragment before common delimiters
  const fallback = text.match(/^([A-Z][A-Za-z0-9 .-]+?)(?:\s+(?:is|has|was|lets|would|App)\b|[,.])/);
  if (fallback && fallback[1].length >= 3 && fallback[1].length < 40) {
    return { name: clean(fallback[1]), snippet };
  }

  return { name: null, snippet };
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function fmtCC(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}
function fmtDate(d) { return d ? new Date(d).toISOString().slice(0, 10) : 'Unknown'; }
function daysBetween(a, b) { if (!a || !b) return null; return Math.floor((new Date(b) - new Date(a)) / 86_400_000); }
function pad(s, len, align = 'left') { const str = String(s); return align === 'right' ? str.padStart(len) : str.padEnd(len); }

// ─── Round-party-totals: get a provider's cumulative CC at a specific round ─

/**
 * Fetch cumulative_app_rewards for `provider` at or near `round`.
 * Requests a small window and returns the best match.
 * Returns { round, cumCC } or null.
 */
async function getCumulativeAtRound(provider, targetRound, windowSize = 10) {
  const start = Math.max(0, targetRound - windowSize + 1);
  const end = targetRound;
  try {
    const rpt = await scanPost('v0/round-party-totals', { start_round: start, end_round: end });
    const entries = (rpt.entries || [])
      .filter(e => e.party === provider)
      .sort((a, b) => b.closed_round - a.closed_round); // latest first
    if (entries.length === 0) return null;
    return { round: entries[0].closed_round, cumCC: parseFloat(entries[0].cumulative_app_rewards || '0') };
  } catch { return null; }
}

/**
 * Binary search for the first round where provider's cumulative CC >= threshold.
 * Returns the round number, or null if not found.
 */
async function binarySearchMilestone(provider, threshold, lowRound, highRound) {
  let lo = lowRound, hi = highRound, bestRound = null;

  // Limit iterations to prevent runaway
  for (let iter = 0; iter < 20 && lo <= hi; iter++) {
    const mid = Math.floor((lo + hi) / 2);
    const result = await getCumulativeAtRound(provider, mid, 10);

    if (!result) {
      // No data at this round — try a wider window, or move right
      const wider = await getCumulativeAtRound(provider, mid, 50);
      if (!wider) { lo = mid + 1; continue; }
      if (wider.cumCC >= threshold) { bestRound = wider.round; hi = wider.round - 1; }
      else { lo = wider.round + 1; }
      continue;
    }

    if (result.cumCC >= threshold) {
      bestRound = result.round;
      hi = result.round - 1;
    } else {
      lo = result.round + 1;
    }
  }
  return bestRound;
}

// ─── Round-totals: map round numbers to dates ───────────────────────────────

/**
 * Fetch dates for a set of round numbers using v0/round-totals.
 * Returns Map<roundNumber, isoDateString>.
 * round-totals also has a 50-round-per-request limit.
 */
async function fetchRoundDates(roundNumbers) {
  if (roundNumbers.length === 0) return new Map();
  const unique = [...new Set(roundNumbers)].sort((a, b) => a - b);
  const dateMap = new Map();

  // Batch into groups of up to 50 contiguous rounds
  const batches = [];
  let i = 0;
  while (i < unique.length) {
    const batchStart = unique[i];
    let batchEnd = batchStart;
    let j = i + 1;
    while (j < unique.length && unique[j] - batchStart < 50) {
      batchEnd = unique[j];
      j++;
    }
    batches.push({ start_round: batchStart, end_round: batchEnd });
    i = j;
  }

  const CONCURRENCY = 5;
  for (let b = 0; b < batches.length; b += CONCURRENCY) {
    const chunk = batches.slice(b, b + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(batch => scanPost('v0/round-totals', batch).catch(e => {
        console.error(`    ⚠ round-totals ${batch.start_round}-${batch.end_round}: ${e.message}`);
        return { entries: [] };
      }))
    );
    for (const rt of results) {
      for (const e of (rt.entries || [])) {
        if (e.closed_round != null && e.closed_round_effective_at) {
          dateMap.set(e.closed_round, e.closed_round_effective_at);
        }
      }
    }
  }
  return dateMap;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const flags = new Set(process.argv.slice(2));
  const wantJson = flags.has('--json');
  const wantCsv = flags.has('--csv');
  const debug = flags.has('--debug');

  console.error(`Scan API: ${SCAN_BASE}`);
  console.error('Fetching data...\n');

  // ── Phase 1: Fetch core data sources in parallel ──────────────────────────

  const [featuredAppsData, latestRoundData, voteResultsData, topProvidersRaw] =
    await Promise.all([
      scanGet('v0/featured-apps').catch(e => { console.error(`  ⚠ featured-apps: ${e.message}`); return { featured_apps: [] }; }),
      scanGet('v0/round-of-latest-data').catch(e => { console.error(`  ⚠ latest-round: ${e.message}`); return { round: 0 }; }),
      scanPost('v0/admin/sv/voteresults', { actionName: 'SRARC_GrantFeaturedAppRight', accepted: true, limit: 500 })
        .catch(e => { console.error(`  ⚠ vote-results: ${e.message}`); return { dso_rules_vote_results: [] }; }),
      (async () => {
        try {
          const latest = await scanGet('v0/round-of-latest-data');
          return scanGet(`v0/top-providers-by-app-rewards?round=${latest.round}&limit=1000`);
        } catch (e) { console.error(`  ⚠ top-providers: ${e.message}`); return { providersAndRewards: [] }; }
      })(),
    ]);

  const featuredApps = featuredAppsData.featured_apps || [];
  const voteResults = voteResultsData.dso_rules_vote_results || [];
  const topProviders = topProvidersRaw.providersAndRewards || [];
  const latestRound = latestRoundData.round || 0;

  console.error(`  Featured Apps: ${featuredApps.length}`);
  console.error(`  Vote results (GrantFeaturedAppRight): ${voteResults.length}`);
  console.error(`  Top providers: ${topProviders.length}`);
  console.error(`  Latest round: ${latestRound}\n`);

  // ── Build provider → cumulative rewards map ───────────────────────────────

  const rewardsByProvider = new Map();
  for (const p of topProviders) {
    const provider = p.provider || p.party;
    if (provider) rewardsByProvider.set(provider, parseFloat(p.rewards || '0'));
  }

  // ── Build provider → approval date from vote results ──────────────────────

  if (debug && voteResults.length > 0) {
    const sample = voteResults.find(vr => vr.outcome?.tag === 'VRO_Accepted') || voteResults[0];
    console.error('  [DEBUG] Sample vote result structure:');
    console.error('    action.tag:', sample.request?.action?.tag);
    console.error('    dsoAction.tag:', sample.request?.action?.value?.dsoAction?.tag);
    console.error('    provider:', sample.request?.action?.value?.dsoAction?.value?.provider);
    console.error('    completedAt:', sample.completedAt || sample.completed_at);
    console.error();
  }

  const approvalByProvider = new Map();
  const reasonByProvider = new Map();
  let vrAccepted = 0, vrProviderFound = 0;
  for (const vr of voteResults) {
    try {
      if (vr.outcome?.tag !== 'VRO_Accepted') continue;
      vrAccepted++;

      const actionValue = vr.request?.action?.value;
      let provider =
        actionValue?.dsoAction?.value?.provider ||
        actionValue?.provider ||
        actionValue?.amuletRulesAction?.value?.provider ||
        deepFind(actionValue, 'provider');
      if (!provider) continue;
      vrProviderFound++;

      const completedAt =
        parseTimestamp(vr.completedAt) ||
        parseTimestamp(vr.completed_at) ||
        parseTimestamp(vr.request?.completed_at);
      if (!completedAt) continue;

      const existing = approvalByProvider.get(provider);
      if (!existing || new Date(completedAt) < new Date(existing)) {
        approvalByProvider.set(provider, completedAt);
      }

      // Capture reason.body for company name extraction (prefer earliest/first grant)
      if (!reasonByProvider.has(provider)) {
        reasonByProvider.set(provider, vr.request?.reason?.body || '');
      }
    } catch { /* skip */ }
  }

  console.error(`  Vote results accepted: ${vrAccepted}, provider extracted: ${vrProviderFound}`);
  console.error(`  Approval dates matched: ${approvalByProvider.size}\n`);

  // ── Phase 2: Coarse sampling to identify milestone ranges ─────────────────
  //
  // round-party-totals has cumulative_app_rewards per party per round, but
  // NO date field. round-totals has dates but is aggregate (not per-party).
  // Strategy:
  //   1. Sample round-party-totals broadly → find approximate crossing ranges
  //   2. Binary search within those ranges → find exact crossing rounds
  //   3. Fetch round-totals for those rounds → get dates

  // Build list of FA providers we care about (those that have reached a milestone)
  const faProviders = new Set(
    featuredApps.map(a => (a.payload || a).provider || a.provider).filter(Boolean)
  );

  // Track: provider → { belowRound10m, aboveRound10m, belowRound25m, aboveRound25m }
  // "below" = last sampled round where cumCC < threshold
  // "above" = first sampled round where cumCC >= threshold
  const searchRanges = new Map();
  for (const provider of faProviders) {
    const cum = rewardsByProvider.get(provider) || 0;
    searchRanges.set(provider, {
      above10m: cum >= THRESHOLDS.MILESTONE_10M,
      above25m: cum >= THRESHOLDS.MILESTONE_25M,
      below10m: 0, found10m: null,
      below25m: 0, found25m: null,
    });
  }

  const RPT_BATCH = 50;
  const RPT_SAMPLE_BATCHES = 60;
  if (latestRound > 0) {
    try {
      const step = Math.max(RPT_BATCH, Math.floor(latestRound / RPT_SAMPLE_BATCHES));
      const batches = [];
      for (let s = 0; s < latestRound; s += step) {
        batches.push({ start_round: s, end_round: Math.min(s + RPT_BATCH - 1, latestRound) });
      }
      batches.push({ start_round: Math.max(0, latestRound - RPT_BATCH + 1), end_round: latestRound });

      console.error(`  Phase 2a: Coarse sampling — ${batches.length} batches...`);

      const CONCURRENCY = 6;
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk = batches.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map(b => scanPost('v0/round-party-totals', b).catch(() => ({ entries: [] })))
        );
        for (const rpt of results) {
          for (const e of (rpt.entries || [])) {
            const sr = searchRanges.get(e.party);
            if (!sr) continue;
            const cum = parseFloat(e.cumulative_app_rewards || '0');
            const rnd = e.closed_round;

            // Track 10M crossing range
            if (sr.above10m) {
              if (cum < THRESHOLDS.MILESTONE_10M && rnd > sr.below10m) sr.below10m = rnd;
              if (cum >= THRESHOLDS.MILESTONE_10M && (sr.found10m === null || rnd < sr.found10m)) sr.found10m = rnd;
            }
            // Track 25M crossing range
            if (sr.above25m) {
              if (cum < THRESHOLDS.MILESTONE_25M && rnd > sr.below25m) sr.below25m = rnd;
              if (cum >= THRESHOLDS.MILESTONE_25M && (sr.found25m === null || rnd < sr.found25m)) sr.found25m = rnd;
            }
          }
        }
      }
    } catch (e) {
      console.error(`  ⚠ Coarse sampling failed: ${e.message}`);
    }
  }

  // ── Phase 3: Binary search for exact milestone crossing rounds ────────────

  // Collect all (provider, threshold, lowRound, highRound) searches
  const searches = [];
  for (const [provider, sr] of searchRanges) {
    if (sr.above10m && sr.found10m !== null) {
      searches.push({ provider, threshold: THRESHOLDS.MILESTONE_10M, label: '10m',
        lo: sr.below10m, hi: sr.found10m });
    }
    if (sr.above25m && sr.found25m !== null) {
      searches.push({ provider, threshold: THRESHOLDS.MILESTONE_25M, label: '25m',
        lo: sr.below25m, hi: sr.found25m });
    }
  }

  console.error(`  Phase 2b: Binary search for ${searches.length} milestones...`);

  // milestoneRounds: provider → { round10m, round25m }
  const milestoneRounds = new Map();

  // Run searches with limited concurrency
  const SEARCH_CONCURRENCY = 3;
  for (let i = 0; i < searches.length; i += SEARCH_CONCURRENCY) {
    const batch = searches.slice(i, i + SEARCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async s => {
        const round = await binarySearchMilestone(s.provider, s.threshold, s.lo, s.hi);
        return { ...s, round };
      })
    );
    for (const r of results) {
      if (!milestoneRounds.has(r.provider)) milestoneRounds.set(r.provider, {});
      const mr = milestoneRounds.get(r.provider);
      if (r.label === '10m') mr.round10m = r.round;
      if (r.label === '25m') mr.round25m = r.round;
    }
    // Progress
    if ((i + SEARCH_CONCURRENCY) % 15 === 0 || i + SEARCH_CONCURRENCY >= searches.length) {
      console.error(`    ...${Math.min(i + SEARCH_CONCURRENCY, searches.length)}/${searches.length} done`);
    }
  }

  // ── Phase 4: Fetch dates for all milestone rounds ─────────────────────────

  const roundsNeedingDates = [];
  for (const [, mr] of milestoneRounds) {
    if (mr.round10m != null) roundsNeedingDates.push(mr.round10m);
    if (mr.round25m != null) roundsNeedingDates.push(mr.round25m);
  }

  console.error(`  Phase 3: Fetching dates for ${new Set(roundsNeedingDates).size} milestone rounds...`);
  const roundDateMap = await fetchRoundDates(roundsNeedingDates);
  console.error(`  Dates resolved: ${roundDateMap.size}\n`);

  // ── Phase 4b: Fetch pre-FA cumulative CC per provider ─────────────────────
  //
  // For each FA with an approval date, query their cumulative_app_rewards
  // at the round closest to their FA approval date. This separates:
  //   Pre-FA CC  = rewards earned as a regular provider (no FA multiplier)
  //   Post-FA CC = rewards earned with FA status (mostly from the ~10x multiplier)
  //
  // We estimate the approval round from the approval date using a constant
  // ~10min/round cadence (600s). Then getCumulativeAtRound searches a window.

  const SECONDS_PER_ROUND = 600;
  const nowMs = Date.now();

  const preFaComputations = [];
  for (const [provider, approvalDate] of approvalByProvider) {
    const currentCum = rewardsByProvider.get(provider) || 0;
    if (currentCum < 1) continue; // skip FAs with no rewards
    const secondsAgo = (nowMs - new Date(approvalDate).getTime()) / 1000;
    const approvalRound = Math.max(0, latestRound - Math.floor(secondsAgo / SECONDS_PER_ROUND));
    preFaComputations.push({ provider, approvalRound });
  }

  console.error(`  Phase 4: Querying pre-FA cumulative CC for ${preFaComputations.length} FAs...`);
  const preFaCCByProvider = new Map();
  const PREFA_CONCURRENCY = 5;
  for (let i = 0; i < preFaComputations.length; i += PREFA_CONCURRENCY) {
    const batch = preFaComputations.slice(i, i + PREFA_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ({ provider, approvalRound }) => {
        // Look backward from the approval round for the last entry that shows
        // this provider's cumulative rewards. Use 50-round window (API max).
        const result = await getCumulativeAtRound(provider, approvalRound, 50);
        return { provider, preFa: result?.cumCC ?? 0 };
      })
    );
    for (const r of results) preFaCCByProvider.set(r.provider, r.preFa);
    if ((i + PREFA_CONCURRENCY) % 30 === 0 || i + PREFA_CONCURRENCY >= preFaComputations.length) {
      console.error(`    ...${Math.min(i + PREFA_CONCURRENCY, preFaComputations.length)}/${preFaComputations.length} done`);
    }
  }
  console.error();

  // ── Phase 5: Assemble report rows ─────────────────────────────────────────

  const now = new Date();
  const rows = featuredApps
    .map(app => {
      const payload = app.payload || app;
      const provider = payload.provider || app.provider || '';
      const appName = payload.appName || payload.app_name || payload.name || provider.split('::')[0] || 'Unknown';
      const reasonBody = reasonByProvider.get(provider) || '';
      const { name: companyName, snippet: reasonSnippet } = extractCompanyName(reasonBody, appName);
      const cum = rewardsByProvider.get(provider) || 0;
      const approval = approvalByProvider.get(provider) || null;
      const daysSinceApproval = approval ? Math.floor((now - new Date(approval)) / 86_400_000) : null;

      const mr = milestoneRounds.get(provider) || {};

      // Get milestone dates from round-totals
      const date10m = mr.round10m != null ? (roundDateMap.get(mr.round10m) || null) : null;
      const date25m = mr.round25m != null ? (roundDateMap.get(mr.round25m) || null) : null;

      const daysTo10m = approval && date10m ? daysBetween(approval, date10m) : null;
      const daysTo25m = approval && date25m ? daysBetween(approval, date25m) : null;

      // Pre-FA / Post-FA breakdown (only if we have an approval date)
      const preFaCC = approval ? (preFaCCByProvider.get(provider) ?? null) : null;
      const postFaCC = (preFaCC !== null) ? Math.max(0, cum - preFaCC) : null;

      return {
        appName,
        companyName,
        reasonSnippet,
        provider,
        approvalDate: approval,
        daysSinceApproval,
        cumulativeCC: cum,
        preFaCC,
        postFaCC,
        hasReached10m: cum >= THRESHOLDS.MILESTONE_10M,
        hasReached25m: cum >= THRESHOLDS.MILESTONE_25M,
        canLockDay1: cum >= THRESHOLDS.LOCK_AMOUNT,
        milestone10m: { round: mr.round10m || null, date: date10m, daysFromApproval: daysTo10m },
        milestone25m: { round: mr.round25m || null, date: date25m, daysFromApproval: daysTo25m },
      };
    })
    .sort((a, b) => b.cumulativeCC - a.cumulativeCC);

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalLifetimeRewards = rows.reduce((s, r) => s + r.cumulativeCC, 0);
  const above10m = rows.filter(r => r.hasReached10m).length;
  const above25m = rows.filter(r => r.hasReached25m).length;
  const lockReady = rows.filter(r => r.canLockDay1).length;

  // ── Output: JSON ──────────────────────────────────────────────────────────

  if (wantJson) {
    console.log(JSON.stringify({
      generatedAt: now.toISOString(), latestRound,
      totalFeaturedApps: rows.length, totalLifetimeRewards,
      appsAbove10m: above10m, appsAbove25m: above25m, canLockDay1: lockReady,
      apps: rows,
    }, null, 2));
    return;
  }

  // ── Output: CSV ───────────────────────────────────────────────────────────

  if (wantCsv) {
    console.log('Rank,App Name,Company Name,Approval Date,Days as FA,Cumulative CC,Pre-FA CC,Post-FA CC,>=10M,>=25M,Can Lock Day1,10M Date,Days to 10M,25M Date,Days to 25M,Note');
    rows.forEach((r, i) => {
      console.log([
        i + 1,
        `"${r.appName}"`,
        `"${r.companyName || ''}"`,
        r.approvalDate ? fmtDate(r.approvalDate) : '',
        r.daysSinceApproval ?? '',
        r.cumulativeCC.toFixed(2),
        r.preFaCC !== null ? r.preFaCC.toFixed(2) : '',
        r.postFaCC !== null ? r.postFaCC.toFixed(2) : '',
        r.hasReached10m ? 'Y' : 'N',
        r.hasReached25m ? 'Y' : 'N',
        r.canLockDay1 ? 'Y' : 'N',
        r.milestone10m.date ? fmtDate(r.milestone10m.date) : '',
        r.milestone10m.daysFromApproval ?? '',
        r.milestone25m.date ? fmtDate(r.milestone25m.date) : '',
        r.milestone25m.daysFromApproval ?? '',
        `"${r.reasonSnippet || ''}"`,
      ].join(','));
    });
    return;
  }

  // ── Output: Text report ───────────────────────────────────────────────────

  const W = 220;
  const line = '═'.repeat(W);
  const thinLine = '─'.repeat(W);

  console.log();
  console.log(line);
  console.log('  FEATURED APPS (FA) REPORT — Canton Network');
  console.log(`  Generated: ${now.toISOString()}  |  Latest Round: ${latestRound.toLocaleString()}`);
  console.log(line);
  console.log();

  console.log('  SUMMARY');
  console.log(thinLine);
  console.log(`  Total Featured Apps on-chain:      ${rows.length}`);
  console.log(`  Lifetime FA Rewards (all FAs):     ${totalLifetimeRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })} CC  (${fmtCC(totalLifetimeRewards)})`);
  console.log(`  FAs with >= 10M CC mined:          ${above10m}`);
  console.log(`  FAs with >= 25M CC mined:          ${above25m}`);
  console.log(`  FAs that can lock 25M CC on Day 1:  ${lockReady}`);
  console.log();

  console.log('  CIP LOCKING READINESS');
  console.log(thinLine);
  console.log('  If the FA Locking CIP passes, partners must lock 25M CC within 6 months.');
  console.log();
  console.log(`    READY (>= 25M CC):          ${lockReady} FA(s)`);
  console.log(`    APPROACHING (10M–25M CC):   ${above10m - above25m} FA(s)`);
  console.log(`    BELOW THRESHOLD (< 10M CC): ${rows.length - above10m} FA(s)`);
  console.log();

  console.log('  DETAILED BREAKDOWN (ranked by cumulative CC)');
  console.log(thinLine);

  const hdr =
    pad('#', 5) +
    pad('App Name', 30) +
    pad('Company Name', 25) +
    pad('FA Approved', 13) +
    pad('Days FA', 8, 'right') +
    pad('Cumul. CC', 12, 'right') +
    pad('Pre-FA CC', 12, 'right') +
    pad('Post-FA CC', 12, 'right') +
    pad('10M Date', 12, 'right') +
    pad('Days→10M', 10, 'right') +
    pad('25M Date', 12, 'right') +
    pad('Days→25M', 10, 'right') +
    pad('Lock?', 7, 'right') +
    '  ' + 'Note (from vote reason)';

  console.log(`  ${hdr}`);
  console.log(`  ${'─'.repeat(hdr.length)}`);

  rows.forEach((r, i) => {
    const lockIcon = r.canLockDay1 ? '  YES' : (r.hasReached10m ? '  ~' : '  NO');

    const d10m = r.milestone10m.daysFromApproval;
    const d25m = r.milestone25m.daysFromApproval;
    const dt10m = r.milestone10m.date;
    const dt25m = r.milestone25m.date;

    const row =
      pad(String(i + 1), 5) +
      pad(r.appName.slice(0, 28), 30) +
      pad((r.companyName || '--').slice(0, 23), 25) +
      pad(fmtDate(r.approvalDate), 13) +
      pad(r.daysSinceApproval !== null ? `${r.daysSinceApproval}d` : '--', 8, 'right') +
      pad(fmtCC(r.cumulativeCC), 12, 'right') +
      pad(r.preFaCC !== null ? fmtCC(r.preFaCC) : '--', 12, 'right') +
      pad(r.postFaCC !== null ? fmtCC(r.postFaCC) : '--', 12, 'right') +
      pad(dt10m ? fmtDate(dt10m) : (r.hasReached10m ? '~' : '--'), 12, 'right') +
      pad(d10m !== null ? `${d10m}d` : (r.hasReached10m ? '~' : '--'), 10, 'right') +
      pad(dt25m ? fmtDate(dt25m) : (r.hasReached25m ? '~' : '--'), 12, 'right') +
      pad(d25m !== null ? `${d25m}d` : (r.hasReached25m ? '~' : '--'), 10, 'right') +
      pad(lockIcon, 7, 'right') +
      '  ' + (r.reasonSnippet || '');

    console.log(`  ${row}`);
  });

  console.log();
  console.log(line);
  console.log('  NOTES');
  console.log(thinLine);
  const companyNamesResolved = rows.filter(r => r.companyName).length;
  console.log(`  * Company names: ${companyNamesResolved} of ${rows.length} extracted (best-effort) from vote result reason.body.`);
  console.log(`  * FA approval dates: ${approvalByProvider.size > 0 ? `${approvalByProvider.size} found` : 'NOT available'} from on-chain GrantFeaturedAppRight vote results.`);
  console.log(`  * Milestone timing: Binary-searched ${searches.length} milestones, resolved ${roundDateMap.size} round dates.`);
  console.log('  * "Cumulative CC" = total app rewards mined by the provider party since launch.');
  console.log('  * "Pre-FA CC"  = cumulative CC at the round closest to FA approval date (no FA multiplier).');
  console.log('  * "Post-FA CC" = Cumulative - Pre-FA; includes ~10x FA bonus on coupons earned after approval.');
  console.log('  * "Lock Ready" = provider has accrued >= 25M CC and could lock on Day 1.');
  console.log('  * "Days→10M/25M" = days from FA approval to reaching that CC milestone.');
  console.log('  * "~" = milestone reached but exact date could not be pinpointed.');
  console.log(line);
  console.log();
  console.log(`  DATA SOURCES (all from Canton Scan API: ${SCAN_BASE})`);
  console.log(thinLine);
  console.log('  1. GET  /v0/featured-apps                  — List of on-chain Featured Apps (provider party IDs)');
  console.log('  2. GET  /v0/top-providers-by-app-rewards   — Cumulative CC mined per app provider');
  console.log('  3. POST /v0/admin/sv/voteresults           — Historical vote results for GrantFeaturedAppRight');
  console.log('     (actionName=SRARC_GrantFeaturedAppRight) → gives FA approval date (completedAt field)');
  console.log('  4. POST /v0/round-party-totals             — Per-party cumulative rewards at a given round range');
  console.log('     (max 50 rounds/request)                  → used for binary search of milestone crossing rounds');
  console.log('  5. POST /v0/round-totals                   — Aggregate round data with closed_round_effective_at');
  console.log('     (max 50 rounds/request)                  → converts milestone round numbers to calendar dates');
  console.log(line);
  console.log();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
