import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, TextInput, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { generateReceipt, emailReceipt, printReceipt, type ReceiptData } from '../../services/ReceiptService';
import { formatCents } from '../../utils/money';
import { useAuthStore } from '../../stores/authStore';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = StackNavigationProp<RootStackParamList, 'Receipt'>;
type RoutePropType = RouteProp<RootStackParamList, 'Receipt'>;

export function ReceiptScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { saleId } = route.params;
  const { sessionToken } = useAuthStore();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    generateReceipt(saleId).then(setReceipt).catch(console.error);
  }, [saleId]);

  const handleEmail = async () => {
    if (!email || !receipt) return;
    setSending(true);
    try {
      await emailReceipt(saleId, email, sessionToken ?? '');
      Alert.alert('Sent', `Receipt sent to ${email}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to send email receipt');
    } finally {
      setSending(false);
    }
  };

  const handlePrint = async () => {
    try {
      await printReceipt(saleId);
    } catch (err) {
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  if (!receipt) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Receipt</Text>
        <Text style={styles.saleNumber}>#{receipt.saleNumber}</Text>

        <View style={styles.section}>
          {receipt.lines.map((line, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.lineName}>{line.name}</Text>
              <Text style={styles.lineQty}>×{line.qty}</Text>
              <Text style={styles.lineTotal}>{formatCents(line.lineTotalCents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatCents(receipt.subtotalCents)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Tax</Text>
            <Text>{formatCents(receipt.taxCents)}</Text>
          </View>
          {receipt.discountCents > 0 && (
            <View style={styles.totalRow}>
              <Text>Discount</Text>
              <Text>−{formatCents(receipt.discountCents)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandTotalText}>Total</Text>
            <Text style={styles.grandTotalText}>{formatCents(receipt.totalCents)}</Text>
          </View>
        </View>

        <View style={styles.payments}>
          {receipt.payments.map((p, i) => (
            <Text key={i} style={styles.paymentRow}>{p.method}: {formatCents(p.amountCents)}</Text>
          ))}
        </View>

        <View style={styles.emailRow}>
          <TextInput
            style={styles.emailInput}
            placeholder="customer@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.emailBtn} onPress={handleEmail} disabled={sending}>
            <Text style={styles.emailBtnText}>{sending ? '…' : 'Email'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
          <Text style={styles.printBtnText}>🖨 Print Receipt</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.doneBtnText}>Done — New Sale</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  saleNumber: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 20 },
  section: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  lineName: { flex: 1, fontSize: 14 },
  lineQty: { width: 28, textAlign: 'right', color: '#888', fontSize: 13 },
  lineTotal: { width: 70, textAlign: 'right', fontSize: 14, fontWeight: '600' },
  totals: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 6, marginTop: 4 },
  grandTotalText: { fontWeight: '800', fontSize: 16 },
  payments: { marginTop: 12 },
  paymentRow: { fontSize: 13, color: '#555', marginBottom: 2 },
  emailRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  emailInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  emailBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  emailBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  printBtn: { marginTop: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  printBtnText: { fontSize: 15, color: '#444' },
  doneBtn: { margin: 16, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
