import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

type Recommendation = {
  title: string;
  description: string;
  ticker?: string;
  action?: 'buy' | 'sell' | 'hold' | 'watch';
};

const ACTION_CONFIG: Record<string, { color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  buy:   { color: '#22c55e', icon: 'trending-up' },
  sell:  { color: '#ef4444', icon: 'trending-down' },
  hold:  { color: '#f59e0b', icon: 'pause-circle-outline' },
  watch: { color: '#00ADD8', icon: 'visibility' },
};

export default function RecommendationsTab() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getValidToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setRecs(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecs(); }, [fetchRecs]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ADD8" />
        <Text style={styles.loadingText}>Generando recomendaciones con IA...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="error-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchRecs}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="auto-awesome" size={20} color="#00ADD8" />
        <Text style={styles.headerText}>Recomendaciones personalizadas</Text>
      </View>
      <Text style={styles.subtitle}>Basadas en tu perfil de riesgo y cartera actual</Text>

      {recs.map((rec, i) => {
        const actionCfg = rec.action ? ACTION_CONFIG[rec.action] : null;
        return (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{rec.title}</Text>
              {rec.ticker && <Text style={styles.ticker}>{rec.ticker}</Text>}
            </View>
            <Text style={styles.cardDesc}>{rec.description}</Text>
            {actionCfg && rec.action && (
              <View style={[styles.actionBadge, { borderColor: actionCfg.color }]}>
                <MaterialIcons name={actionCfg.icon} size={14} color={actionCfg.color} />
                <Text style={[styles.actionText, { color: actionCfg.color }]}>
                  {rec.action.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      <TouchableOpacity style={styles.refreshBtn} onPress={fetchRecs}>
        <MaterialIcons name="refresh" size={18} color="#00ADD8" />
        <Text style={styles.refreshText}>Actualizar recomendaciones</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { color: '#4a6a80', fontSize: 14, textAlign: 'center' },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: '#132238', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#00ADD8', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  headerText: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#4a6a80', fontSize: 13, marginBottom: 8 },
  card: {
    backgroundColor: '#0f2035',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#132238',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  ticker: {
    color: '#00ADD8', fontSize: 12, fontWeight: '700',
    backgroundColor: '#0a1628', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  cardDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  actionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  actionText: { fontSize: 11, fontWeight: '700' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, marginTop: 4,
  },
  refreshText: { color: '#00ADD8', fontSize: 14, fontWeight: '600' },
});
