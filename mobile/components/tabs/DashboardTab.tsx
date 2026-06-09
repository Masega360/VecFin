import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface HoldingInfo {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  change_pct: number;
}

interface PerformerInfo {
  symbol: string;
  name: string;
  change_pct: number;
}

interface DashboardData {
  total_value: number;
  total_gain: number;
  total_gain_pct: number;
  day_change: number;
  day_change_pct: number;
  holdings: HoldingInfo[];
  top_performer: PerformerInfo | null;
  worst_performer: PerformerInfo | null;
  active_alerts: number;
  total_wallets: number;
  total_assets: number;
}

export default function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return <ActivityIndicator color="#00ADD8" style={{ flex: 1 }} />;
  }

  if (!data) {
    return (
      <View style={styles.empty}>
        <MaterialIcons name="dashboard" size={48} color="#1e3a5a" />
        <Text style={styles.emptyText}>No se pudo cargar el dashboard</Text>
      </View>
    );
  }

  const positive = data.day_change >= 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboard(); }} tintColor="#00ADD8" />}
    >
      {/* Portfolio Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Valor del Portfolio</Text>
        <Text style={styles.summaryValue}>${data.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        <View style={[styles.changePill, { backgroundColor: positive ? '#0d2a1a' : '#2a0d0d' }]}>
          <MaterialIcons name={positive ? 'arrow-drop-up' : 'arrow-drop-down'} size={20} color={positive ? '#00D26A' : '#FF4D4D'} />
          <Text style={{ color: positive ? '#00D26A' : '#FF4D4D', fontWeight: '700', fontSize: 14 }}>
            {positive ? '+' : ''}{data.day_change.toFixed(2)} ({positive ? '+' : ''}{data.day_change_pct.toFixed(2)}%) hoy
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialIcons name="account-balance-wallet" size={20} color="#00ADD8" />
          <Text style={styles.statNumber}>{data.total_wallets}</Text>
          <Text style={styles.statLabel}>Wallets</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="trending-up" size={20} color="#00ADD8" />
          <Text style={styles.statNumber}>{data.total_assets}</Text>
          <Text style={styles.statLabel}>Assets</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="notifications-active" size={20} color="#00ADD8" />
          <Text style={styles.statNumber}>{data.active_alerts}</Text>
          <Text style={styles.statLabel}>Alertas</Text>
        </View>
      </View>

      {/* Top / Worst Performers */}
      {(data.top_performer || data.worst_performer) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance del día</Text>
          {data.top_performer && (
            <View style={[styles.performerCard, { borderLeftColor: '#00D26A' }]}>
              <MaterialIcons name="emoji-events" size={20} color="#00D26A" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.performerSymbol}>{data.top_performer.symbol}</Text>
                <Text style={styles.performerName}>{data.top_performer.name}</Text>
              </View>
              <Text style={[styles.performerPct, { color: '#00D26A' }]}>+{data.top_performer.change_pct.toFixed(2)}%</Text>
            </View>
          )}
          {data.worst_performer && (
            <View style={[styles.performerCard, { borderLeftColor: '#FF4D4D' }]}>
              <MaterialIcons name="trending-down" size={20} color="#FF4D4D" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.performerSymbol}>{data.worst_performer.symbol}</Text>
                <Text style={styles.performerName}>{data.worst_performer.name}</Text>
              </View>
              <Text style={[styles.performerPct, { color: '#FF4D4D' }]}>{data.worst_performer.change_pct.toFixed(2)}%</Text>
            </View>
          )}
        </View>
      )}

      {/* Holdings Distribution */}
      {data.holdings && data.holdings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distribución</Text>
          {data.holdings.map(h => (
            <View key={h.symbol} style={styles.holdingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                <Text style={styles.holdingName}>{h.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.holdingValue}>${h.value.toFixed(2)}</Text>
                <Text style={styles.holdingPct}>{h.percentage.toFixed(1)}%</Text>
              </View>
              {/* Mini bar */}
              <View style={styles.barContainer}>
                <View style={[styles.bar, { width: `${Math.min(h.percentage, 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  content: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#4a6a80', fontSize: 14 },

  summaryCard: {
    backgroundColor: '#132238', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#1e3a5a', marginBottom: 16,
  },
  summaryLabel: { color: '#4a6a80', fontSize: 13, marginBottom: 4 },
  summaryValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
  changePill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#132238', borderRadius: 12, padding: 14,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#1e3a5a',
  },
  statNumber: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#4a6a80', fontSize: 11 },

  section: { marginBottom: 20 },
  sectionTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginBottom: 10 },

  performerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#132238',
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderLeftWidth: 3, borderWidth: 1, borderColor: '#1e3a5a',
  },
  performerSymbol: { color: '#fff', fontSize: 14, fontWeight: '700' },
  performerName: { color: '#4a6a80', fontSize: 12 },
  performerPct: { fontSize: 16, fontWeight: '700' },

  holdingRow: {
    backgroundColor: '#132238', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#1e3a5a', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
  },
  holdingSymbol: { color: '#fff', fontSize: 14, fontWeight: '700' },
  holdingName: { color: '#4a6a80', fontSize: 11 },
  holdingValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  holdingPct: { color: '#00ADD8', fontSize: 12 },
  barContainer: {
    width: '100%', height: 4, backgroundColor: '#1e3a5a', borderRadius: 2, marginTop: 8,
  },
  bar: { height: 4, backgroundColor: '#00ADD8', borderRadius: 2 },
});
