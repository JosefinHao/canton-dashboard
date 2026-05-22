#!/usr/bin/env node
/**
 * Quick diagnostic: dump reason.body and reason.url from GrantFeaturedAppRight
 * vote results to see what company/description data is available.
 */

const SCAN_ENDPOINTS = [
  process.env.SCAN_URL || 'https://scan.sv-1.global.canton.network.sync.global/api/scan',
  'https://scan.sv-1.global.canton.network.digitalasset.com/api/scan',
  'https://scan.sv-2.global.canton.network.digitalasset.com/api/scan',
  'https://scan.sv-1.global.canton.network.cumberland.io/api/scan',
  'https://scan.sv-1.global.canton.network.proofgroup.xyz/api/scan',
];

async function main() {
  let data;
  for (const base of SCAN_ENDPOINTS) {
    try {
      console.error(`Trying ${base}...`);
      const res = await fetch(`${base}/v0/admin/sv/voteresults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ actionName: 'SRARC_GrantFeaturedAppRight', accepted: true, limit: 50 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) { data = await res.json(); break; }
      console.error(`  → ${res.status}`);
    } catch (e) { console.error(`  → ${e.message}`); }
  }
  if (!data) { console.error('All endpoints failed'); process.exit(1); }
  const results = data.dso_rules_vote_results || [];

  console.log(`Got ${results.length} vote results\n`);
  console.log('Provider | Requester | Reason Body | Reason URL');
  console.log('─'.repeat(120));

  for (const vr of results.slice(0, 30)) {
    if (vr.outcome?.tag !== 'VRO_Accepted') continue;

    const actionValue = vr.request?.action?.value;
    const provider =
      actionValue?.dsoAction?.value?.provider ||
      actionValue?.provider ||
      'unknown';

    const appName = provider.split('::')[0] || 'unknown';
    const requester = vr.request?.requester || '--';
    const reasonBody = vr.request?.reason?.body || '--';
    const reasonUrl = vr.request?.reason?.url || '--';

    console.log(`${appName.slice(0, 30).padEnd(32)} | ${requester.padEnd(10)} | ${reasonBody.slice(0, 40).padEnd(42)} | ${reasonUrl.slice(0, 50)}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
