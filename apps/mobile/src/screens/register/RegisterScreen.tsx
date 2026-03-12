import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ProductGrid } from '../../components/ProductGrid';
import { CategoryNav } from '../../components/CategoryNav';
import { CartLineRow } from '../../components/CartLineRow';
import { NumPad } from '../../components/NumPad';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { useCartStore } from '../../stores/cartStore';
import { addLine } from '../../services/CartService';
import { formatCents } from '../../utils/money';
import { getDb } from '../../db/client';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { Product, ProductVariant } from '@openregister/types';

type NavProp = StackNavigationProp<RootStackParamList, 'Register'>;

export function RegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const { lines, totals, addLine: storeAddLine, removeLine, updateQty } = useCartStore();
  const [products, setProducts] = useState<(Product & { variants: ProductVariant[] })[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('1');

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [selectedCategory]);

  async function loadProducts() {
    try {
      const db = getDb();
      const query = selectedCategory
        ? 'SELECT * FROM products WHERE is_active = 1 AND category_id = ? ORDER BY name'
        : 'SELECT * FROM products WHERE is_active = 1 ORDER BY name';
      const params = selectedCategory ? [selectedCategory] : [];
      const result = await db.execute(query, params);
      const rows = (result.rows ?? []) as any[];

      const prods = await Promise.all(
        rows.map(async (p) => {
          const varResult = await db.execute('SELECT * FROM product_variants WHERE product_id = ? ORDER BY name', [p.id]);
          return {
            id: p.id,
            merchantId: p.merchant_id,
            name: p.name,
            description: p.description,
            categoryId: p.category_id,
            imageUrl: p.image_url,
            basePrice: p.base_price,
            taxRuleId: p.tax_rule_id,
            isActive: p.is_active === 1,
            createdAt: '',
            updatedAt: '',
            variants: ((varResult.rows ?? []) as any[]).map((v) => ({
              id: v.id,
              productId: v.product_id,
              merchantId: v.merchant_id,
              sku: v.sku,
              name: v.name,
              price: v.price,
              cost: v.cost,
              barcode: v.barcode,
              trackInventory: v.track_inventory === 1,
              createdAt: '',
              updatedAt: '',
            })),
          };
        })
      );
      setProducts(prods as any);
    } catch (err) {
      console.warn('[RegisterScreen] Failed to load products:', err);
    }
  }

  async function loadCategories() {
    try {
      const db = getDb();
      const result = await db.execute('SELECT id, name, color FROM categories ORDER BY sort_order, name');
      setCategories((result.rows ?? []) as any[]);
    } catch (err) {
      console.warn('[RegisterScreen] Failed to load categories:', err);
    }
  }

  const handleSelectVariant = useCallback(async (variant: ProductVariant, product: Product) => {
    const qty = Math.max(1, parseInt(qtyInput, 10) || 1);
    const line = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      variantId: variant.id,
      name: `${product.name}${variant.name !== product.name ? ` - ${variant.name}` : ''}`,
      unitCents: variant.price,
      qty,
      taxBps: 0, // TODO: load from product's tax rule
      discountCents: 0,
    };
    storeAddLine(line);
    setQtyInput('1');
  }, [qtyInput, storeAddLine]);

  const handleNumPad = (key: string) => {
    if (key === '⌫') {
      setQtyInput((v) => v.slice(0, -1) || '0');
    } else if (key === '.') {
      // Qty is integer, ignore decimal
    } else {
      setQtyInput((v) => (v === '0' ? key : v + key));
    }
  };

  const handleCharge = () => {
    if (lines.length === 0) return;
    navigation.navigate('TenderSelection', { amountCents: totals.totalCents });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OpenRegister</Text>
        <SyncStatusBadge />
        <TouchableOpacity style={styles.menuBtn} onPress={() => navigation.navigate('CloseRegister')}>
          <Text style={styles.menuBtnText}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Left panel: product browser */}
        <View style={styles.leftPanel}>
          <CategoryNav categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
          <ProductGrid products={products} onSelect={handleSelectVariant} />
        </View>

        {/* Right panel: cart */}
        <View style={styles.rightPanel}>
          <View style={styles.cartLines}>
            {lines.length === 0 ? (
              <View style={styles.emptyCart}>
                <Text style={styles.emptyCartText}>Cart is empty</Text>
              </View>
            ) : (
              lines.map((line) => (
                <CartLineRow
                  key={line.id}
                  line={line}
                  onRemove={removeLine}
                  onQtyChange={updateQty}
                />
              ))
            )}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCents(totals.subtotalCents)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>{formatCents(totals.taxCents)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatCents(totals.totalCents)}</Text>
            </View>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.numPadWrap}>
              <Text style={styles.qtyLabel}>Qty: {qtyInput}</Text>
              <NumPad value={qtyInput} onPress={handleNumPad} />
            </View>
            <TouchableOpacity
              style={[styles.chargeBtn, lines.length === 0 && styles.chargeBtnDisabled]}
              onPress={handleCharge}
              disabled={lines.length === 0}
            >
              <Text style={styles.chargeBtnText}>Charge</Text>
              <Text style={styles.chargeBtnAmount}>{formatCents(totals.totalCents)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1e40af',
    gap: 12,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  menuBtn: { padding: 4 },
  menuBtnText: { fontSize: 20, color: '#fff' },
  body: { flex: 1, flexDirection: 'row' },
  leftPanel: { flex: 3, borderRightWidth: 1, borderRightColor: '#e5e7eb' },
  rightPanel: { flex: 2, flexDirection: 'column' },
  cartLines: { flex: 1 },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCartText: { color: '#aaa', fontSize: 14 },
  totals: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  grandTotalRow: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#ddd' },
  totalLabel: { fontSize: 13, color: '#666' },
  totalValue: { fontSize: 13, color: '#333' },
  grandTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  grandTotalValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  bottomBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  numPadWrap: { flex: 1 },
  qtyLabel: { fontSize: 12, color: '#666', marginBottom: 4, textAlign: 'center' },
  chargeBtn: { flex: 1, backgroundColor: '#16a34a', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 80 },
  chargeBtnDisabled: { backgroundColor: '#9ca3af' },
  chargeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chargeBtnAmount: { color: '#dcfce7', fontSize: 13, fontWeight: '600', marginTop: 2 },
});
