-- ============================================================================
-- CoinAegis Audit: Daily CC Outflow Timeline
-- Run these in BigQuery console (governence-483517)
--
-- PURPOSE: Track exactly when CoinAegis CC left the entity's control —
-- both via transfers to external parties and via BuyMemberTraffic consumption.
-- This answers: after goldacorn's 2.09M CC was claimed and 1.1M transferred
-- on Apr 24-25, when did the remaining ~990K move out?
-- ============================================================================

-- CoinAegis key fingerprint
-- 122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3


-- ============================================================================
-- QUERY 1: Daily BuyMemberTraffic net CC consumed
-- Shows how much CC was permanently consumed for traffic each day.
-- Net = inputAmuletAmount + inputAppRewardAmount + inputValidatorRewardAmount
--       + inputValidatorFaucetAmount - senderChangeAmount
-- ============================================================================

SELECT
  DATE(effective_at) AS traffic_date,
  COUNT(*) AS traffic_ops,
  SUM(
    CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)
    + CAST(JSON_VALUE(exercise_result, '$.summary.inputAppRewardAmount') AS FLOAT64)
    + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorRewardAmount') AS FLOAT64)
    + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorFaucetAmount') AS FLOAT64)
    - CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeAmount') AS FLOAT64)
  ) AS net_cc_consumed,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputAppRewardAmount') AS FLOAT64)) AS app_rewards_claimed,
  SUM(CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorRewardAmount') AS FLOAT64)) AS val_rewards_claimed
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-10'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND choice = 'AmuletRules_BuyMemberTraffic'
  AND EXISTS (
    SELECT 1 FROM UNNEST(acting_parties) AS ap
    WHERE ap LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
  )
GROUP BY traffic_date
ORDER BY traffic_date;


-- ============================================================================
-- QUERY 2: Daily transfers TO external parties (non-CoinAegis receivers)
-- Excludes self-transfers (where receiver also has CoinAegis key).
-- Shows exactly when CC left CoinAegis control via transfers.
-- ============================================================================

SELECT
  DATE(effective_at) AS transfer_date,
  COUNT(*) AS transfer_count,
  SUM(CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64)) AS total_cc_sent,
  ARRAY_AGG(DISTINCT
    SUBSTR(JSON_VALUE(payload, '$.transfer.outputs[0].receiver'), 1, 30)
  ) AS receivers
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-10'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND choice = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
  AND JSON_VALUE(payload, '$.transfer.outputs[0].receiver') NOT LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
  AND ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) > 0
  AND CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) > 0
GROUP BY transfer_date
ORDER BY transfer_date;


-- ============================================================================
-- QUERY 3: Combined daily outflow — transfers + traffic consumption
-- Unified view of all CC leaving the entity per day.
-- ============================================================================

WITH daily_transfers AS (
  SELECT
    DATE(effective_at) AS outflow_date,
    'transfer_out' AS outflow_type,
    COUNT(*) AS event_count,
    SUM(CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64)) AS cc_amount
  FROM `governence-483517.transformed.events_parsed`
  WHERE
    DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-10'
    AND event_type = 'exercised'
    AND migration_id = 4
    AND choice = 'AmuletRules_Transfer'
    AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
    AND JSON_VALUE(payload, '$.transfer.outputs[0].receiver') NOT LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
    AND ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) > 0
    AND CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) > 0
  GROUP BY outflow_date
),
daily_traffic AS (
  SELECT
    DATE(effective_at) AS outflow_date,
    'buy_traffic' AS outflow_type,
    COUNT(*) AS event_count,
    SUM(
      CAST(JSON_VALUE(exercise_result, '$.summary.inputAmuletAmount') AS FLOAT64)
      + CAST(JSON_VALUE(exercise_result, '$.summary.inputAppRewardAmount') AS FLOAT64)
      + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorRewardAmount') AS FLOAT64)
      + CAST(JSON_VALUE(exercise_result, '$.summary.inputValidatorFaucetAmount') AS FLOAT64)
      - CAST(JSON_VALUE(exercise_result, '$.summary.senderChangeAmount') AS FLOAT64)
    ) AS cc_amount
  FROM `governence-483517.transformed.events_parsed`
  WHERE
    DATE(effective_at) BETWEEN '2026-04-01' AND '2026-06-10'
    AND event_type = 'exercised'
    AND migration_id = 4
    AND choice = 'AmuletRules_BuyMemberTraffic'
    AND EXISTS (
      SELECT 1 FROM UNNEST(acting_parties) AS ap
      WHERE ap LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
    )
  GROUP BY outflow_date
)
SELECT * FROM daily_transfers
UNION ALL
SELECT * FROM daily_traffic
ORDER BY outflow_date, outflow_type;
