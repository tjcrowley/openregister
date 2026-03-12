import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatCents, computeLineTotal, type CartLine } from '../utils/money';

interface Props {
  line: CartLine;
  onRemove: (lineId: string) => void;
  onQtyChange: (lineId: string, qty: number) => void;
}

export function CartLineRow({ line, onRemove, onQtyChange }: Props) {
  const lineTotal = computeLineTotal(line);

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{line.name}</Text>
        <Text style={styles.unitPrice}>{formatCents(line.unitCents)} ea</Text>
      </View>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onQtyChange(line.id, line.qty - 1)}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qty}>{line.qty}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onQtyChange(line.id, line.qty + 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.lineTotal}>{formatCents(lineTotal)}</Text>
      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(line.id)}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  unitPrice: { fontSize: 12, color: '#888', marginTop: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#333' },
  qty: { width: 32, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  lineTotal: { width: 64, textAlign: 'right', fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  removeBtn: { marginLeft: 8, padding: 4 },
  removeBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },
});
