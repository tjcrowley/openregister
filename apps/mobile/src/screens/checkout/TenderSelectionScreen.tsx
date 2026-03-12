import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { formatCents } from '../../utils/money';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = StackNavigationProp<RootStackParamList, 'TenderSelection'>;
type RoutePropType = RouteProp<RootStackParamList, 'TenderSelection'>;

export function TenderSelectionScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { amountCents } = route.params;

  const methods = [
    { label: 'Cash', icon: '💵', onPress: () => navigation.navigate('CashTender', { amountCents }) },
    { label: 'Card', icon: '💳', onPress: () => navigation.navigate('StripePayment', { amountCents, saleId: '' }) },
    { label: 'Crypto', icon: '₿', onPress: () => navigation.navigate('CryptoQRInvoice', { saleId: '', amountCents, currency: 'ETH' }) },
    { label: 'Split', icon: '⚡', onPress: () => {} }, // TODO
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select Payment Method</Text>
      </View>
      <Text style={styles.amount}>Amount Due: {formatCents(amountCents)}</Text>
      <View style={styles.methods}>
        {methods.map((m) => (
          <TouchableOpacity key={m.label} style={styles.methodBtn} onPress={m.onPress}>
            <Text style={styles.methodIcon}>{m.icon}</Text>
            <Text style={styles.methodLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { marginRight: 12 },
  backText: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  amount: { textAlign: 'center', fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginVertical: 24 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, padding: 16 },
  methodBtn: { width: 140, height: 120, backgroundColor: '#f8f8f8', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  methodIcon: { fontSize: 36, marginBottom: 8 },
  methodLabel: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
});
