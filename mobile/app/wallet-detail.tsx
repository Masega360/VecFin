import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ActivityIndicator, Platform, KeyboardAvoidingView,
  Modal, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface WalletAssetView {
  ticker: string;
  name?: string;
  quantity: number;
  price: number;
  currency?: string;
  market_value: number;
}

interface WalletInfo {
  id: string;
  name: string;
  platform_id: string;
  created_at: string;
  last_sync?: string;
}

interface WalletDetails {
  wallet: WalletInfo;
  assets: WalletAssetView[];
  total_value: number;
  currency?: string;
}

interface AssetSuggestion {
  symbol: string;
  name: string;
  type: string;
  source?: string;
}

type ScreenView = 'detail' | 'addAsset';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (n: number, ccy = 'USD') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: ccy || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(n) > 0 && Math.abs(n) < 0.01 ? 6 : 2,
  }).format(n || 0);

const formatQty = (n: number) =>
  Number(n).toLocaleString('es-AR', { maximumFractionDigits: 8 });

// ─────────────────────────────────────────────────────────────────────────────

export default function WalletDetailScreen() {
  const { walletId, walletName } = useLocalSearchParams<{
    walletId: string;
    walletName: string;
  }>();
  const router = useRouter();

  // details + assets (valuados)
  const [details,   setDetails]   = useState<WalletDetails | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState('');

  // view
  const [view, setView] = useState<ScreenView>('detail');

  // add-asset form
  const [ticker,     setTicker]     = useState('');
  const [quantity,   setQuantity]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');

  // typeahead de tickers (Yahoo search)
  const [suggestions,        setSuggestions]        = useState<AssetSuggestion[]>([]);
  const [searchingSuggestions, setSearchingSuggestions] = useState(false);
  const [pickedSuggestion,   setPickedSuggestion]   = useState<AssetSuggestion | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // delete
  const [deletingTicker,       setDeletingTicker]       = useState<string | null>(null);
  const [confirmDeleteTicker,  setConfirmDeleteTicker]  = useState<string | null>(null);

  // edit quantity modal
  const [editTicker,    setEditTicker]    = useState<string | null>(null);
  const [editQuantity,  setEditQuantity]  = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError,     setEditError]     = useState('');

  useEffect(() => { loadDetails(); }, [walletId]);

  const goBack = () => {
    router.navigate({ pathname: '/home', params: { tab: 'wallets' } });
  };
  // ─── API ───────────────────────────────────────────────────────────────────

  const loadDetails = useCallback(async (isRefresh = false) => {
    if (!walletId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setListError('');
    const token = await getValidToken();
    if (!token) { setLoading(false); setRefreshing(false); return; }
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: WalletDetails = await res.json();
        setDetails({
          ...data,
          assets: Array.isArray(data.assets) ? data.assets : [],
        });
      } else if (res.status === 404) {
        setListError('Wallet no encontrada');
      } else {
        setListError('Error al cargar activos');
      }
    } catch {
      setListError('Sin conexión al servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletId]);

  // ─── Búsqueda de tickers (typeahead) ──────────────────────────────────────

  // Dispara búsqueda en Yahoo con debounce. Cancela la anterior si el user sigue tipeando.
  const onTickerChange = (raw: string) => {
    const val = raw.toUpperCase();
    setTicker(val);
    setPickedSuggestion(null);
    setFormError('');

    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = val.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSearchingSuggestions(false);
      return;
    }

    setSearchingSuggestions(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/assets/search?query=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data: AssetSuggestion[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setSuggestions(data.slice(0, 8));
          } else {
            // Yahoo no conoce el ticker (ej: activos de Binance) → ofrecerlo directamente
            setSuggestions([{ symbol: q, name: q, type: 'CRYPTO' }]);
          }
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingSuggestions(false);
      }
    }, 300);
  };

  const pickSuggestion = (s: AssetSuggestion) => {
    setTicker(s.symbol);
    setPickedSuggestion(s);
    setSuggestions([]);
    setFormError('');
  };

  const handleAddAsset = async () => {
    const tickerClean = ticker.trim().toUpperCase();
    const qty = parseFloat(quantity.replace(',', '.'));

    if (!tickerClean)   { setFormError('El ticker es requerido'); return; }
    if (isNaN(qty) || qty <= 0) { setFormError('La cantidad debe ser mayor a 0'); return; }

    setSubmitting(true);
    setFormError('');
    const token = await getValidToken();
    if (!token) { setSubmitting(false); return; }

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
        loadDetails();
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

  // Abre el modal de confirmación (Alert.alert no funciona en react-native-web con botones)
  const handleDeleteAsset = (asset: WalletAssetView) => {
    setConfirmDeleteTicker(asset.ticker);
  };

  const confirmDelete = async () => {
    const ticker = confirmDeleteTicker;
    if (!ticker) return;
    setConfirmDeleteTicker(null);
    setDeletingTicker(ticker);

    const token = await getValidToken();
    if (!token) { setDeletingTicker(null); return; }

    try {
      const url = `${API_URL}/wallets/${walletId}/assets/${encodeURIComponent(ticker)}`;
      console.log('[DELETE asset]', url);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDetails(prev => prev ? {
          ...prev,
          assets: prev.assets.filter(a => a.ticker !== ticker),
          total_value: prev.assets
            .filter(a => a.ticker !== ticker)
            .reduce((sum, a) => sum + (a.market_value || 0), 0),
        } : prev);
      } else {
        const msg = await res.text();
        console.warn('[DELETE asset] failed', res.status, msg);
        setListError(`No se pudo eliminar (${res.status})`);
      }
    } catch (e) {
      console.warn('[DELETE asset] error', e);
      setListError('Sin conexión al servidor');
    } finally {
      setDeletingTicker(null);
    }
  };

  // ─── Edit quantity ────────────────────────────────────────────────────────

  const openEdit = (asset: WalletAssetView) => {
    setEditTicker(asset.ticker);
    setEditQuantity(String(asset.quantity));
    setEditError('');
  };

  const closeEdit = () => {
    setEditTicker(null);
    setEditQuantity('');
    setEditError('');
  };

  const submitEdit = async () => {
    if (!editTicker) return;
    const qty = parseFloat(editQuantity.replace(',', '.'));
    if (isNaN(qty) || qty < 0) {
      setEditError('La cantidad no puede ser negativa');
      return;
    }

    setEditSubmitting(true);
    setEditError('');
    const token = await getValidToken();
    if (!token) { setEditSubmitting(false); return; }

    try {
      const res = await fetch(
        `${API_URL}/wallets/${walletId}/assets/${encodeURIComponent(editTicker)}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: qty }),
        },
      );
      if (res.ok) {
        closeEdit();
        loadDetails();
      } else {
        const msg = await res.text();
        setEditError(msg || 'No se pudo actualizar la cantidad');
      }
    } catch {
      setEditError('Sin conexión al servidor');
    } finally {
      setEditSubmitting(false);
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

        <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
          {/* Ticker */}
          <Text style={styles.label}>Ticker</Text>
          <View>
            <TextInput
              style={styles.input}
              placeholder="Ej: BTC-USD, AAPL, ETH-USD"
              placeholderTextColor="#4a6a80"
              value={ticker}
              onChangeText={onTickerChange}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
            />
            {searchingSuggestions ? (
              <ActivityIndicator
                size="small"
                color="#00ADD8"
                style={styles.suggestSpinner}
              />
            ) : null}
          </View>

          {/* Sugerencias de Yahoo */}
          {suggestions.length > 0 && !pickedSuggestion ? (
            <View style={styles.suggestBox}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={`${s.symbol}-${i}`}
                  style={[
                    styles.suggestRow,
                    i < suggestions.length - 1 && styles.suggestRowBorder,
                  ]}
                  onPress={() => pickSuggestion(s)}
                  activeOpacity={0.65}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestSymbol}>{s.symbol}</Text>
                    <Text style={styles.suggestName} numberOfLines={1}>
                      {s.name || '—'}
                    </Text>
                  </View>
                  {s.type ? (
                    <View style={styles.suggestBadge}>
                      <Text style={styles.suggestBadgeText}>{s.type}</Text>
                    </View>
                  ) : null}
                  {s.source ? (
                    <View style={[styles.suggestBadge, s.source === 'binance' ? styles.suggestBadgeBinance : styles.suggestBadgeYahoo]}>
                      <Text style={styles.suggestBadgeText}>{s.source}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Activo seleccionado */}
          {pickedSuggestion ? (
            <View style={styles.pickedBox}>
              <MaterialIcons name="check-circle" size={16} color="#00ADD8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickedName} numberOfLines={1}>
                  {pickedSuggestion.name}
                </Text>
                <Text style={styles.pickedType}>
                  {pickedSuggestion.type?.toUpperCase() || 'ASSET'} · {pickedSuggestion.symbol}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setPickedSuggestion(null); setTicker(''); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#4a6a80" />
              </TouchableOpacity>
            </View>
          ) : null}

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
            Ingresá el símbolo del activo tal como aparece en la plataforma (ej: BTC-USD, AAPL, ETH-USD).
            Si ya tenés ese ticker en la wallet, la cantidad se suma.
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
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Render: detail + assets list ─────────────────────────────────────────

  const assets = details?.assets ?? [];
  const totalValue = details?.total_value ?? 0;
  const currency = details?.currency || 'USD';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
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

      {/* Valuación total */}
      {!loading && assets.length > 0 && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Valor total</Text>
          <Text style={styles.totalValue}>{formatMoney(totalValue, currency)}</Text>
          <Text style={styles.totalSub}>
            {assets.length} {assets.length === 1 ? 'activo' : 'activos'}
          </Text>
        </View>
      )}

      {/* Assets list */}
      {loading ? (
        <ActivityIndicator size="large" color="#00ADD8" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={item => item.ticker}
          contentContainerStyle={styles.list}
          onRefresh={() => loadDetails(true)}
          refreshing={refreshing}
          renderItem={({ item }) => (
            <View style={styles.assetCard}>
              {/* Body tapeable → vista del asset en Yahoo */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.assetBodyTouchable}
                onPress={() =>
                  router.push({
                    pathname: '/asset-detail',
                    params: {
                      symbol: item.ticker,
                      name: item.name || item.ticker,
                      from: 'wallets',
                      fallbackPrice: String(item.price ?? 0),
                      fallbackCurrency: item.currency ?? 'USD',
                    },
                  })
                }
              >
                {/* Ticker icon */}
                <View style={styles.assetIcon}>
                  <Text style={styles.assetIconText}>
                    {item.ticker.slice(0, 3).toUpperCase()}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.assetBody}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.assetTicker}>{item.ticker}</Text>
                    <Text style={styles.assetMarketValue}>
                      {item.market_value > 0 ? formatMoney(item.market_value, item.currency || currency) : '—'}
                    </Text>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.assetQty}>
                      {formatQty(item.quantity)} × {item.price > 0 ? formatMoney(item.price, item.currency || currency) : '—'}
                    </Text>
                  </View>
                  {item.name ? (
                    <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              {/* Acciones: editar y borrar */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEdit(item)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialIcons name="edit" size={20} color="#00ADD8" />
                </TouchableOpacity>

                {deletingTicker === item.ticker ? (
                  <ActivityIndicator size="small" color="#ff6666" style={styles.actionBtn} />
                ) : (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDeleteAsset(item)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialIcons name="delete-outline" size={20} color="#ff6666" />
                  </TouchableOpacity>
                )}
              </View>
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

      {/* Confirm delete modal (reemplaza Alert.alert porque no anda en react-native-web) */}
      <Modal
        visible={!!confirmDeleteTicker}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteTicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Eliminar activo</Text>
            <Text style={[styles.modalTicker, { color: '#ff6666' }]}>
              {confirmDeleteTicker}
            </Text>
            <Text style={[styles.hint, { marginTop: 12 }]}>
              ¿Seguro que querés eliminarlo de esta wallet? Esta acción no se puede deshacer.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setConfirmDeleteTicker(null)}
              >
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={confirmDelete}
              >
                <Text style={styles.modalBtnPrimaryText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit quantity modal */}
      <Modal
        visible={!!editTicker}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar cantidad</Text>
            <Text style={styles.modalTicker}>{editTicker}</Text>

            <Text style={styles.label}>Nueva cantidad</Text>
            <TextInput
              style={styles.input}
              value={editQuantity}
              onChangeText={setEditQuantity}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor="#4a6a80"
            />

            <Text style={styles.hint}>
              Esta operación reemplaza la cantidad actual (no suma).
            </Text>

            {editError ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={14} color="#ff6666" />
                <Text style={styles.errorText}>{editError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={closeEdit}
                disabled={editSubmitting}
              >
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={submitEdit}
                disabled={editSubmitting}
              >
                {editSubmitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalBtnPrimaryText}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // total card (valuación)
  totalCard: {
    backgroundColor: '#132238', borderRadius: 16,
    marginHorizontal: 16, marginTop: 16, padding: 18,
    borderWidth: 1, borderColor: '#1e3a5a',
  },
  totalLabel: { color: '#8aaabf', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  totalValue: { color: '#00ADD8', fontSize: 28, fontWeight: '800', marginTop: 6 },
  totalSub:   { color: '#4a6a80', fontSize: 12, marginTop: 4 },

  // list
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 },
  assetCard: {
    backgroundColor: '#132238', borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#1e3a5a',
    flexDirection: 'row', alignItems: 'center',
  },
  assetBodyTouchable: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  assetIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },
  assetIconText: { color: '#00ADD8', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  assetBody:     { flex: 1 },
  rowBetween:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assetTicker:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  assetMarketValue: { color: '#00ADD8', fontWeight: '700', fontSize: 14 },
  assetQty:      { color: '#8aaabf', fontSize: 12, marginTop: 3 },
  assetName:     { color: '#4a6a80', fontSize: 11, marginTop: 2 },
  actions:       { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  actionBtn:     { padding: 6, marginLeft: 2 },

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

  // edit modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: '#0a1628', borderRadius: 18, padding: 22,
    borderWidth: 1, borderColor: '#1e3a5a', width: '100%', maxWidth: 420,
  },
  modalTitle:  { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalTicker: { color: '#00ADD8', fontSize: 14, fontWeight: '700', marginTop: 4 },
  modalActions: {
    flexDirection: 'row', gap: 10, marginTop: 22,
  },
  modalBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnGhost:       { backgroundColor: '#132238', borderWidth: 1, borderColor: '#1e3a5a' },
  modalBtnGhostText:   { color: '#8aaabf', fontWeight: '600' },
  modalBtnPrimary:     { backgroundColor: '#00ADD8' },
  modalBtnDanger:      { backgroundColor: '#ff6666' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700' },

  // typeahead (sugerencias de Yahoo)
  suggestSpinner: {
    position: 'absolute', right: 12, top: 0, bottom: 0,
    justifyContent: 'center',
  },
  suggestBox: {
    backgroundColor: '#132238',
    borderWidth: 1, borderColor: '#1e3a5a',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    gap: 10,
  },
  suggestRowBorder: {
    borderBottomWidth: 1, borderBottomColor: '#1e3a5a',
  },
  suggestSymbol: {
    color: '#00ADD8', fontWeight: '700', fontSize: 14,
  },
  suggestName: {
    color: '#8aaabf', fontSize: 12, marginTop: 2,
  },
  suggestBadge: {
    backgroundColor: '#0a1628',
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#1e3a5a',
  },
  suggestBadgeYahoo:   { backgroundColor: '#0a1628', borderColor: '#1e3a5a' },
  suggestBadgeBinance: { backgroundColor: '#1a1200', borderColor: '#F0B90B40' },
  suggestBadgeText: {
    color: '#8aaabf', fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // activo "picked" (elegido de las sugerencias)
  pickedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#00ADD815',
    borderWidth: 1, borderColor: '#00ADD840',
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8,
  },
  pickedName: {
    color: '#fff', fontSize: 13, fontWeight: '600',
  },
  pickedType: {
    color: '#8aaabf', fontSize: 11, marginTop: 2,
    letterSpacing: 0.5,
  },
});
