-- ============================================================================
-- CoinAegis Audit: Fee Burn Verification Queries
-- Run these in BigQuery console (governence-483517)
--
-- PURPOSE: Independently verify the ~1,024,360 CC fee burn claim.
-- The audit report derived this as a residual (total mined - traced - remaining).
-- These queries directly measure fees from exercise_result.summary fields.
-- ============================================================================

-- CoinAegis key fingerprint (all 44+ party IDs share this key)
-- 122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3


-- ============================================================================
-- QUERY V1: Count all CoinAegis choice exercises by type
-- This verifies the claimed counts: 315,420 transfers, 55,049 mining, etc.
-- Matches any event where an acting_party contains the CoinAegis key.
-- ============================================================================

SELECT
  JSON_VALUE(payload, '$.choice') AS choice_name,
  COUNT(*) AS exercise_count,
  MIN(effective_at) AS first_exercise,
  MAX(effective_at) AS last_exercise
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND EXISTS (
    SELECT 1 FROM UNNEST(acting_parties) AS ap
    WHERE ap LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
  )
GROUP BY choice_name
ORDER BY exercise_count DESC;


-- ============================================================================
-- QUERY V2: Sum actual transfer fees burned by CoinAegis parties
-- Uses exercise_result.summary.senderChangeFee (direct fee field)
-- and exercise_result.summary.inputAmuletAmount for cross-check.
-- ============================================================================

SELECT
  COUNT(*) AS total_transfers,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS total_sender_fee,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)) AS total_input_amount,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.balanceChanges[0].changeToInitialAmountAsOfRoundZero') AS FLOAT64)) AS total_balance_change,
  AVG(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS avg_fee_per_transfer,
  MIN(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS min_fee,
  MAX(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS max_fee
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
;


-- ============================================================================
-- QUERY V3: Distinguish regular transfers vs consolidation (empty-output)
-- "Consolidation" transfers have 0 outputs or 0-amount outputs — they burn
-- the entire input as fees. This checks how many of the 315,420 are real
-- transfers vs consolidation burns.
-- ============================================================================

SELECT
  CASE
    WHEN ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) = 0 THEN 'consolidation_no_outputs'
    WHEN CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) = 0 THEN 'consolidation_zero_amount'
    WHEN JSON_VALUE(payload, '$.transfer.outputs[0].receiver')
         LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
         THEN 'self_transfer'
    ELSE 'external_transfer'
  END AS transfer_type,
  COUNT(*) AS count,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS total_fee_burned,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)) AS total_input,
  AVG(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS avg_fee
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
GROUP BY transfer_type
ORDER BY count DESC;


-- ============================================================================
-- QUERY V4: Sum CC burned via BuyMemberTraffic by CoinAegis parties
-- BuyMemberTraffic burns CC to purchase network bandwidth. The input amount
-- is fully consumed (no output amulet).
-- ============================================================================

SELECT
  COUNT(*) AS buy_traffic_count,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)) AS total_cc_burned,
  AVG(CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)) AS avg_cc_per_purchase,
  MIN(effective_at) AS first_purchase,
  MAX(effective_at) AS last_purchase
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_BuyMemberTraffic'
  AND EXISTS (
    SELECT 1 FROM UNNEST(acting_parties) AS ap
    WHERE ap LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
  );


-- ============================================================================
-- QUERY V5: Complete fee burn accounting — all sources
-- Combines transfer fees + BuyMemberTraffic burns + any other fee sources
-- to get the total CC consumed by fees/burns.
-- ============================================================================

WITH transfer_fees AS (
  SELECT
    'transfer_fee' AS burn_source,
    COUNT(*) AS event_count,
    SUM(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS cc_burned
  FROM `governence-483517.transformed.events_parsed`
  WHERE
    DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-01'
    AND event_type = 'exercised'
    AND migration_id = 4
    AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
    AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
),
traffic_burns AS (
  SELECT
    'buy_member_traffic' AS burn_source,
    COUNT(*) AS event_count,
    SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)) AS cc_burned
  FROM `governence-483517.transformed.events_parsed`
  WHERE
    DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-01'
    AND event_type = 'exercised'
    AND migration_id = 4
    AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_BuyMemberTraffic'
    AND EXISTS (
      SELECT 1 FROM UNNEST(acting_parties) AS ap
      WHERE ap LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
    )
)
SELECT * FROM transfer_fees
UNION ALL
SELECT * FROM traffic_burns
UNION ALL
SELECT
  'TOTAL' AS burn_source,
  (SELECT event_count FROM transfer_fees) + (SELECT event_count FROM traffic_burns) AS event_count,
  (SELECT cc_burned FROM transfer_fees) + (SELECT cc_burned FROM traffic_burns) AS cc_burned;


-- ============================================================================
-- QUERY V6: Daily fee burn breakdown
-- Shows fee burn rate over time — useful for spotting if fees correlate with
-- the mining acceleration pattern documented in the audit report.
-- ============================================================================

SELECT
  DATE(effective_at) AS burn_date,
  COUNT(*) AS transfer_count,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS daily_fee_burned,
  AVG(CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS FLOAT64)) AS avg_fee,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)) AS daily_input_total
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
GROUP BY burn_date
ORDER BY burn_date;


-- ============================================================================
-- QUERY V7: Sample a few transfer exercise_results to inspect fee structure
-- Grab 10 representative transfers to see what fields are actually populated
-- in exercise_result.summary, in case senderChangeFee is null/missing.
-- ============================================================================

SELECT
  event_id,
  effective_at,
  JSON_VALUE(payload, '$.transfer.sender') AS sender,
  JSON_VALUE(payload, '$.transfer.outputs[0].receiver') AS receiver,
  JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS output_amount,
  ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) AS output_count,
  JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS input_amount,
  JSON_VALUE(exercise_result, '$.summary.senderChangeFee') AS sender_fee,
  JSON_VALUE(exercise_result, '$.summary.amuletPrice') AS amulet_price,
  JSON_QUERY(exercise_result, '$.summary') AS full_summary
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-20' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
  AND ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) > 0
  AND CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) > 0
ORDER BY CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) DESC
LIMIT 10;
