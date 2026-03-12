# OpenRegister

Production-grade commercial mobile POS platform. Local-first, privacy-preserving, crypto-enabled, multi-terminal.

## Overview

OpenRegister is a complete POS system for modern commerce. Built entirely in TypeScript with React Native (mobile), Next.js (admin), and Fastify (backend). Designed for merchants who want local-first operation, end-to-end control, and blockchain-native payment flows—all without sacrificing reliability or compliance.

**Target**: Android tablets in restaurants, retail, and small venues.  
**Competitors**: Square, Clover, Shopify POS.  
**Unique edge**: Non-custodial crypto payments, delta-commutative inventory, append-only audit logs.

## Key Features

- **Local-first**: SQLCipher-encrypted on-device, syncs every 30 seconds
- **Offline-safe**: Hardware failures never block a sale
- **Crypto-native**: Non-custodial ETH/BTC payments via static addresses (v1) or xpub HD derivation (v2)
- **Compliance-ready**: Immutable event logs, RLS, materialized views for fast reporting
- **Stripe Terminal**: Native contactless/card reader support
- **Multi-terminal**: Merchant can run 50+ terminals, all synced
- **Manager overrides**: Sensitive actions (refunds, discounts) require manager PIN
- **Variance detection**: Automatic cash register reconciliation with manager acknowledgment

## Architecture

### Monorepo Structure

```
openregister/
├── apps/
│   ├── api/              # Fastify backend + PostgreSQL
│   ├── mobile/           # React Native bare workflow
│   ├── admin/            # Next.js 14 admin console
│   └── crypto-watcher/   # Blockchain invoice monitoring
├── packages/
│   ├── types/            # Shared TypeScript types
│   ├── events/           # Event definitions & factories
│   ├── validation/       # Zod schemas
│   ├── providers/        # Payment/hardware/tax provider interfaces
│   ├── plugin-sdk/       # Plugin manifest & API
│   └── test-utils/       # Test data factories
├── infrastructure/       # Prometheus, Docker Compose, Railway
├── scripts/              # Backup/restore, partition maintenance
└── docs/                 # SLOs, incident runbooks, ADRs
```

### Data Model

**Core entities**: Merchant → Location → Device → User.

**Money**: Integer cents (fiat), NUMERIC(30,18) (crypto), basis points (tax).

**Events**: Append-only event_log with monthly partitions. Immutable audit trail for every transaction.

**Inventory**: Delta-commutative design—accept oversell, detect via InventoryCounted, correct with next sync.

### Sync Protocol (4-Step Cycle)

1. **HANDSHAKE**: Poll server for cursor positions
2. **PUSH**: Send pending local events
3. **PULL**: Fetch server events (ordered, idempotent)
4. **ACK**: Mark events acknowledged

Runs every 30s with exponential backoff (1s → 5min max). Five independent cursors per merchant.

### Mobile App (React Native)

- **State**: 8 Zustand stores (auth, cart, register, sync, products, ui, hardware, settings)
- **Services**: CartService (atomic transactions), RegisterService, SyncWorker, AuthService, StripePaymentService, ReceiptService, RefundService
- **Hardware**: Registry pattern with safe fallback wrappers—hardware failures never block a sale
- **Screens**: RegisterScreen (split-panel POS), TenderSelection, CashTender, CryptoQRInvoice, StripePayment, Receipt, CloseRegister

**Database**: op-sqlite + SQLCipher (encrypted via Android Keystore). 12-table schema with migration runner.

**Cart totals**: Always derived from lines at render time—never stored.

### Backend API (Fastify)

- **Routes**: Sync (cursor-based pull), catalog (products/variants), inventory (adjust/count), payments (Stripe intent/webhook), register (sessions), admin (reports/settings)
- **Auth**: JWT device tokens (24h expiry), separate admin JWT
- **RLS**: Row-level security via `app.current_merchant_id` session variable
- **Rate limits**: 100 req/min per device, 1000 req/min per merchant
- **Jobs**: BullMQ workers for Stripe webhooks and materialized view refreshes

### Admin Console (Next.js)

Dashboard (daily sales, top products), Products (search/filter/archive), Merchant settings, Reports.

### Crypto Watcher

Watches ETH and other chains for incoming payments to merchant invoice addresses. Polls every 30s, confirms on-chain, updates invoice status to CONFIRMED.

## Tech Stack

**Frontend**
- React Native bare workflow
- Zustand for state management
- @op-engineering/op-sqlite (encrypted local DB)
- @stripe/stripe-react-native
- Zod for validation
- react-native-qrcode-svg

**Backend**
- Fastify + TypeScript
- PostgreSQL + Prisma ORM
- Redis (job queue, caching)
- BullMQ (async jobs)
- ethers.js (blockchain monitoring)

**Infrastructure**
- Docker Compose (local dev)
- Railway (production deployment)
- GitHub Actions CI/CD
- Prometheus + alerts
- Pino (structured logging)
- OpenTelemetry (distributed tracing)

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm
- PostgreSQL 15+
- Redis 7+

### Development

```bash
# Install dependencies
pnpm install

# Set up PostgreSQL & Redis
docker-compose up -d

# Run migrations
pnpm db:migrate

# Start dev servers
pnpm dev
```

This runs:
- `apps/api` on localhost:3000 (Fastify)
- `apps/admin` on localhost:3001 (Next.js)
- `apps/mobile` on iOS/Android simulator (React Native)

### Production

```bash
# Build all packages
pnpm build

# Deploy to Railway (configured in railway.toml)
railway up
```

## Key Decisions

- **Integer cents everywhere** for money (no floating-point errors)
- **Event sourcing** for audit compliance and time-travel debugging
- **RLS at the database layer** (not application layer) for security
- **Materialized views** for fast reporting without re-computing
- **Non-custodial crypto** (merchant controls private keys)
- **Manager override modal** as a global component (emits event before action proceeds)
- **Exponential backoff** on sync failures (resilient to network flakes)

## Testing

```bash
# Run all tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Load tests (k6)
cd apps/api && pnpm k6:load-test
```

## Documentation

- **ADRs**: `docs/adr/` — architectural decision records
- **SLOs**: `docs/slo.md` — 7 service-level objectives + error budgets
- **Runbooks**: `docs/runbooks/` — incident response playbooks
- **Schemas**: `apps/api/prisma/schema.prisma` — full data model

## License

MIT

---

**Built with ❤️ for merchants who value control and compliance.**
