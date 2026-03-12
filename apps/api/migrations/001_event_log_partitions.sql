-- Enable partitioning on event_log by month
-- This creates monthly partitions for the event_log table

-- Drop the existing table and recreate as partitioned
ALTER TABLE event_log RENAME TO event_log_old;

CREATE TABLE event_log (
  id          BIGSERIAL,
  event_id    UUID NOT NULL,
  merchant_id UUID NOT NULL,
  device_id   UUID NOT NULL,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create initial partitions for the next 12 months
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..11 LOOP
    start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'event_log_' || TO_CHAR(start_date, 'YYYY_MM');

    EXECUTE FORMAT(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF event_log
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );

    EXECUTE FORMAT(
      'CREATE INDEX IF NOT EXISTS %I ON %I (merchant_id, occurred_at)',
      partition_name || '_merchant_occurred_idx', partition_name
    );

    EXECUTE FORMAT(
      'CREATE INDEX IF NOT EXISTS %I ON %I (merchant_id, event_type)',
      partition_name || '_merchant_type_idx', partition_name
    );

    EXECUTE FORMAT(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (event_id)',
      partition_name || '_event_id_uidx', partition_name
    );
  END LOOP;
END $$;

-- Migrate data from old table
INSERT INTO event_log (id, event_id, merchant_id, device_id, event_type, payload, occurred_at, received_at)
SELECT id, event_id, merchant_id, device_id, event_type, payload, occurred_at, received_at
FROM event_log_old
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS event_log_old;
