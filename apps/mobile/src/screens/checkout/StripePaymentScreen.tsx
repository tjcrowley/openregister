import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { formatCents } from '../../utils/money';
import { createPaymentIntent, collectPayment, processPayment } from '../../services/StripePaymentService';
import { useAuthStore } from '../../stores/authStore';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = StackNavigationProp<RootStackParamList, 'StripePayment'>;
type RoutePropType = RouteProp<RootStackParamList, 'StripePayment'>;

type State = 'idle' | 'creating_intent' | 'collecting' | 'processing' | 'success' | 'error';

export function StripePaymentScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { amountCents, saleId } = route.params;
  const { sessionToken } = useAuthStore();
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => { startPayment(); }, []);

  async function startPayment() {
    try {
      setState('creating_intent');
      const { clientSecret, paymentIntentId } = await createPaymentIntent(
        amountCents,
        'usd',
        saleId,
        sessionToken ?? ''
      );

      setState('collecting');
      const result = await collectPayment(clientSecret);
      if (!result.success) throw new Error(result.error);

      setState('processing');
      await processPayment(paymentIntentId, saleId, sessionToken ?? '');

      setState('success');
      navigation.replace('Receipt', { saleId });
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Payment failed');
      setState('error');
    }
  }

  const statusMessages: Record<State, string> = {
    idle: 'Starting payment…',
    creating_intent: 'Creating payment…',
    collecting: 'Tap or insert card on reader…',
    processing: 'Processing payment…',
    success: 'Payment successful!',
    error: errorMsg ?? 'Payment failed',
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Card Payment</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.amount}>{formatCents(amountCents)}</Text>

        {state !== 'error' && state !== 'success' && (
          <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
        )}

        {state === 'success' && <Text style={styles.success}>✅ Payment Complete</Text>}

        <Text style={[styles.status, state === 'error' && styles.statusError]}>
          {statusMessages[state]}
        </Text>

        {state === 'error' && (
          <TouchableOpacity style={styles.retryBtn} onPress={startPayment}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
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
  body: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  amount: { fontSize: 40, fontWeight: '800', color: '#1a1a1a', marginBottom: 32 },
  spinner: { marginBottom: 24 },
  success: { fontSize: 32, fontWeight: '700', color: '#16a34a', marginBottom: 16 },
  status: { fontSize: 16, color: '#444', textAlign: 'center' },
  statusError: { color: '#dc2626' },
  retryBtn: { marginTop: 24, backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 32, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
