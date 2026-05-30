import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

type Usage = { provider: string; input_tokens: number; output_tokens: number; total_cost_usd: number };

export default function TokenUsageCard() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getValidToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/chat/usage`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setUsage(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <ActivityIndicator color="#00ADD8" style={{ marginVertical: 12 }} />;

  const totalCost = usage.reduce((sum, u) => sum + u.total_cost_usd, 0);
  const totalTokens = usage.reduce((sum, u) => sum + u.input_tokens + u.output_tokens, 0);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <MaterialIcons name="token" size={20} color="#00ADD8" />
        <Text style={s.title}>Uso de IA este mes</Text>
      </View>
      <View style={s.row}>
        <View style={s.stat}>
          <Text style={s.statValue}>{(totalTokens / 1000).toFixed(1)}K</Text>
          <Text style={s.statLabel}>Tokens</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>${totalCost.toFixed(4)}</Text>
          <Text style={s.statLabel}>Costo USD</Text>
        </View>
      </View>
      {usage.length > 0 && (
        <View style={s.breakdown}>
          {usage.map(u => (
            <View key={u.provider} style={s.providerRow}>
              <Text style={s.providerName}>{u.provider}</Text>
              <Text style={s.providerTokens}>{((u.input_tokens + u.output_tokens) / 1000).toFixed(1)}K tokens</Text>
              <Text style={s.providerCost}>${u.total_cost_usd.toFixed(4)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#0f2035', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#132238' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  stat: { alignItems: 'center' },
  statValue: { color: '#00ADD8', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#4a6a80', fontSize: 11, marginTop: 2 },
  breakdown: { borderTopWidth: 1, borderTopColor: '#132238', paddingTop: 10, gap: 6 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  providerName: { color: '#8aaabf', fontSize: 12, fontWeight: '600', textTransform: 'capitalize', width: 60 },
  providerTokens: { color: '#4a6a80', fontSize: 12, flex: 1 },
  providerCost: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
});
