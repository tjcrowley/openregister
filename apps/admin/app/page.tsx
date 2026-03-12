import React from 'react';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000';

async function getDailyReport(merchantId: string) {
  try {
    const res = await fetch(`${API_BASE}/admin/reports/daily?merchantId=${merchantId}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN ?? ''}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const merchantId = process.env.DEFAULT_MERCHANT_ID ?? '';
  const report = merchantId ? await getDailyReport(merchantId) : null;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700 }}>Dashboard</h1>

      {!merchantId && (
        <div style={card}>
          <p style={{ color: '#6b7280' }}>Set DEFAULT_MERCHANT_ID in environment to see live data.</p>
        </div>
      )}

      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <StatCard
            title="Daily Sales"
            value={`$${(report.totalCents / 100).toFixed(2)}`}
          />
          <StatCard
            title="Transactions"
            value={String(report.transactionCount)}
          />
          <StatCard
            title="Tax Collected"
            value={`$${(report.taxCents / 100).toFixed(2)}`}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={card}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#111827' }}>{value}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
