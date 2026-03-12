import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onPress: (key: string) => void;
}

const KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
];

export function NumPad({ value, onPress }: Props) {
  return (
    <View style={styles.container}>
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.key, key === '⌫' && styles.backspaceKey]}
              onPress={() => onPress(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.keyText, key === '⌫' && styles.backspaceText]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  key: {
    flex: 1,
    marginHorizontal: 3,
    height: 52,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  backspaceKey: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  keyText: { fontSize: 20, fontWeight: '600', color: '#1a1a1a' },
  backspaceText: { color: '#ef4444' },
});
