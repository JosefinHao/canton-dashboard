#!/usr/bin/env node
/**
 * Quick diagnostic: dump reason.body and reason.url from GrantFeaturedAppRight
 * vote results to see what company/description data is available.
 */

const SCAN_BASE =
  process.env.SCAN_URL ||
  'https://scan.sv-1.global.canton.network.sync.global/api/scan';

async function main() {
  const res = await fetch(`${SCAN_BASE}/v0/admin/sv/voteresults`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ actionName: 'SRARC_GrantFeaturedAppRight', accepted: true, limit: 50 }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    console.error(`Error: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
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
