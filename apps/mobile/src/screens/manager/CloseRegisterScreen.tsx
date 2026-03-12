import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { closeSession, RequiresManagerApproval } from '../../services/RegisterService';
import { verifyManagerPin } from '../../services/AuthService';
import { useRegisterStore } from '../../stores/registerStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCents } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = StackNavigationProp<RootStackParamList, 'CloseRegister'>;

interface DenominationCount {
  label: string;
  cents: number;
  count: string;
}

const DENOMINATIONS: DenominationCount[] = [
  { label: '$100', cents: 10000, count: '' },
  { label: '$50', cents: 5000, count: '' },
  { label: '$20', cents: 2000, count: '' },
  { label: '$10', cents: 1000, count: '' },
  { label: '$5', cents: 500, count: '' },
  { label: '$1', cents: 100, count: '' },
  { label: '¢25', cents: 25, count: '' },
  { label: '¢10', cents: 10, count: '' },
  { label: '¢5', cents: 5, count: '' },
  { label: '¢1', cents: 1, count: '' },
];

type Step = 1 | 2 | 3;

export function CloseRegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const { currentSession, closeSession: storeCloseSession } = useRegisterStore();
  const { currentUser } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [denoms, setDenoms] = useState<DenominationCount[]>(DENOMINATIONS.map((d) => ({ ...d })));
  const [varianceInfo, setVarianceInfo] = useState<{ varianceCents: number; expectedCashCents: number; countedCashCents: number } | null>(null);
  const [managerPin, setManagerPin] = useState('');
  const [loading, setLoading] = useState(false);

  const countedCents = denoms.reduce((sum, d) => sum + d.cents * (parseInt(d.count, 10) || 0), 0);

  const updateCount = (idx: number, value: string) => {
    const updated = [...denoms];
    updated[idx] = { ...updated[idx], count: value };
    setDenoms(updated);
  };

  const handleCountComplete = async () => {
    if (!currentSession || !currentUser) return;
    setLoading(true);
    try {
      const closed = await closeSession(currentSession.id, countedCents, { merchantId: currentUser.merchantId });
      storeCloseSession();
      navigation.navigate('Register');
    } catch (err) {
      if (err instanceof RequiresManagerApproval) {
        setVarianceInfo({
          varianceCents: err.varianceCents,
          expectedCashCents: err.expectedCashCents,
          countedCashCents: err.countedCashCents,
        });
        setStep(2);
      } else {
        Alert.alert('Error', String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManagerApproval = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const manager = await verifyManagerPin(managerPin, currentUser.merchantId);
      if (!manager) {
        Alert.alert('Error', 'Invalid manager PIN');
        return;
      }
      setStep(3);
    } catch (err) {
      Alert.alert('Error', 'Manager verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!currentSession || !currentUser) return;
    setLoading(true);
    try {
      // Force close with override
      const db = (await import('../../db/client')).getDb();
      await db.execute(
        "UPDATE register_sessions SET status = 'CLOSED', counted_cash_cents = ?, closing_cash_cents = ?, variance_cents = ?, closed_at = unixepoch() WHERE id = ?",
        [varianceInfo!.countedCashCents, varianceInfo!.expectedCashCents, varianceInfo!.varianceCents, currentSession.id]
      );
      storeCloseSession();
      navigation.navigate('Register');
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Close Register — Step 1/3</Text>
        </View>
        <Text style={styles.subtitle}>Count Cash by Denomination</Text>
        <ScrollView contentContainerStyle={styles.denomList}>
          {denoms.map((d, i) => (
            <View key={d.label} style={styles.denomRow}>
              <Text style={styles.denomLabel}>{d.label}</Text>
              <TextInput
                style={styles.denomInput}
                value={d.count}
                onChangeText={(v) => updateCount(i, v)}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.denomSubtotal}>
                = {formatCents(d.cents * (parseInt(d.count, 10) || 0))}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Counted:</Text>
            <Text style={styles.totalValue}>{formatCents(countedCents)}</Text>
          </View>
        </ScrollView>
        <TouchableOpacity style={styles.nextBtn} onPress={handleCountComplete} disabled={loading}>
          <Text style={styles.nextBtnText}>{loading ? 'Calculating…' : 'Next →'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (step === 2 && varianceInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Close Register — Step 2/3</Text>
        </View>
        <View style={styles.varianceBox}>
          <Text style={styles.varianceTitle}>⚠️ Variance Detected</Text>
          <Text style={styles.varianceRow}>Expected: {formatCents(varianceInfo.expectedCashCents)}</Text>
          <Text style={styles.varianceRow}>Counted: {formatCents(varianceInfo.countedCashCents)}</Text>
          <Text style={[styles.varianceRow, styles.varianceAmount, varianceInfo.varianceCents < 0 && styles.varianceNeg]}>
            Variance: {varianceInfo.varianceCents >= 0 ? '+' : ''}{formatCents(Math.abs(varianceInfo.varianceCents))} {varianceInfo.varianceCents < 0 ? '(short)' : '(over)'}
          </Text>
        </View>
        <Text style={styles.managerLabel}>Manager PIN Required</Text>
        <TextInput
          style={styles.pinInput}
          value={managerPin}
          onChangeText={setManagerPin}
          secureTextEntry
          keyboardType="numeric"
          maxLength={8}
          placeholder="Enter manager PIN"
        />
        <TouchableOpacity style={styles.nextBtn} onPress={handleManagerApproval} disabled={loading}>
          <Text style={styles.nextBtnText}>{loading ? 'Verifying…' : 'Verify Manager'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (step === 3 && varianceInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Close Register — Step 3/3</Text>
        </View>
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>Confirm Register Close</Text>
          <Text style={styles.confirmRow}>Opening Cash: {formatCents(currentSession?.openingCashCents ?? 0)}</Text>
          <Text style={styles.confirmRow}>Counted Cash: {formatCents(varianceInfo.countedCashCents)}</Text>
          <Text style={styles.confirmRow}>Expected Cash: {formatCents(varianceInfo.expectedCashCents)}</Text>
          <Text style={[styles.confirmRow, varianceInfo.varianceCents < 0 && styles.varianceNeg]}>
            Variance: {varianceInfo.varianceCents >= 0 ? '+' : ''}{formatCents(Math.abs(varianceInfo.varianceCents))}
          </Text>
        </View>
        <Text style={styles.approvedBadge}>✅ Manager Override Approved</Text>
        <TouchableOpacity style={[styles.nextBtn, styles.closeBtn]} onPress={handleConfirmClose} disabled={loading}>
          <Text style={styles.nextBtnText}>{loading ? 'Closing…' : 'Confirm Close Register'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { color: '#2563eb', fontSize: 16, marginRight: 16 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  denomList: { padding: 16 },
  denomRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  denomLabel: { width: 48, fontSize: 15, fontWeight: '600' },
  denomInput: { width: 64, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center', fontSize: 15 },
  denomSubtotal: { flex: 1, textAlign: 'right', fontSize: 14, color: '#555', marginLeft: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  nextBtn: { margin: 16, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  closeBtn: { backgroundColor: '#dc2626' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  varianceBox: { margin: 16, padding: 16, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' },
  varianceTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#92400e' },
  varianceRow: { fontSize: 15, color: '#444', marginBottom: 4 },
  varianceAmount: { fontWeight: '700', color: '#16a34a', fontSize: 16 },
  varianceNeg: { color: '#dc2626' },
  managerLabel: { fontSize: 14, color: '#444', marginHorizontal: 16, marginTop: 12, marginBottom: 6 },
  pinInput: { marginHorizontal: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 18, textAlign: 'center' },
  confirmBox: { margin: 16, padding: 16, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  confirmTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  confirmRow: { fontSize: 15, color: '#444', marginBottom: 4 },
  approvedBadge: { textAlign: 'center', fontSize: 16, color: '#16a34a', fontWeight: '700', marginVertical: 12 },
});
