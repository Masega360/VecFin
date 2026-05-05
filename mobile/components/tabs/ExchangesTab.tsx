import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Linking, RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Wallet {
  id: string;
  platform_id: string;
  name: string;
  api_key?: string;
  created_at: string;
  last_sync?: string;
}

interface Platform {
  id: string;
  name: string;
  description: string;
}

interface WalletDetails {
  wallet: { id: string; name: string; platform_id: string; last_sync?: string };
  assets: { ticker: string; quantity: number; price: number; market_value: number }[];
  total_value: number;
  currency?: string;
}

interface ExchangeGroup {
  platform: Platform;
  wallets: (Wallet & { details?: WalletDetails })[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// URLs de exchanges conocidos. La clave es el nombre en lowercase.
const EXCHANGE_URLS: Record<string, string> = {
  binance:  'https://www.binance.com',
  coinbase: 'https://www.coinbase.com',
  kraken:   'https://www.kraken.com',
  bybit:    'https://www.bybit.com',
  okx:      'https://www.okx.com',
};

const formatMoney = (n: number, ccy = 'USD') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 2,
  }).format(n || 0);

const formatSync = (iso?: string) => {
  if (!iso) return 'Nunca sincronizado';
  const d = new Date(iso);
  return `Sync ${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function ExchangesTab() {
  const [groups,    setGroups]    = useState<ExchangeGroup[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [syncing,   setSyncing]   = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await getValidToken();
    if (!token) return;

    try {
      // 1. Traer todas las wallets del usuario
      const walletsRes = await fetch(`${API_URL}/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!walletsRes.ok) { setError('Error al cargar wallets'); setLoading(false); return; }
      const allWallets: Wallet[] = (await walletsRes.json()) ?? [];

      // 2. Filtrar solo las conectadas (tienen api_key)
      const connected = allWallets.filter(w => w.api_key);
      if (connected.length === 0) { setGroups([]); setLoading(false); return; }

      // 3. Traer detalles (total_value, assets) de cada wallet conectada
      const detailsResults = await Promise.allSettled(
        connected.map(w =>
          fetch(`${API_URL}/wallets/${w.id}/details`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.ok ? r.json() as Promise<WalletDetails> : null)
        )
      );

      const walletsWithDetails = connected.map((w, i) => ({
        ...w,
        details: detailsResults[i].status === 'fulfilled' ? detailsResults[i].value ?? undefined : undefined,
      }));

      // 4. Traer info de plataformas únicas
      const platformIds = [...new Set(connected.map(w => w.platform_id))];
      const platformResults = await Promise.allSettled(
        platformIds.map(id =>
          fetch(`${API_URL}/platform/${id}`).then(r => r.ok ? r.json() as Promise<Platform> : null)
        )
      );

      const platformMap: Record<string, Platform> = {};
      platformIds.forEach((id, i) => {
        if (platformResults[i].status === 'fulfilled' && platformResults[i].value) {
          platformMap[id] = platformResults[i].value!;
        }
      });

      // 5. Agrupar wallets por plataforma
      const grouped: Record<string, ExchangeGroup> = {};
      for (const w of walletsWithDetails) {
        const platform = platformMap[w.platform_id];
        if (!platform) continue;
        if (!grouped[w.platform_id]) grouped[w.platform_id] = { platform, wallets: [] };
        grouped[w.platform_id].wallets.push(w);
      }

      setGroups(Object.values(grouped));
    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async (walletId: string) => {
    setSyncing(s => ({ ...s, [walletId]: true }));
    const token = await getValidToken();
    if (!token) { setSyncing(s => ({ ...s, [walletId]: false })); return; }
    try {
      await fetch(`${API_URL}/wallets/${walletId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } finally {
      setSyncing(s => ({ ...s, [walletId]: false }));
    }
  };

  const openExchange = (platformName: string) => {
    const url = EXCHANGE_URLS[platformName.toLowerCase()];
    if (url) Linking.openURL(url);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <ActivityIndicator size="large" color="#00ADD8" style={{ marginTop: 60 }} />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={40} color="#ff6666" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="link-off" size={56} color="#1e3a5a" />
        <Text style={styles.emptyTitle}>Sin exchanges conectados</Text>
        <Text style={styles.emptyText}>Creá una wallet conectada desde la tab Wallets</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={g => g.platform.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#00ADD8" />}
      renderItem={({ item: group }) => {
        const hasUrl = !!EXCHANGE_URLS[group.platform.name.toLowerCase()];
        const totalValue = group.wallets.reduce((sum, w) => sum + (w.details?.total_value ?? 0), 0);
        const currency = group.wallets.find(w => w.details?.currency)?.details?.currency ?? 'USD';
        const lastSync = group.wallets
          .map(w => w.last_sync)
          .filter(Boolean)
          .sort()
          .at(-1);
        const topAssets = group.wallets
          .flatMap(w => w.details?.assets ?? [])
          .sort((a, b) => b.market_value - a.market_value)
          .slice(0, 3);

        return (
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.exchangeIcon}>
                <MaterialIcons name="swap-horiz" size={26} color="#00ADD8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exchangeName}>{group.platform.name}</Text>
                <Text style={styles.exchangeDesc}>{group.platform.description}</Text>
              </View>
              {hasUrl && (
                <TouchableOpacity
                  style={styles.openBtn}
                  onPress={() => openExchange(group.platform.name)}
                >
                  <MaterialIcons name="open-in-new" size={18} color="#00ADD8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Total value */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Valor total</Text>
              <Text style={styles.totalValue}>{formatMoney(totalValue, currency)}</Text>
            </View>

            {/* Top assets */}
            {topAssets.length > 0 && (
              <View style={styles.assetsRow}>
                {topAssets.map(a => (
                  <View key={a.ticker} style={styles.assetChip}>
                    <Text style={styles.assetTicker}>{a.ticker}</Text>
                    <Text style={styles.assetValue}>{formatMoney(a.market_value, currency)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Wallets list */}
            {group.wallets.map(w => (
              <View key={w.id} style={styles.walletRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletName}>{w.name}</Text>
                  <Text style={styles.syncText}>{formatSync(w.last_sync)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.syncBtn, syncing[w.id] && styles.syncBtnDisabled]}
                  onPress={() => handleSync(w.id)}
                  disabled={syncing[w.id]}
                >
                  {syncing[w.id]
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <MaterialIcons name="sync" size={18} color="#fff" />
                  }
                  <Text style={styles.syncBtnText}>Sync</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      }}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#132238',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e3a5a',
    marginBottom: 16,
    overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e3a5a',
  },
  exchangeIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },
  exchangeName: { color: '#fff', fontWeight: '700', fontSize: 18 },
  exchangeDesc: { color: '#4a6a80', fontSize: 12, marginTop: 2 },
  openBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e3a5a',
  },
  totalLabel: { color: '#4a6a80', fontSize: 13 },
  totalValue: { color: '#00ADD8', fontSize: 22, fontWeight: '700' },

  assetsRow: {
    flexDirection: 'row', gap: 8, flexWrap: 'wrap',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e3a5a',
  },
  assetChip: {
    backgroundColor: '#0a1628', borderRadius: 10, borderWidth: 1, borderColor: '#1e3a5a',
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  assetTicker: { color: '#fff', fontWeight: '700', fontSize: 13 },
  assetValue:  { color: '#4a6a80', fontSize: 11, marginTop: 2 },

  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#1e3a5a',
  },
  walletName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  syncText:   { color: '#4a6a80', fontSize: 11, marginTop: 3 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00ADD8', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { color: '#4a6a80', fontSize: 20, fontWeight: '700' },
  emptyText:  { color: '#2a4a60', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  errorText:  { color: '#ff6666', fontSize: 14 },
  retryBtn: {
    backgroundColor: '#132238', borderRadius: 10, borderWidth: 1, borderColor: '#1e3a5a',
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  retryText: { color: '#00ADD8', fontWeight: '600' },
});
