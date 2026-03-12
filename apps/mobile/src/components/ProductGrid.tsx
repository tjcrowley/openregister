import React from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet, Image } from 'react-native';
import type { Product, ProductVariant } from '@openregister/types';
import { formatCents } from '../utils/money';

interface Props {
  products: (Product & { variants: ProductVariant[] })[];
  onSelect: (variant: ProductVariant, product: Product) => void;
}

export function ProductGrid({ products, onSelect }: Props) {
  const items = products.flatMap((p) =>
    p.variants.map((v) => ({ product: p, variant: v }))
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.variant.id}
      numColumns={3}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => onSelect(item.variant, item.product)}
          activeOpacity={0.7}
        >
          {item.product.imageUrl ? (
            <Image source={{ uri: item.product.imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder} />
          )}
          <Text style={styles.name} numberOfLines={2}>
            {item.product.name}
          </Text>
          {item.variant.name !== item.product.name && (
            <Text style={styles.variantName} numberOfLines={1}>
              {item.variant.name}
            </Text>
          )}
          <Text style={styles.price}>{formatCents(item.variant.price)}</Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.grid}
    />
  );
}

const styles = StyleSheet.create({
  grid: { padding: 4 },
  card: {
    flex: 1,
    margin: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    minHeight: 100,
  },
  image: { width: 60, height: 60, borderRadius: 4, marginBottom: 4 },
  imagePlaceholder: { width: 60, height: 60, backgroundColor: '#f0f0f0', borderRadius: 4, marginBottom: 4 },
  name: { fontSize: 12, fontWeight: '600', textAlign: 'center', color: '#1a1a1a' },
  variantName: { fontSize: 11, color: '#666', textAlign: 'center' },
  price: { fontSize: 13, fontWeight: '700', color: '#2563eb', marginTop: 2 },
});
