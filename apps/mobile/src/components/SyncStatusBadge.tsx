import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSyncStore } from '../stores/syncStore';

export function SyncStatusBadge() {
  const { status, pendingCount } = useSyncStore();

  const config = {
    idle: { color: '#22c55e', label: 'Synced' },
    syncing: { color: '#f59e0b', label: 'Syncing…' },
    error: { color: '#ef4444', label: 'Sync error' },
    offline: { color: '#94a3b8', label: 'Offline' },
  };

  const { color, label } = config[status];

  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      {pendingCount > 0 && (
        <Text style={styles.pending}>({pendingCount})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: '600' },
  pending: { fontSize: 10, color: '#888' },
});
