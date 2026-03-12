-- Materialized views for dashboard analytics

-- Daily sales summary per merchant/location
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales AS
SELECT
  merchant_id,
  location_id,
  DATE_TRUNC('day', created_at AT TIME ZONE 'UTC') AS sale_date,
  COUNT(*) AS transaction_count,
  SUM(subtotal_cents) AS subtotal_cents,
  SUM(tax_cents) AS tax_cents,
  SUM(discount_cents) AS discount_cents,
  SUM(total_cents) AS total_cents,
  SUM(CASE WHEN status = 'VOIDED' THEN 1 ELSE 0 END) AS void_count,
  SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END) AS refund_count
FROM sales
WHERE status IN ('COMPLETED', 'VOIDED', 'REFUNDED')
GROUP BY merchant_id, location_id, DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_sales_pk
  ON mv_daily_sales (merchant_id, location_id, sale_date);

CREATE INDEX IF NOT EXISTS mv_daily_sales_merchant_date
  ON mv_daily_sales (merchant_id, sale_date DESC);

-- Product sales ranking per merchant
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_sales AS
SELECT
  pv.merchant_id,
  pv.product_id,
  pv.id AS variant_id,
  pv.sku,
  p.name AS product_name,
  pv.name AS variant_name,
  COUNT(sl.id) AS times_sold,
  SUM(sl.qty) AS total_qty_sold,
  SUM(sl.line_total_cents) AS total_revenue_cents,
  MAX(s.created_at) AS last_sold_at
FROM sale_lines sl
JOIN product_variants pv ON sl.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
JOIN sales s ON sl.sale_id = s.id
WHERE s.status = 'COMPLETED'
GROUP BY pv.merchant_id, pv.product_id, pv.id, pv.sku, p.name, pv.name
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_product_sales_pk
  ON mv_product_sales (variant_id);

CREATE INDEX IF NOT EXISTS mv_product_sales_merchant_revenue
  ON mv_product_sales (merchant_id, total_revenue_cents DESC);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_sales;
END;
$$ LANGUAGE plpgsql;
