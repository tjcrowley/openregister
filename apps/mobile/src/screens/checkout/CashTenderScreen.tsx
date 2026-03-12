import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { NumPad } from '../../components/NumPad';
import { formatCents, parseToCents } from '../../utils/money';
import { useCartStore } from '../../stores/cartStore';
import { completeSale } from '../../services/CartService';
import { useAuthStore } from '../../stores/authStore';
import { useRegisterStore } from '../../stores/registerStore';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = StackNavigationProp<RootStackParamList, 'CashTender'>;
type RoutePropType = RouteProp<RootStackParamList, 'CashTender'>;

const QUICK_AMOUNTS = [2000, 5000, 10000]; // $20, $50, $100

export function CashTenderScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { amountCents } = route.params;
  const [tenderedStr, setTenderedStr] = useState('');
  const [loading, setLoading] = useState(false);

  const { lines, clearCart } = useCartStore();
  const { currentUser } = useAuthStore();
  const { currentSession } = useRegisterStore();

  const tenderedCents = parseToCents(tenderedStr);
  const changeCents = Math.max(0, tenderedCents - amountCents);
  const isExact = tenderedCents === amountCents;

  const handleNumPad = (key: string) => {
    if (key === '⌫') {
      setTenderedStr((v) => v.slice(0, -1));
    } else {
      setTenderedStr((v) => v + key);
    }
  };

  const handleCharge = async () => {
    if (tenderedCents < amountCents) return;
    setLoading(true);
    try {
      const result = await completeSale(
        lines,
        { method: 'CASH', amountCents: tenderedCents },
        {
          merchantId: currentUser!.merchantId,
          locationId: currentSession!.locationId,
          registerId: currentSession!.id,
          sessionId: currentSession!.id,
          deviceId: 'local-device',
          userId: currentUser!.id,
        }
      );
      clearCart();
      navigation.replace('Receipt', { saleId: result.saleId });
    } catch (err) {
      console.error('[CashTender] Error completing sale:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cash Payment</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Amount Due</Text>
        <Text style={styles.amountDue}>{formatCents(amountCents)}</Text>

        <Text style={styles.label}>Tendered</Text>
        <Text style={styles.tendered}>{tenderedStr ? formatCents(tenderedCents) : '—'}</Text>

        {tenderedCents >= amountCents && (
          <>
            <Text style={styles.label}>Change</Text>
            <Text style={styles.change}>{formatCents(changeCents)}</Text>
          </>
        )}

        <View style={styles.quickAmounts}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setTenderedStr(String(amountCents / 100))}>
            <Text style={styles.quickBtnText}>Exact</Text>
          </TouchableOpacity>
          {QUICK_AMOUNTS.map((a) => (
            a >= amountCents && (
              <TouchableOpacity key={a} style={styles.quickBtn} onPress={() => setTenderedStr(String(a / 100))}>
                <Text style={styles.quickBtnText}>{formatCents(a)}</Text>
              </TouchableOpacity>
            )
          ))}
        </View>

        <NumPad value={tenderedStr} onPress={handleNumPad} />

        <TouchableOpacity
          style={[styles.chargeBtn, (tenderedCents < amountCents || loading) && styles.chargeBtnDisabled]}
          onPress={handleCharge}
          disabled={tenderedCents < amountCents || loading}
        >
          <Text style={styles.chargeBtnText}>{loading ? 'Processing…' : `Confirm ${formatCents(amountCents)}`}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { color: '#2563eb', fontSize: 16, marginRight: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1, padding: 20, alignItems: 'center' },
  label: { fontSize: 13, color: '#666', marginTop: 12 },
  amountDue: { fontSize: 32, fontWeight: '800', color: '#1a1a1a' },
  tendered: { fontSize: 28, fontWeight: '700', color: '#2563eb' },
  change: { fontSize: 24, fontWeight: '700', color: '#16a34a' },
  quickAmounts: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#eff6ff', borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  quickBtnText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  chargeBtn: { marginTop: 16, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  chargeBtnDisabled: { backgroundColor: '#9ca3af' },
  chargeBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
