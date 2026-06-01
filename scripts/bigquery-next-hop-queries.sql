-- ============================================================================
-- CoinAegis Audit: Next-Hop Transfer Queries
-- Run these in BigQuery console (governence-483517)
-- ============================================================================

-- ============================================================================
-- QUERY 1: Where did fba188 send funds? (fba188 outbound transfers)
-- fba188 received 1,065,002 CC from CoinAegis chain. Did it forward to ByBit?
-- Cost estimate: ~5-10 GB (narrow date range, exact template_id)
-- ============================================================================

SELECT
  DATE(effective_at) AS tx_date,
  JSON_VALUE(payload, '$.transfer.sender') AS sender,
  JSON_VALUE(payload, '$.transfer.outputs[0].receiver') AS receiver,
  JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS amount,
  ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) AS output_count
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-20' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND template_id = 'c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules'
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%fba188%'
ORDER BY effective_at;


-- ============================================================================
-- QUERY 2: Where did Gate send funds? (Gate outbound transfers)
-- Gate received 700,001 CC from CoinAegis chain. Did it forward to ByBit?
-- ============================================================================

SELECT
  DATE(effective_at) AS tx_date,
  JSON_VALUE(payload, '$.transfer.sender') AS sender,
  JSON_VALUE(payload, '$.transfer.outputs[0].receiver') AS receiver,
  JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS amount,
  ARRAY_LENGTH(JSON_QUERY_ARRAY(payload, '$.transfer.outputs')) AS output_count
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-20' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND template_id = 'c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules'
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%Gate%'
ORDER BY effective_at;


-- ============================================================================
-- QUERY 3: All auth0 CoinAegis party outbound transfers
-- The 40 auth0 parties share the same key. Trace where they sent funds.
-- ============================================================================

SELECT
  DATE(effective_at) AS tx_date,
  JSON_VALUE(payload, '$.transfer.sender') AS sender,
  JSON_VALUE(payload, '$.transfer.outputs[0].receiver') AS receiver,
  JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS amount
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-20' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND template_id = 'c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules'
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%122002cb5bad0f12132febb896a511d40b7d542e0b9cde83b415b5c7148a9d2419c3%'
  AND JSON_VALUE(payload, '$.transfer.sender') LIKE '%auth0%'
ORDER BY effective_at;


-- ============================================================================
-- QUERY 4: Did ANYONE send to ByBit from fba188's key?
-- Check if fba188's key appears as sender to any ByBit receiver
-- First, discover fba188's full party ID / key
-- ============================================================================

SELECT
  JSON_VALUE(payload, '$.transfer.sender') AS sender,
  JSON_VALUE(payload, '$.transfer.outputs[0].receiver') AS receiver,
  JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS amount,
  effective_at
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-20' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND template_id = 'c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules'
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND JSON_VALUE(payload, '$.transfer.outputs[0].receiver') LIKE '%ByBit%'
ORDER BY effective_at
LIMIT 100;


-- ============================================================================
-- QUERY 5: All inbound transfers TO ByBit (any sender) in the window
-- This is the definitive check — if ByBit received 2.8M CC from anyone,
-- it would show here regardless of intermediaries.
-- ============================================================================

SELECT
  DATE(effective_at) AS tx_date,
  JSON_VALUE(payload, '$.transfer.sender') AS sender,
  JSON_VALUE(payload, '$.transfer.outputs[0].receiver') AS receiver,
  JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS amount
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-20' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND template_id = 'c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules'
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND (
    JSON_VALUE(payload, '$.transfer.outputs[0].receiver') LIKE '%ByBit%'
    OR JSON_VALUE(payload, '$.transfer.outputs[0].receiver') LIKE '%bybit%'
    OR JSON_VALUE(payload, '$.transfer.outputs[0].receiver') LIKE '%BYBIT%'
    OR JSON_VALUE(payload, '$.transfer.outputs[0].receiver') LIKE '%ByBitEU%'
  )
ORDER BY CAST(JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS FLOAT64) DESC
LIMIT 100;


-- ============================================================================
-- QUERY 6: fba188 full party ID and all activity (to understand the entity)
-- Get the first few transfers involving fba188 to see its full party ID
-- ============================================================================

SELECT
  DATE(effective_at) AS tx_date,
  JSON_VALUE(payload, '$.transfer.sender') AS sender,
  JSON_VALUE(payload, '$.transfer.outputs[0].receiver') AS receiver,
  JSON_VALUE(payload, '$.transfer.outputs[0].amount') AS amount
FROM `governence-483517.transformed.events_parsed`
WHERE
  DATE(effective_at) BETWEEN '2026-04-20' AND '2026-06-01'
  AND event_type = 'exercised'
  AND migration_id = 4
  AND template_id = 'c208d7ead1e4e9b610fc2054d0bf00716144ad444011bce0b02dcd6cd0cb8a23:Splice.AmuletRules:AmuletRules'
  AND JSON_VALUE(payload, '$.choice') = 'AmuletRules_Transfer'
  AND (
    JSON_VALUE(payload, '$.transfer.sender') LIKE '%fba188%'
    OR JSON_VALUE(payload, '$.transfer.outputs[0].receiver') LIKE '%fba188%'
  )
ORDER BY effective_at
LIMIT 50;
