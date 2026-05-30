-- BigQuery Pipeline Health Check
-- Schedule: daily at 04:00 UTC (1 hour after daily refresh at 03:00)
-- Purpose: Intentionally fails if transformed tables are stale,
--          triggering email + Slack alerts via GCP Cloud Monitoring
-- Cost: Zero (INFORMATION_SCHEMA is free metadata)

BEGIN
  DECLARE latest_events DATE;
  DECLARE latest_updates DATE;
  DECLARE yesterday DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY);

  SET latest_events = (
    SELECT PARSE_DATE('%Y%m%d', MAX(partition_id))
    FROM `governence-483517.transformed.INFORMATION_SCHEMA.PARTITIONS`
    WHERE table_name = 'events_parsed'
      AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
  );

  SET latest_updates = (
    SELECT PARSE_DATE('%Y%m%d', MAX(partition_id))
    FROM `governence-483517.transformed.INFORMATION_SCHEMA.PARTITIONS`
    WHERE table_name = 'updates_parsed'
      AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
  );

  IF latest_events < yesterday OR latest_updates < yesterday THEN
    RAISE USING MESSAGE = FORMAT('STALE DATA: events=%t updates=%t expected>=%t', latest_events, latest_updates, yesterday);
  END IF;
END;
