import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface WalletAsset {
  id: string;
  wallet_id: string;
  ticker: string;
  quantity: number;
}

type ScreenView = 'detail' | 'addAsset';

// ─────────────────────────────────────────────────────────────────────────────

export default function WalletDetailScreen() {
  const { walletId, walletName } = useLocalSearchParams<{
    walletId: string;
    walletName: string;
  }>();
  const router = useRouter();

  // assets list
  const [assets,     setAssets]     = useState<WalletAsset[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [listError,  setListError]  = useState('');

  // view
  const [view,       setView]       = useState<ScreenView>('detail');

  // add-asset form
  const [ticker,     setTicker]     = useState('');
  const [quantity,   setQuantity]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');

  // delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadAssets(); }, [walletId]);

  // ─── API ───────────────────────────────────────────────────────────────────

  const loadAssets = useCallback(async () => {
    if (!walletId) return;
    setLoading(true);
    setListError('');
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(Array.isArray(data) ? data : []);
      } else if (res.status === 404) {
        setListError('Wallet no encontrada');
      } else {
        setListError('Error al cargar activos');
      }
    } catch {
      setListError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  const handleAddAsset = async () => {
    const tickerClean = ticker.trim().toUpperCase();
    const qty = parseFloat(quantity.replace(',', '.'));

    if (!tickerClean)   { setFormError('El ticker es requerido'); return; }
    if (isNaN(qty) || qty <= 0) { setFormError('La cantidad debe ser mayor a 0'); return; }

    setSubmitting(true);
    setFormError('');
    const token = await getValidToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/assets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: tickerClean, quantity: qty }),
      });

      if (res.ok) {
        setTicker('');
        setQuantity('');
        setView('detail');
        loadAssets();
      } else {
        const msg = await res.text();
        setFormError(msg || 'Error al agregar el activo');
      }
    } catch {
      setFormError('Sin conexión al servidor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = (asset: WalletAsset) => {
    Alert.alert(
      'Eliminar activo',
      `¿Eliminar ${asset.ticker} de esta wallet?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => confirmDelete(asset.id),
        },
      ],
    );
  };

  const confirmDelete = async (assetId: string) => {
    setDeletingId(assetId);
    const token = await getValidToken();
    if (!token) { setDeletingId(null); return; }
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/assets/${assetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAssets(prev => prev.filter(a => a.id !== assetId));
      } else {
        Alert.alert('Error', 'No se pudo eliminar el activo');
      }
    } catch {
      Alert.alert('Error', 'Sin conexión al servidor');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Render: Add asset form ───────────────────────────────────────────────

  if (view === 'addAsset') {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => { setTicker(''); setQuantity(''); setFormError(''); setView('detail'); }}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back" size={22} color="#8aaabf" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Agregar activo</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{walletName}</Text>
          </View>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.formBody}>
          {/* Ticker */}
          <Text style={styles.label}>Ticker</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: AAPL, BTC, ETH"
            placeholderTextColor="#4a6a80"
            value={ticker}
            onChangeText={t => setTicker(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* Quantity */}
          <Text style={styles.label}>Cantidad</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 0.5, 10, 100"
            placeholderTextColor="#4a6a80"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />

          {/* Hint */}
          <Text style={styles.hint}>
            Ingresá el símbolo del activo tal como aparece en la plataforma (ej: BTC, AAPL, ETH-USD).
          </Text>

          {formError ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={14} color="#ff6666" />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleAddAsset}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Agregar activo</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── Render: detail + assets list ─────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#8aaabf" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{walletName}</Text>
          <Text style={styles.headerSub}>Activos de la wallet</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      {/* Error banner */}
      {listError ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={14} color="#ff6666" />
          <Text style={styles.errorText}>{listError}</Text>
        </View>
      ) : null}

      {/* Assets list */}
      {loading ? (
        <ActivityIndicator size="large" color="#00ADD8" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onRefresh={loadAssets}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={styles.assetCard}>
              {/* Ticker icon */}
              <View style={styles.assetIcon}>
                <Text style={styles.assetIconText}>
                  {item.ticker.slice(0, 3).toUpperCase()}
                </Text>
              </View>

              {/* Info */}
              <View style={styles.assetBody}>
                <Text style={styles.assetTicker}>{item.ticker}</Text>
                <Text style={styles.assetQty}>
                  {Number(item.quantity).toLocaleString('es-AR', { maximumFractionDigits: 8 })} unidades
                </Text>
              </View>

              {/* Delete */}
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color="#ff6666" />
              ) : (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteAsset(item)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialIcons name="delete-outline" size={20} color="#4a6a80" />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="pie-chart-outline" size={56} color="#1e3a5a" />
              <Text style={styles.emptyTitle}>Sin activos</Text>
              <Text style={styles.emptyText}>Tocá + para agregar el primero</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setView('addAsset')} activeOpacity={0.8}>
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#0a1628',
    paddingTop: Platform.OS === 'android' ? 36 : 52,
  },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#132238',
  },
  backBtn:      { padding: 4, marginRight: 10 },
  headerCenter: { flex: 1 },
  headerTitle:  { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub:    { color: '#8aaabf', fontSize: 12, marginTop: 1 },

  // list
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 },
  assetCard: {
    backgroundColor: '#132238', borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#1e3a5a',
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  assetIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },
  assetIconText: { color: '#00ADD8', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  assetBody:     { flex: 1 },
  assetTicker:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  assetQty:      { color: '#8aaabf', fontSize: 13, marginTop: 3 },
  deleteBtn:     { padding: 4 },

  // empty
  empty:      { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyTitle: { color: '#4a6a80', fontSize: 20, fontWeight: '700' },
  emptyText:  { color: '#2a4a60', fontSize: 14 },

  // error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 12,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
  },
  errorText: { color: '#ff6666', fontSize: 13 },

  // add-asset form
  formBody: { padding: 20, paddingTop: 24 },
  label: {
    color: '#8aaabf', fontSize: 13, fontWeight: '600',
    marginBottom: 8, marginTop: 20,
  },
  input: {
    backgroundColor: '#132238', borderRadius: 12, borderWidth: 1, borderColor: '#1e3a5a',
    color: '#fff', paddingHorizontal: 14, height: 50, fontSize: 15,
  },
  hint: {
    color: '#4a6a80', fontSize: 12, marginTop: 10, lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: '#00ADD8', padding: 15, borderRadius: 14,
    alignItems: 'center', marginTop: 28,
    shadowColor: '#00ADD8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // fab
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: '#00ADD8', width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00ADD8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
});
