'use client';
import React, { useEffect, useState } from 'react';
import type { Product } from '@openregister/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function getToken() {
  if (typeof localStorage !== 'undefined') return localStorage.getItem('admin_token') ?? '';
  return '';
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState('');

  useEffect(() => {
    // In a real app, merchantId comes from the logged-in admin's context
    const mid = localStorage.getItem('merchant_id') ?? '';
    setMerchantId(mid);
    if (mid) fetchProducts(mid, '');
    else setLoading(false);
  }, []);

  async function fetchProducts(mid: string, q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ merchantId: mid });
      if (q) params.set('search', q);
      const res = await fetch(`${API_BASE}/admin/products?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setProducts(data.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    fetchProducts(merchantId, e.target.value);
  };

  const handleArchive = async (productId: string) => {
    if (!confirm('Archive this product?')) return;
    await fetch(`${API_BASE}/admin/products/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    fetchProducts(merchantId, search);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Products</h1>
        <button
          style={{ background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => alert('Add product — TODO')}
        >
          + Add Product
        </button>
      </div>

      <input
        type="search"
        placeholder="Search products…"
        value={search}
        onChange={handleSearch}
        style={{ width: '100%', maxWidth: 360, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 16 }}
      />

      {!merchantId && (
        <p style={{ color: '#6b7280' }}>Please log in with a merchant account to manage products.</p>
      )}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Name', 'Base Price', 'Status', 'Actions'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>${(p.basePrice / 100).toFixed(2)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: p.isActive ? '#dcfce7' : '#f3f4f6', color: p.isActive ? '#166534' : '#6b7280', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    {p.isActive ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleArchive(p.id)}
                    style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: '#374151' }}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
