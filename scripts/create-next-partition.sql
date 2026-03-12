-- create-next-partition.sql
-- Creates the next calendar-month partition for event_log and audit_log.
-- Run this script at the end of each month (e.g. via a cron job or pg_cron).
-- It is idempotent: IF NOT EXISTS prevents errors on re-runs.

DO $$
DECLARE
  -- Target: the calendar month AFTER the current one
  next_month     DATE := date_trunc('month', now()) + INTERVAL '1 month';
  month_end      DATE := next_month + INTERVAL '1 month';
  partition_name TEXT;
  month_suffix   TEXT;
BEGIN
  month_suffix   := to_char(next_month, 'YYYY_MM');

  -- -------------------------------------------------------------------------
  -- event_log partition
  -- -------------------------------------------------------------------------
  partition_name := 'event_log_' || month_suffix;

  EXECUTE format(
    $sql$
      CREATE TABLE IF NOT EXISTS %I
        PARTITION OF event_log
        FOR VALUES FROM (%L) TO (%L)
    $sql$,
    partition_name,
    next_month::text,
    month_end::text
  );

  RAISE NOTICE 'Partition % ready (event_log)', partition_name;

  -- -------------------------------------------------------------------------
  -- audit_log partition
  -- -------------------------------------------------------------------------
  partition_name := 'audit_log_' || month_suffix;

  EXECUTE format(
    $sql$
      CREATE TABLE IF NOT EXISTS %I
        PARTITION OF audit_log
        FOR VALUES FROM (%L) TO (%L)
    $sql$,
    partition_name,
    next_month::text,
    month_end::text
  );

  RAISE NOTICE 'Partition % ready (audit_log)', partition_name;
END;
$$;
