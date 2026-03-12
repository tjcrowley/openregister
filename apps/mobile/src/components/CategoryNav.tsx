import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  categories: Array<{ id: string; name: string; color?: string }>;
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
}

export function CategoryNav({ categories, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.pill, !selected && styles.pillSelected]}
        onPress={() => onSelect(null)}
      >
        <Text style={[styles.pillText, !selected && styles.pillTextSelected]}>All</Text>
      </TouchableOpacity>

      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[
            styles.pill,
            selected === cat.id && styles.pillSelected,
            cat.color ? { borderColor: cat.color } : undefined,
          ]}
          onPress={() => onSelect(cat.id)}
        >
          <Text
            style={[
              styles.pillText,
              selected === cat.id && styles.pillTextSelected,
            ]}
          >
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pillSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  pillText: { fontSize: 13, color: '#333', fontWeight: '500' },
  pillTextSelected: { color: '#fff' },
});
