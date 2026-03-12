import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { formatCents } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { CryptoInvoiceStatus } from '@openregister/types';

type NavProp = StackNavigationProp<RootStackParamList, 'CryptoQRInvoice'>;
type RoutePropType = RouteProp<RootStackParamList, 'CryptoQRInvoice'>;

const POLL_INTERVAL_MS = 5000;
const INVOICE_TIMEOUT_MS = 15 * 60 * 1000;
const API_BASE = process.env.API_URL ?? 'http://localhost:3000';

interface InvoiceState {
  status: CryptoInvoiceStatus;
  address?: string;
  amountCrypto?: string;
  paidAmountCrypto?: string;
  remainingCents?: number;
}

export function CryptoQRInvoiceScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { saleId, amountCents, currency } = route.params;

  const [invoice, setInvoice] = useState<InvoiceState>({ status: 'GENERATING' });
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    createInvoice();
    timeoutRef.current = setTimeout(() => {
      setInvoice((prev) => ({ ...prev, status: 'EXPIRED' }));
      clearPoll();
    }, INVOICE_TIMEOUT_MS);
    return () => { clearPoll(); if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  function clearPoll() {
    if (pollRef.current) clearInterval(pollRef.current);
  }

  async function createInvoice() {
    try {
      const res = await fetch(`${API_BASE}/payments/crypto/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, amountCents, currency }),
      });
      const data = await res.json();
      const inv = data.invoice;
      setInvoiceId(inv.id);
      setInvoice({ status: 'PENDING', address: inv.address, amountCrypto: inv.amountCrypto });
      startPolling(inv.id);
    } catch (err) {
      setError('Failed to create invoice');
      setInvoice((prev) => ({ ...prev, status: 'ERROR' }));
    }
  }

  function startPolling(id: string) {
    pollRef.current = setInterval(() => pollStatus(id), POLL_INTERVAL_MS);
  }

  async function pollStatus(id: string) {
    try {
      const res = await fetch(`${API_BASE}/payments/crypto/invoices/${id}/status`);
      const data = await res.json();
      const inv = data.invoice;
      setInvoice({
        status: inv.status,
        address: inv.address,
        amountCrypto: inv.amountCrypto,
        paidAmountCrypto: inv.paidAmountCrypto,
        remainingCents: data.remainingCents,
      });

      if (inv.status === 'CONFIRMED') {
        clearPoll();
        navigation.replace('Receipt', { saleId });
      } else if (inv.status === 'EXPIRED' || inv.status === 'ERROR') {
        clearPoll();
      }
    } catch (err) {
      console.warn('[CryptoQR] Poll error:', err);
    }
  }

  const qrValue = invoice.address ? `${currency.toLowerCase()}:${invoice.address}?amount=${invoice.amountCrypto}` : '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pay with {currency}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.amount}>{formatCents(amountCents)}</Text>

        {invoice.status === 'GENERATING' && (
          <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
        )}

        {(invoice.status === 'PENDING' || invoice.status === 'PARTIAL') && invoice.address && (
          <>
            <View style={styles.qrContainer}>
              <QRCode value={qrValue} size={200} />
            </View>
            <Text style={styles.addressLabel}>Send to address:</Text>
            <Text style={styles.address}>{invoice.address}</Text>
            <Text style={styles.cryptoAmount}>{invoice.amountCrypto} {currency}</Text>

            {invoice.status === 'PARTIAL' && (
              <View style={styles.partialWarning}>
                <Text style={styles.partialText}>Partial payment received.</Text>
                {invoice.remainingCents && (
                  <Text style={styles.partialText}>Remaining: {formatCents(invoice.remainingCents)}</Text>
                )}
              </View>
            )}

            <View style={styles.polling}>
              <ActivityIndicator size="small" color="#888" />
              <Text style={styles.pollingText}>Waiting for payment…</Text>
            </View>
          </>
        )}

        {invoice.status === 'CONFIRMED' && (
          <Text style={styles.confirmed}>✅ Payment Confirmed!</Text>
        )}

        {invoice.status === 'EXPIRED' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Invoice expired. Please try again.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={createInvoice}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {invoice.status === 'ERROR' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error ?? 'An error occurred.'}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={createInvoice}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { color: '#2563eb', fontSize: 16, marginRight: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1, padding: 24, alignItems: 'center' },
  amount: { fontSize: 32, fontWeight: '800', color: '#1a1a1a', marginBottom: 24 },
  spinner: { marginTop: 40 },
  qrContainer: { padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  addressLabel: { marginTop: 16, fontSize: 12, color: '#666' },
  address: { fontSize: 12, color: '#1a1a1a', fontFamily: 'monospace', textAlign: 'center', marginTop: 4 },
  cryptoAmount: { fontSize: 16, fontWeight: '700', color: '#f59e0b', marginTop: 8 },
  polling: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  pollingText: { color: '#888', fontSize: 13 },
  confirmed: { fontSize: 24, fontWeight: '700', color: '#16a34a', marginTop: 40 },
  partialWarning: { marginTop: 12, padding: 12, backgroundColor: '#fffbeb', borderRadius: 8, alignItems: 'center' },
  partialText: { color: '#92400e', fontSize: 14 },
  errorBox: { marginTop: 24, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 16, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
