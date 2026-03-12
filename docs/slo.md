# OpenRegister Service Level Objectives (SLOs)

Last updated: 2026-03-11
Owner: Platform Engineering

---

## SLO 1 — API Availability

| Metric | Target | Error Budget (30d) |
|--------|--------|--------------------|
| Availability (HTTP 5xx rate < 0.1%) | **99.9%** | 43.2 minutes/month |

**Measurement:** `1 - (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])))`
**Window:** 30-day rolling
**Alert:** Page on-call when burn rate > 14.4× for 5 minutes (fast burn)

---

## SLO 2 — Sync Latency (p99)

| Metric | Target | Error Budget (30d) |
|--------|--------|--------------------|
| p99 push-to-visible latency | **< 2 seconds** | 1% of sync operations |

**Measurement:** `histogram_quantile(0.99, rate(sync_push_duration_seconds_bucket[5m]))`
**Window:** 30-day rolling

---

## SLO 3 — Sale Completion Latency (p99)

| Metric | Target | Error Budget (30d) |
|--------|--------|--------------------|
| p99 sale completion (DB write) | **< 500 ms** | 1% of sales |

**Measurement:** `histogram_quantile(0.99, rate(sale_completion_duration_seconds_bucket[5m]))`
**Window:** 30-day rolling

---

## SLO 4 — Payment Success Rate

| Metric | Target | Error Budget (30d) |
|--------|--------|--------------------|
| Card payment success rate | **≥ 99.5%** | 0.5% of payment attempts |

**Measurement:** `1 - (rate(payment_failed_total[5m]) / rate(payment_attempted_total[5m]))`
**Note:** Excludes user-initiated cancellations and declined cards (processor-side declines).

---

## SLO 5 — Stripe Webhook Processing Latency

| Metric | Target | Error Budget (30d) |
|--------|--------|--------------------|
| p99 webhook end-to-end processing | **< 10 seconds** | 1% of events |

**Measurement:** `histogram_quantile(0.99, rate(webhook_processing_duration_seconds_bucket[5m]))`

---

## SLO 6 — Database Connection Pool Availability

| Metric | Target | Error Budget (30d) |
|--------|--------|--------------------|
| Connection pool exhaustion events | **< 1 per hour** | 720 events/month |

**Measurement:** `sum(increase(pg_pool_exhausted_total[1h]))`
**Alert:** Warn if pool utilisation > 80% for 10 minutes.

---

## SLO 7 — Mobile Offline Resilience

| Metric | Target |
|--------|--------|
| Sale completion while API unreachable | **100%** (local SQLite commit) |
| Sync queue recovery after reconnection | **100%** within 5 minutes |

**Measurement:** Manual periodic testing + synthetic monitoring.
**Note:** This SLO is enforced architecturally (CartService uses local SQLite transaction before any network call).
