#!/usr/bin/env node

/**
 * Canton Network Exchanges & Brokerages — Featured App × Validator Node Report
 *
 * Queries the Canton Scan API to:
 *   1. Fetch all FeaturedAppRight contracts (on-chain featured apps)
 *   2. Fetch all ValidatorLicense contracts (validator nodes)
 *   3. Cross-reference featured-app provider party IDs with validator parties
 *   4. Use the local company-name map + classification to report exchanges/brokerages
 *      and how many validator nodes each is running
 *
 * Usage:
 *   node scripts/canton-exchanges-brokerages.mjs
 *   node scripts/canton-exchanges-brokerages.mjs --json
 *   SCAN_URL=https://... node scripts/canton-exchanges-brokerages.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ──────────────────────────────────────────────────────────

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

// ─── Classification: exchanges & brokerages among featured apps ─────────────
// Manually curated from web research of all 134 unique featured-app companies.
// Category codes: CEX = centralized exchange, DEX = on-chain exchange,
//   PB = prime brokerage, BD = broker-dealer, ET = electronic trading venue,
//   TF = trading firm / market maker, CU = custody provider, CL = clearing

const EXCHANGE_BROKERAGE_CLASSIFICATION = {
  // Centralized Exchanges
  'Binance':              { category: 'CEX', description: 'Major crypto exchange' },
  'Kraken':               { category: 'CEX', description: 'Major crypto exchange' },
  'OKX':                  { category: 'CEX', description: 'Major crypto exchange' },
  'ByBit':                { category: 'CEX', description: 'Major crypto exchange' },
  'KuCoin':               { category: 'CEX', description: 'Major crypto exchange' },
  'MEXC':                 { category: 'CEX', description: 'Major crypto exchange' },
  'EDX Markets LLC':      { category: 'CEX', description: 'Institutional crypto exchange (Citadel/Fidelity-backed)' },

  // Canton-Native DEXes / On-Chain Exchanges
  'Hundred Exchange':     { category: 'DEX', description: 'Canton-native equity perpetuals exchange' },
  'Cantex':               { category: 'DEX', description: 'Canton-native on-chain exchange by CaviarNine' },
  'CantonSwap':           { category: 'DEX', description: 'First DEX on Canton Network' },
  'Tradecraft':           { category: 'DEX', description: 'Canton-native DEX (AMM, privacy by default)' },
  'OneSwap':              { category: 'DEX', description: 'Decentralized exchange on Canton' },
  'Silvana Book':         { category: 'DEX', description: 'Private agentic trading orderbook' },
  'Temple':               { category: 'DEX', description: 'Central limit orderbook on Canton' },
  'Thetanuts Finance':    { category: 'DEX', description: 'Decentralized options exchange' },

  // Brokerages / Prime Brokers
  'Cumberland':           { category: 'PB', description: 'OTC crypto liquidity provider (DRW subsidiary)' },
  'Copper':               { category: 'PB', description: 'Prime brokerage + custody (ClearLoop)' },
  'BitGo':                { category: 'PB', description: 'Prime brokerage + qualified custody' },
  'Republic':             { category: 'BD', description: 'Investment platform, licensed broker-dealer' },

  // Broker-Dealers / Electronic Trading Venues
  'Texture Capital':      { category: 'BD', description: 'FINRA broker-dealer, SEC-registered ATS' },
  'Tradeweb':             { category: 'ET', description: 'Electronic trading venue ($65T+ monthly volume)' },
  'LSEG PTS':             { category: 'ET', description: 'London Stock Exchange Group post-trade services' },
  'Black Manta Capital':  { category: 'BD', description: 'BaFin-regulated tokenization / investment banking' },
  'HydraX':               { category: 'BD', description: 'MAS-regulated exchange technology / digital exchange' },
  'Trakx':                { category: 'BD', description: 'AMF-registered crypto index trading platform' },

  // Trading Firms / Market Makers
  'Falcon Capital':       { category: 'TF', description: 'Trading firm / market maker' },
  'SciFeCap':             { category: 'TF', description: 'Quant trading firm (AI/ML strategies)' },
  'Trade.Fast':           { category: 'TF', description: 'Trading platform on Canton' },
  'TradeChain':           { category: 'TF', description: 'Trading platform' },

  // Custody Providers (adjacent)
  'Zodia Custody':        { category: 'CU', description: 'Institutional custody (Standard Chartered)' },
  'Finoa Consensus Services': { category: 'CU', description: 'Institutional custody + staking' },
  'Dfns':                 { category: 'CU', description: 'Wallet-as-a-service / custody infrastructure' },
  'Ledger':               { category: 'CU', description: 'Hardware wallet + enterprise custody' },

  // Clearing / Settlement
  'Ubyx Clearing':        { category: 'CL', description: 'Stablecoin clearing network (Barclays-backed)' },
  'Global Settlement':    { category: 'CL', description: 'On-chain compliance / settlement infrastructure' },
};

const CATEGORY_LABELS = {
  CEX: 'Centralized Exchange',
  DEX: 'On-Chain Exchange / DEX',
  PB:  'Prime Brokerage',
  BD:  'Broker-Dealer / Trading Venue',
  ET:  'Electronic Trading Venue',
  TF:  'Trading Firm / Market Maker',
  CU:  'Custody Provider',
  CL:  'Clearing / Settlement',
};

// ─── Company → validator party prefix search patterns ───────────────────────
// Maps company names to regex patterns that match validator party prefixes.
// Uses word-boundary-aware matching: patterns must match at the START of a
// prefix or after a separator (-, _, digit boundary) to avoid false positives
// like "temple" matching "franklintempleton" or "ledger" matching "GlobalLedger".
//
// Each pattern is compiled as: /^pattern|[-_]pattern/i (anchored or after separator)
// Entries here supplement the automatic featured-app prefix match.
const COMPANY_VALIDATOR_PATTERNS = {
  'Binance':              [/^binance/i],
  'Kraken':               [/^kraken/i],
  'OKX':                  [/^okx/i],
  'ByBit':                [/^bybit/i],
  'KuCoin':               [/^kucoin/i],
  'MEXC':                 [/^mexc/i],
  'EDX Markets LLC':      [/^edx[-_]/i],
  'Hundred Exchange':     [/^arcane[-_]/i, /^hundred[-_]?exchange/i],
  'Cantex':               [/^cantex[-_]/i],
  'CantonSwap':           [/^cantonswap/i],
  'Tradecraft':           [/^tradecraft/i],
  'OneSwap':              [/^oneswap/i, /^satsterminal/i],
  'Silvana Book':         [/^silvana/i],
  'Temple':               [/^temple[-_]/i],
  'Thetanuts Finance':    [/^thetanut/i, /^thetamarket/i],
  'Cumberland':           [/^cumberland/i],
  'Copper':               [/^copper/i, /^newcopper/i],
  'BitGo':                [/^bitgo/i],
  'Republic':             [/^republic[-_]/i],
  'Texture Capital':      [/^texture[-_]?capital/i],
  'Tradeweb':             [/^tradeweb/i, /^twmain[-_]/i, /^tw[-_]/i],
  'LSEG PTS':             [/^lseg[-_]/i],
  'Black Manta Capital':  [/^blackmanta/i],
  'HydraX':               [/^hydrax/i],
  'Trakx':                [/^trakx/i],
  'Falcon Capital':       [/^elk[-_]validator/i],
  'SciFeCap':             [/^scifecap/i, /^fulcrum[-_]/i],
  'Trade.Fast':           [/^tradefast/i],
  'TradeChain':           [/^tradechain/i],
  'Zodia Custody':        [/^zodia/i],
  'Finoa Consensus Services': [/^finoa/i, /^valawallet/i],
  'Dfns':                 [/^dfns/i, /^validator_dfns$/i],
  'Ledger':               [/^ledger[-_]/i],
  'Ubyx Clearing':        [/^ubyx/i],
  'Global Settlement':    [/^globalsettlement/i],
};

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
      if (body && method === 'POST') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(url, opts);
      if (res.ok) return res.json();
      const text = await res.text().catch(() => '');
      if (res.status < 500) {
        throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
      }
      lastErr = new Error(`${method} ${path} → ${res.status} from ${base}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`${method} ${path} → all endpoints failed`);
}

function scanGet(path) { return scanRequest('GET', path); }

// ─── Data fetchers ──────────────────────────────────────────────────────────

async function fetchAllFeaturedApps() {
  console.error('  Fetching featured apps...');
  const data = await scanGet('v0/featured-apps');
  const apps = data.featured_apps || [];
  console.error(`  → ${apps.length} featured app contracts`);
  return apps;
}

async function fetchAllValidatorLicenses() {
  console.error('  Fetching validator licenses (paginated)...');
  const allLicenses = [];
  let after;
  let page = 0;
  while (true) {
    const params = new URLSearchParams({ limit: '1000' });
    if (after !== undefined) params.set('after', String(after));
    const data = await scanGet(`v0/admin/validator/licenses?${params}`);
    const licenses = data.validator_licenses || [];
    allLicenses.push(...licenses);
    page++;
    console.error(`  → page ${page}: ${licenses.length} licenses (total: ${allLicenses.length})`);
    if (!data.next_page_token) break;
    after = data.next_page_token;
  }
  console.error(`  → ${allLicenses.length} total validator licenses`);
  return allLicenses;
}

async function fetchDsoInfo() {
  console.error('  Fetching DSO info (SV node states)...');
  const data = await scanGet('v0/dso');
  const svStates = data.sv_node_states || [];
  console.error(`  → ${svStates.length} SV node states`);
  return data;
}

// ─── Load local company-name map ────────────────────────────────────────────

function loadCompanyMap() {
  const mapPath = join(__dirname, '..', 'docs', 'party-id-company-map.json');
  const raw = JSON.parse(readFileSync(mapPath, 'utf-8'));
  const map = new Map();
  for (const entry of raw.apps || []) {
    if (entry.partyId && entry.companyName) {
      map.set(entry.partyId, {
        companyName: entry.companyName,
        appName: entry.appName,
        faApproved: entry.faApproved,
      });
    }
  }
  return map;
}

// ─── Party ID matching helpers ──────────────────────────────────────────────

function extractPartyPrefix(partyId) {
  if (!partyId) return '';
  const idx = partyId.indexOf('::');
  return idx >= 0 ? partyId.slice(0, idx) : partyId;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const jsonMode = process.argv.includes('--json');
  const debugMode = process.argv.includes('--debug');

  console.error('Canton Network — Exchanges & Brokerages with Featured Apps\n');
  console.error('Querying live Scan API...\n');

  // 1. Load local company map
  const companyMap = loadCompanyMap();
  console.error(`Loaded ${companyMap.size} party→company mappings from docs/party-id-company-map.json\n`);

  // 2. Fetch live data in parallel
  const [featuredApps, validatorLicenses, dsoInfo] = await Promise.all([
    fetchAllFeaturedApps(),
    fetchAllValidatorLicenses(),
    fetchDsoInfo(),
  ]);

  // 3. Index every validator license by party prefix
  const licensesByValidatorPrefix = new Map(); // prefix → [license, ...]

  for (const lic of validatorLicenses) {
    const validator = lic.payload?.validator || '';
    const vPrefix = extractPartyPrefix(validator);

    if (vPrefix) {
      if (!licensesByValidatorPrefix.has(vPrefix)) licensesByValidatorPrefix.set(vPrefix, []);
      licensesByValidatorPrefix.get(vPrefix).push(lic);
    }
  }

  // 4. Build SV node states index (Super Validators)
  const svByPrefix = new Map();
  for (const svState of dsoInfo.sv_node_states || []) {
    const payload = svState.contract?.payload || svState.payload || {};
    const svName = payload.svName || '';
    const svParty = payload.sv || '';
    const prefix = extractPartyPrefix(svParty);
    if (prefix) {
      svByPrefix.set(prefix, { svName, svParty, svRewardWeight: payload.svRewardWeight });
    }
  }

  // 5. Map featured apps → company → classification
  const companyNodeSummary = new Map();

  for (const fa of featuredApps) {
    const providerParty = fa.payload?.provider || '';
    const providerPrefix = extractPartyPrefix(providerParty);

    // Look up company name from local map
    let companyName = null;
    let appName = null;
    let faApproved = null;

    const mapEntry = companyMap.get(providerParty);
    if (mapEntry) {
      companyName = mapEntry.companyName;
      appName = mapEntry.appName;
      faApproved = mapEntry.faApproved;
    } else {
      for (const [pid, info] of companyMap) {
        if (extractPartyPrefix(pid) === providerPrefix) {
          companyName = info.companyName;
          appName = info.appName;
          faApproved = info.faApproved;
          break;
        }
      }
    }

    if (!companyName) {
      appName = providerPrefix;
      companyName = providerPrefix;
    }

    const classification = EXCHANGE_BROKERAGE_CLASSIFICATION[companyName];
    if (!classification) continue;

    if (!companyNodeSummary.has(companyName)) {
      companyNodeSummary.set(companyName, {
        companyName,
        category: classification.category,
        categoryLabel: CATEGORY_LABELS[classification.category],
        description: classification.description,
        featuredApps: [],
        matchedPrefixes: new Set(),
        matchedPartyIds: new Set(),
        isSuperValidator: false,
        svName: null,
      });
    }

    const summary = companyNodeSummary.get(companyName);
    const faKey = `${providerParty}`;
    const isDuplicate = summary.featuredApps.some(fa => fa.providerParty === faKey);
    if (!isDuplicate) {
      summary.featuredApps.push({
        appName: appName || providerPrefix,
        providerParty,
        faApproved: faApproved || fa.created_at?.slice(0, 10) || 'Unknown',
      });
    }
    summary.matchedPrefixes.add(providerPrefix);

    const svInfo = svByPrefix.get(providerPrefix);
    if (svInfo) {
      summary.isSuperValidator = true;
      summary.svName = svInfo.svName;
    }
  }

  // 6. Comprehensive node search: for each exchange/brokerage, scan ALL validator
  //    licenses to find every node they operate, using two strategies:
  //
  //    Strategy A: Direct prefix match (featured app provider prefix = validator prefix)
  //    Strategy B: Regex pattern match (search all validator prefixes for company
  //               name patterns, anchored to start or after separators to avoid
  //               false positives like "temple" in "franklintempleton")

  console.error('\n  Cross-referencing validator licenses...');

  for (const [company, summary] of companyNodeSummary) {
    const patterns = COMPANY_VALIDATOR_PATTERNS[company] || [];
    const knownPrefixes = new Set(summary.matchedPrefixes);

    // Strategy A: already have the FA provider prefixes in knownPrefixes

    // Strategy B: scan all validator prefixes for regex pattern matches
    for (const [vPrefix] of licensesByValidatorPrefix) {
      for (const regex of patterns) {
        if (regex.test(vPrefix)) {
          knownPrefixes.add(vPrefix);
          break;
        }
      }
    }

    // Collect all unique validator party IDs across all matched prefixes
    for (const prefix of knownPrefixes) {
      const lics = licensesByValidatorPrefix.get(prefix) || [];
      for (const lic of lics) {
        const fullId = lic.payload?.validator || '';
        if (fullId) summary.matchedPartyIds.add(fullId);
      }
    }

    summary.matchedPrefixes = knownPrefixes;

    if (debugMode && summary.matchedPartyIds.size > 0) {
      console.error(`    ${company}: ${summary.matchedPartyIds.size} node(s) across ${knownPrefixes.size} prefix(es)`);
      for (const prefix of knownPrefixes) {
        const count = (licensesByValidatorPrefix.get(prefix) || []).length;
        if (count > 0) console.error(`      • ${prefix} → ${count} license(s)`);
      }
    }
  }

  // 7. Sort: CEX first, then DEX, then PB/BD, etc., then by company name
  const categoryOrder = ['CEX', 'DEX', 'PB', 'BD', 'ET', 'TF', 'CU', 'CL'];
  const sorted = [...companyNodeSummary.values()].sort((a, b) => {
    const oa = categoryOrder.indexOf(a.category);
    const ob = categoryOrder.indexOf(b.category);
    if (oa !== ob) return oa - ob;
    return a.companyName.localeCompare(b.companyName);
  });

  // 8. Output
  if (jsonMode) {
    const output = sorted.map(s => ({
      companyName: s.companyName,
      category: s.category,
      categoryLabel: s.categoryLabel,
      description: s.description,
      featuredAppCount: s.featuredApps.length,
      featuredApps: s.featuredApps,
      totalValidatorNodes: s.matchedPartyIds.size,
      matchedPrefixes: [...s.matchedPrefixes],
      matchedPartyIds: [...s.matchedPartyIds],
      isSuperValidator: s.isSuperValidator,
      svName: s.svName,
    }));
    console.log(JSON.stringify({ generated: new Date().toISOString(), companies: output }, null, 2));
    return;
  }

  // Table output
  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('  CANTON NETWORK — EXCHANGES & BROKERAGES WITH FEATURED APPS (FULL NODE COUNT)');
  console.log('══════════════════════════════════════════════════════════════════════════════════════════\n');

  console.log(`  Data sourced from live Canton Scan API at ${new Date().toISOString()}`);
  console.log(`  Total featured apps on-chain: ${featuredApps.length}`);
  console.log(`  Total validator licenses on-chain: ${validatorLicenses.length}`);
  console.log(`  Super Validators: ${(dsoInfo.sv_node_states || []).length}`);
  console.log('');
  console.log('  Node matching strategies:');
  console.log('    A) Featured app provider party prefix matches validator party prefix');
  console.log('    B) Company name regex pattern matched against all validator prefixes');
  console.log('       (anchored to start of prefix to avoid substring false positives)');
  console.log('');

  let currentCategory = '';
  let totalFAs = 0;
  let totalNodes = 0;

  for (const s of sorted) {
    if (s.categoryLabel !== currentCategory) {
      currentCategory = s.categoryLabel;
      console.log(`\n─── ${currentCategory.toUpperCase()} ${'─'.repeat(Math.max(0, 70 - currentCategory.length))}`)
      console.log('');
      console.log(
        '  ' +
        pad('Company', 25) +
        pad('FAs', 5) +
        pad('Nodes', 7) +
        pad('Prefixes', 10) +
        pad('SV?', 5) +
        pad('Description', 50)
      );
      console.log('  ' + '─'.repeat(100));
    }

    const nodeCount = s.matchedPartyIds.size;
    const prefixCount = s.matchedPrefixes.size;
    const svFlag = s.isSuperValidator ? ' ✓' : '';
    console.log(
      '  ' +
      pad(s.companyName, 25) +
      pad(String(s.featuredApps.length), 5) +
      pad(String(nodeCount), 7) +
      pad(String(prefixCount), 10) +
      pad(svFlag, 5) +
      s.description
    );

    for (const fa of s.featuredApps) {
      console.log(`      └─ FA: ${fa.appName}  (approved: ${fa.faApproved})`);
    }
    for (const prefix of s.matchedPrefixes) {
      const lics = licensesByValidatorPrefix.get(prefix) || [];
      if (lics.length > 0) {
        console.log(`      └─ validator prefix: ${prefix}  (${lics.length} license${lics.length > 1 ? 's' : ''})`);
      }
    }

    totalFAs += s.featuredApps.length;
    totalNodes += nodeCount;
  }

  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`  SUMMARY: ${sorted.length} companies | ${totalFAs} featured apps | ${totalNodes} total validator nodes`);

  const catCounts = {};
  for (const s of sorted) {
    catCounts[s.category] = (catCounts[s.category] || 0) + 1;
  }
  console.log('');
  for (const cat of categoryOrder) {
    if (catCounts[cat]) {
      console.log(`    ${CATEGORY_LABELS[cat]}: ${catCounts[cat]}`);
    }
  }

  console.log('\n  "Nodes" = unique validator party IDs matched via featured app provider');
  console.log('  prefixes and company name regex patterns (anchored to prefix start).');
  console.log('  "Prefixes" = distinct party prefixes (before ::) attributed to the company.');
  console.log('══════════════════════════════════════════════════════════════════════════════════════════\n');
}

function pad(s, len) {
  const str = String(s);
  return str.length >= len ? str + ' ' : str.padEnd(len);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
