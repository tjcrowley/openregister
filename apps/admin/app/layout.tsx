import type { Metadata } from 'next';
import React from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenRegister Admin',
  description: 'OpenRegister merchant admin portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh' }}>
        <nav style={{ width: 220, background: '#1e40af', color: '#fff', padding: '20px 0', flexShrink: 0 }}>
          <div style={{ padding: '0 20px 24px', fontWeight: 700, fontSize: 18 }}>
            OpenRegister
          </div>
          <a href="/" style={navLink}>Dashboard</a>
          <a href="/products" style={navLink}>Products</a>
        </nav>
        <main style={{ flex: 1, background: '#f9fafb', padding: 24 }}>
          {children}
        </main>
      </body>
    </html>
  );
}

const navLink: React.CSSProperties = {
  display: 'block',
  padding: '10px 20px',
  color: '#bfdbfe',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
};
