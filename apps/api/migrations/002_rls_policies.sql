-- Row Level Security policies for multi-tenant isolation

-- Enable RLS on all tenant tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create the RLS helper function
CREATE OR REPLACE FUNCTION current_merchant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_merchant_id', true), '')::UUID;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Merchants: only see own record
CREATE POLICY merchants_tenant_isolation ON merchants
  USING (id = current_merchant_id());

-- All tables with merchant_id column
CREATE POLICY locations_tenant_isolation ON locations
  USING (merchant_id = current_merchant_id());

CREATE POLICY devices_tenant_isolation ON devices
  USING (merchant_id = current_merchant_id());

CREATE POLICY users_tenant_isolation ON users
  USING (merchant_id = current_merchant_id());

CREATE POLICY categories_tenant_isolation ON categories
  USING (merchant_id = current_merchant_id());

CREATE POLICY tax_rules_tenant_isolation ON tax_rules
  USING (merchant_id = current_merchant_id());

CREATE POLICY products_tenant_isolation ON products
  USING (merchant_id = current_merchant_id());

CREATE POLICY product_variants_tenant_isolation ON product_variants
  USING (merchant_id = current_merchant_id());

CREATE POLICY inventory_items_tenant_isolation ON inventory_items
  USING (merchant_id = current_merchant_id());

CREATE POLICY register_sessions_tenant_isolation ON register_sessions
  USING (merchant_id = current_merchant_id());

CREATE POLICY sales_tenant_isolation ON sales
  USING (merchant_id = current_merchant_id());

CREATE POLICY payments_tenant_isolation ON payments
  USING (merchant_id = current_merchant_id());

CREATE POLICY crypto_invoices_tenant_isolation ON crypto_invoices
  USING (merchant_id = current_merchant_id());

CREATE POLICY refunds_tenant_isolation ON refunds
  USING (merchant_id = current_merchant_id());

CREATE POLICY event_log_tenant_isolation ON event_log
  USING (merchant_id = current_merchant_id());

CREATE POLICY audit_log_tenant_isolation ON audit_log
  USING (merchant_id = current_merchant_id());

-- Sale lines are accessed via sale (join-based access)
CREATE POLICY sale_lines_tenant_isolation ON sale_lines
  USING (sale_id IN (SELECT id FROM sales WHERE merchant_id = current_merchant_id()));

CREATE POLICY refund_lines_tenant_isolation ON refund_lines
  USING (refund_id IN (SELECT id FROM refunds WHERE merchant_id = current_merchant_id()));

-- Superuser/service role bypasses RLS
ALTER TABLE merchants FORCE ROW LEVEL SECURITY;
