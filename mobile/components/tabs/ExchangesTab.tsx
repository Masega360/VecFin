import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Linking, RefreshControl, Modal,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Wallet {
  id: string;
  platform_id: string;
  name: string;
  api_key?: string;
  last_sync?: string;
}

interface ExchangePlatform {
  id: string;
  name: string;
  description: string;
  sync_supported: boolean;
}

interface WalletDetails {
  wallet: { id: string; name: string; platform_id: string; last_sync?: string };
  assets: { ticker: string; quantity: number; price: number; market_value: number }[];
  total_value: number;
  currency?: string;
}

interface PlatformCard {
  platform: ExchangePlatform;
  wallets: (Wallet & { details?: WalletDetails })[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXCHANGE_URLS: Record<string, string> = {
  binance:  'https://www.binance.com',
  coinbase: 'https://www.coinbase.com',
  kraken:   'https://www.kraken.com',
  bybit:    'https://www.bybit.com',
  okx:      'https://www.okx.com',
};

const formatMoney = (n: number, ccy = 'USD') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: ccy || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(n) > 0 && Math.abs(n) < 0.01 ? 6 : 2,
  }).format(n || 0);

const formatSync = (iso?: string) => {
  if (!iso) return 'Nunca sincronizado';
  const d = new Date(iso);
  return `Sync ${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function ExchangesTab() {
  const [cards,   setCards]   = useState<PlatformCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  // connect modal state
  const [connectPlatform, setConnectPlatform] = useState<ExchangePlatform | null>(null);
  const [connName,        setConnName]        = useState('');
  const [connKey,         setConnKey]         = useState('');
  const [connSecret,      setConnSecret]      = useState('');
  const [connecting,      setConnecting]      = useState(false);
  const [connError,       setConnError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await getValidToken();
    if (!token) { setLoading(false); return; }

    try {
      const [platformsRes, walletsRes] = await Promise.all([
        fetch(`${API_URL}/platform`),
        fetch(`${API_URL}/wallets`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!platformsRes.ok) { setError('Error al cargar plataformas'); setLoading(false); return; }
      if (!walletsRes.ok)   { setError('Error al cargar wallets');     setLoading(false); return; }

      const allPlatforms: ExchangePlatform[] = ((await platformsRes.json()) ?? [])
        .filter((p: ExchangePlatform) => p.sync_supported);
      const allWallets: Wallet[]             = (await walletsRes.json())   ?? [];

      const connected = allWallets.filter(w => w.api_key);
      const detailsResults = connected.length > 0
        ? await Promise.allSettled(
            connected.map(w =>
              fetch(`${API_URL}/wallets/${w.id}/details`, {
                headers: { Authorization: `Bearer ${token}` },
              }).then(r => r.ok ? r.json() as Promise<WalletDetails> : null)
            )
          )
        : [];

      const walletsWithDetails = connected.map((w, i) => ({
        ...w,
        details: detailsResults[i]?.status === 'fulfilled' ? detailsResults[i].value ?? undefined : undefined,
      }));

      setCards(allPlatforms.map(platform => ({
        platform,
        wallets: walletsWithDetails.filter(w => w.platform_id === platform.id),
      })));
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

  const openConnectModal = (platform: ExchangePlatform) => {
    setConnectPlatform(platform);
    setConnName(`Mi ${platform.name}`);
    setConnKey('');
    setConnSecret('');
    setConnError('');
  };

  const closeConnectModal = () => {
    if (connecting) return;
    setConnectPlatform(null);
  };

  const handleConnect = async () => {
    if (!connName.trim())   { setConnError('El nombre es requerido'); return; }
    if (!connKey.trim())    { setConnError('La API Key es requerida'); return; }
    if (!connSecret.trim()) { setConnError('El API Secret es requerido'); return; }

    setConnecting(true);
    setConnError('');
    const token = await getValidToken();
    if (!token) { setConnecting(false); return; }

    try {
      // 1. Crear wallet conectada
      const res = await fetch(`${API_URL}/wallets/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_id: connectPlatform!.id,
          name:        connName.trim(),
          api_key:     connKey.trim(),
          api_secret:  connSecret.trim(),
        }),
      });

      if (!res.ok) {
        setConnError((await res.text()) || 'Error al conectar');
        setConnecting(false);
        return;
      }

      const { id: walletId } = await res.json();

      // 2. Sync automático
      await fetch(`${API_URL}/wallets/${walletId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setConnectPlatform(null);
      await load();
    } catch {
      setConnError('Sin conexión al servidor');
    } finally {
      setConnecting(false);
    }
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

  return (
    <>
      <FlatList
        data={cards}
        keyExtractor={c => c.platform.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#00ADD8" />}
        renderItem={({ item: card }) => {
          const isConnected = card.wallets.length > 0;
          const hasUrl = !!EXCHANGE_URLS[card.platform.name.toLowerCase()];
          const totalValue = card.wallets.reduce((sum, w) => sum + (w.details?.total_value ?? 0), 0);
          const currency = card.wallets.find(w => w.details?.currency)?.details?.currency ?? 'USD';
          const topAssets = card.wallets
            .flatMap(w => w.details?.assets ?? [])
            .sort((a, b) => b.market_value - a.market_value)
            .slice(0, 3);

          return (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.exchangeIcon, !isConnected && styles.exchangeIconOff]}>
                  <MaterialIcons name="swap-horiz" size={26} color={isConnected ? '#00ADD8' : '#4a6a80'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exchangeName}>{card.platform.name}</Text>
                  <Text style={styles.exchangeDesc}>{card.platform.description}</Text>
                </View>
                <View style={styles.headerRight}>
                  <View style={[styles.badge, isConnected ? styles.badgeOn : styles.badgeOff]}>
                    <Text style={[styles.badgeText, isConnected ? styles.badgeTextOn : styles.badgeTextOff]}>
                      {isConnected ? 'Conectado' : 'No conectado'}
                    </Text>
                  </View>
                  {hasUrl && (
                    <TouchableOpacity
                      style={styles.openBtn}
                      onPress={() => Linking.openURL(EXCHANGE_URLS[card.platform.name.toLowerCase()])}
                    >
                      <MaterialIcons name="open-in-new" size={16} color="#00ADD8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Conectado: valor total + assets + wallets con sync */}
              {isConnected && (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Valor total</Text>
                    <Text style={styles.totalValue}>{formatMoney(totalValue, currency)}</Text>
                  </View>

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

                  {card.wallets.map(w => (
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

                  {/* Agregar otra cuenta del mismo exchange */}
                  <TouchableOpacity
                    style={styles.addMoreBtn}
                    onPress={() => openConnectModal(card.platform)}
                  >
                    <MaterialIcons name="add" size={16} color="#4a6a80" />
                    <Text style={styles.addMoreText}>Agregar otra cuenta</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* No conectado: botón conectar */}
              {!isConnected && (
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={() => openConnectModal(card.platform)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add-link" size={18} color="#fff" />
                  <Text style={styles.connectBtnText}>Conectar {card.platform.name}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.centered}>
            <MaterialIcons name="swap-horiz" size={56} color="#1e3a5a" />
            <Text style={styles.emptyTitle}>Sin exchanges disponibles</Text>
          </View>
        }
      />

      {/* Modal de conexión */}
      <Modal
        visible={!!connectPlatform}
        transparent
        animationType="slide"
        onRequestClose={closeConnectModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conectar {connectPlatform?.name}</Text>
              <TouchableOpacity onPress={closeConnectModal} disabled={connecting}>
                <MaterialIcons name="close" size={22} color="#4a6a80" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalHint}>
                Ingresá las credenciales de API de tu cuenta. Solo se usan para leer tu portfolio (permisos de solo lectura recomendados).
              </Text>

              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder={`Mi ${connectPlatform?.name ?? 'Exchange'}`}
                placeholderTextColor="#4a6a80"
                value={connName}
                onChangeText={setConnName}
                editable={!connecting}
              />

              <Text style={styles.label}>API Key</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu API Key"
                placeholderTextColor="#4a6a80"
                value={connKey}
                onChangeText={setConnKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!connecting}
              />

              <Text style={styles.label}>API Secret</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu API Secret"
                placeholderTextColor="#4a6a80"
                value={connSecret}
                onChangeText={setConnSecret}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!connecting}
              />

              {connError ? (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={14} color="#ff6666" />
                  <Text style={styles.errorText}>{connError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, connecting && styles.submitBtnDisabled]}
                onPress={handleConnect}
                disabled={connecting}
                activeOpacity={0.8}
              >
                {connecting
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <MaterialIcons name="add-link" size={18} color="#fff" />
                      <Text style={styles.submitBtnText}>Conectar y sincronizar</Text>
                    </>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#132238', borderRadius: 20,
    borderWidth: 1, borderColor: '#1e3a5a',
    marginBottom: 16, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e3a5a',
  },
  exchangeIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },
  exchangeIconOff: { backgroundColor: '#1e3a5a' },
  exchangeName: { color: '#fff', fontWeight: '700', fontSize: 18 },
  exchangeDesc: { color: '#4a6a80', fontSize: 12, marginTop: 2 },
  headerRight:  { alignItems: 'flex-end', gap: 6 },
  openBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },

  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeOn:       { backgroundColor: '#00ADD815', borderColor: '#00ADD840' },
  badgeOff:      { backgroundColor: '#1e3a5a',   borderColor: '#2a4a60' },
  badgeText:     { fontSize: 11, fontWeight: '700' },
  badgeTextOn:   { color: '#00ADD8' },
  badgeTextOff:  { color: '#4a6a80' },

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

  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 14, borderTopWidth: 1, borderTopColor: '#1e3a5a',
  },
  addMoreText: { color: '#4a6a80', fontSize: 13 },

  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ADD8', margin: 16, borderRadius: 12,
    paddingVertical: 14,
  },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0a1628', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: '#1e3a5a',
    padding: 24, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalHint:  { color: '#4a6a80', fontSize: 13, lineHeight: 18, marginBottom: 4 },

  label: { color: '#8aaabf', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: '#132238', borderRadius: 12, borderWidth: 1, borderColor: '#1e3a5a',
    color: '#fff', paddingHorizontal: 14, height: 50, fontSize: 15,
  },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  errorText: { color: '#ff6666', fontSize: 13 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ADD8', padding: 15, borderRadius: 14,
    marginTop: 24, marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyTitle: { color: '#4a6a80', fontSize: 20, fontWeight: '700' },
  retryBtn: {
    backgroundColor: '#132238', borderRadius: 10, borderWidth: 1, borderColor: '#1e3a5a',
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  retryText: { color: '#00ADD8', fontWeight: '600' },
});
