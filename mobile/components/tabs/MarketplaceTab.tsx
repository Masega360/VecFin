import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform, Modal, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface PoolItem {
  ticker: string;
  quantity: number;
  price_usd: number;
}

interface WalletOption {
  id: string;
  name: string;
  my_role?: string;
}

interface AssetHolding {
  ticker: string;
  quantity: number;
}

export default function MarketplaceTab() {
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [loading, setLoading] = useState(true);

  // modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'buy' | 'sell'>('buy');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [payTicker, setPayTicker] = useState('');
  const [payPrice, setPayPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // cantidades con conversión
  const [buyQty, setBuyQty] = useState('');
  const [payQty, setPayQty] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [receiveUsd, setReceiveUsd] = useState('');

  // wallets
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);
  const [walletAssets, setWalletAssets] = useState<AssetHolding[]>([]);

  useEffect(() => { loadPool(); loadWallets(); }, []);

  const loadPool = async () => {
    setLoading(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/marketplace`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPool(await res.json() || []);
    } catch {}
    finally { setLoading(false); }
  };

  const loadWallets = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const list = (await res.json()) || [];
        const operable = list.filter((w: any) => w.my_role === 'owner' || w.my_role === 'admin');
        setWallets(operable);
        if (operable.length > 0) { setSelectedWallet(operable[0]); loadWalletAssets(operable[0].id); }
      }
    } catch {}
  };

  const loadWalletAssets = async (wid: string) => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${wid}/assets`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setWalletAssets(await res.json() || []);
    } catch {}
  };

  // Conversión buy: cambio una → recalcula la otra
  const onBuyQtyChange = (val: string) => {
    setBuyQty(val);
    const n = parseFloat(val);
    if (!isNaN(n) && selectedPrice > 0 && payPrice > 0) {
      setPayQty(((n * selectedPrice) / payPrice).toFixed(6));
    } else { setPayQty(''); }
  };

  const onPayQtyChange = (val: string) => {
    setPayQty(val);
    const n = parseFloat(val);
    if (!isNaN(n) && selectedPrice > 0 && payPrice > 0) {
      setBuyQty(((n * payPrice) / selectedPrice).toFixed(6));
    } else { setBuyQty(''); }
  };

  // Conversión sell
  const onSellQtyChange = (val: string) => {
    setSellQty(val);
    const n = parseFloat(val);
    if (!isNaN(n) && selectedPrice > 0) {
      setReceiveUsd((n * selectedPrice).toFixed(2));
    } else { setReceiveUsd(''); }
  };

  const openBuy = (item: PoolItem) => {
    setSelectedTicker(item.ticker);
    setSelectedPrice(item.price_usd);
    setModalMode('buy');
    setBuyQty(''); setPayQty(''); setPayTicker(''); setPayPrice(0);
    if (selectedWallet) loadWalletAssets(selectedWallet.id);
    setModalVisible(true);
  };

  const openSell = () => {
    setModalMode('sell');
    setSelectedTicker(''); setSelectedPrice(0);
    setSellQty(''); setReceiveUsd('');
    if (selectedWallet) loadWalletAssets(selectedWallet.id);
    setModalVisible(true);
  };

  const selectPayTicker = (ticker: string) => {
    setPayTicker(ticker);
    // Buscar precio en el pool o pedir
    const poolItem = pool.find(p => p.ticker === ticker);
    if (poolItem) {
      setPayPrice(poolItem.price_usd);
      // Recalcular si ya hay buyQty
      const n = parseFloat(buyQty);
      if (!isNaN(n) && selectedPrice > 0 && poolItem.price_usd > 0) {
        setPayQty(((n * selectedPrice) / poolItem.price_usd).toFixed(6));
      }
    } else {
      // Fetch price
      (async () => {
        const token = await getValidToken();
        if (!token) return;
        try {
          const res = await fetch(`${API_URL}/assets/${ticker}?range=1d`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const d = await res.json();
            setPayPrice(d.price || 0);
            const n = parseFloat(buyQty);
            if (!isNaN(n) && selectedPrice > 0 && d.price > 0) {
              setPayQty(((n * selectedPrice) / d.price).toFixed(6));
            }
          }
        } catch {}
      })();
    }
  };

  const selectSellTicker = (ticker: string) => {
    setSelectedTicker(ticker);
    const poolItem = pool.find(p => p.ticker === ticker);
    if (poolItem) { setSelectedPrice(poolItem.price_usd); }
    setSellQty(''); setReceiveUsd('');
  };

  const execute = async () => {
    if (!selectedWallet) { Alert.alert('Error', 'Seleccioná una wallet'); return; }

    if (modalMode === 'buy') {
      const qty = parseFloat(buyQty);
      if (!qty || qty <= 0 || !payTicker) { Alert.alert('Error', 'Completá los campos'); return; }
      setSubmitting(true);
      const token = await getValidToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/marketplace/buy`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet_id: selectedWallet.id, ticker: selectedTicker, quantity: qty, pay_ticker: payTicker }),
        });
        if (res.ok || res.status === 201) {
          const data = await res.json();
          Alert.alert('✓ Compra exitosa', `+${buyQty} ${selectedTicker}\n-${parseFloat(payQty).toFixed(4)} ${payTicker}`);
          setModalVisible(false); loadPool(); loadWalletAssets(selectedWallet.id);
        } else { Alert.alert('Error', await res.text()); }
      } catch { Alert.alert('Error', 'Sin conexión'); }
      finally { setSubmitting(false); }
    } else {
      const qty = parseFloat(sellQty);
      if (!qty || qty <= 0 || !selectedTicker) { Alert.alert('Error', 'Completá los campos'); return; }
      setSubmitting(true);
      const token = await getValidToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/marketplace/sell`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet_id: selectedWallet.id, ticker: selectedTicker, quantity: qty }),
        });
        if (res.ok || res.status === 201) {
          Alert.alert('✓ Venta exitosa', `-${sellQty} ${selectedTicker}\n+${receiveUsd} USDT`);
          setModalVisible(false); loadPool(); loadWalletAssets(selectedWallet.id);
        } else { Alert.alert('Error', await res.text()); }
      } catch { Alert.alert('Error', 'Sin conexión'); }
      finally { setSubmitting(false); }
    }
  };

  const formatUSD = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const maxPayAvailable = walletAssets.find(a => a.ticker === payTicker)?.quantity || 0;
  const maxSellAvailable = walletAssets.find(a => a.ticker === selectedTicker)?.quantity || 0;
  const insufficientFunds = modalMode === 'buy'
    ? (parseFloat(payQty) > maxPayAvailable && payTicker !== '')
    : (parseFloat(sellQty) > maxSellAvailable && selectedTicker !== '');

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Marketplace</Text>
        <TouchableOpacity style={styles.sellBtn} onPress={openSell}>
          <MaterialIcons name="sell" size={16} color="#e74c3c" />
          <Text style={styles.sellBtnText}>Vender</Text>
        </TouchableOpacity>
      </View>

      {wallets.length > 1 && (
        <View style={styles.walletSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {wallets.map(w => (
              <TouchableOpacity key={w.id}
                style={[styles.walletChip, selectedWallet?.id === w.id && styles.walletChipActive]}
                onPress={() => { setSelectedWallet(w); loadWalletAssets(w.id); }}>
                <Text style={[styles.walletChipText, selectedWallet?.id === w.id && styles.walletChipTextActive]}>{w.name || 'Wallet'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? <ActivityIndicator color="#00ADD8" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={pool}
          keyExtractor={item => item.ticker}
          contentContainerStyle={{ padding: 16 }}
          onRefresh={loadPool}
          refreshing={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTicker}>{item.ticker}</Text>
                <Text style={styles.cardPrice}>{formatUSD(item.price_usd)}</Text>
                <Text style={styles.cardQty}>Disponible: {item.quantity.toFixed(4)}</Text>
              </View>
              <TouchableOpacity style={styles.buyBtn} onPress={() => openBuy(item)}>
                <Text style={styles.buyBtnText}>Comprar</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Pozo vacío</Text>}
        />
      )}

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'buy' ? `Comprar ${selectedTicker}` : 'Vender'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#8aaabf" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {modalMode === 'buy' ? (
                <>
                  {/* Quiero comprar */}
                  <Text style={styles.inputLabel}>Quiero recibir ({selectedTicker})</Text>
                  <TextInput style={styles.input} placeholder="0.00" placeholderTextColor="#4a6a80"
                    value={buyQty} onChangeText={onBuyQtyChange} keyboardType="decimal-pad" />
                  {selectedPrice > 0 && buyQty ? (
                    <Text style={styles.conversionHint}>≈ {formatUSD(parseFloat(buyQty || '0') * selectedPrice)}</Text>
                  ) : null}

                  {/* Pago con */}
                  <Text style={styles.inputLabel}>Pago con</Text>
                  <ScrollView horizontal contentContainerStyle={styles.chipRow}>
                    {walletAssets.filter(a => a.ticker !== selectedTicker).map(a => (
                      <TouchableOpacity key={a.ticker}
                        style={[styles.tickerChip, payTicker === a.ticker && styles.tickerChipActive]}
                        onPress={() => selectPayTicker(a.ticker)}>
                        <Text style={styles.tickerChipText}>{a.ticker} ({a.quantity.toFixed(2)})</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {payTicker ? (
                    <>
                      <Text style={styles.inputLabel}>Voy a pagar ({payTicker})</Text>
                      <TextInput style={[styles.input, parseFloat(payQty) > maxPayAvailable ? styles.inputError : null]}
                        placeholder="0.00" placeholderTextColor="#4a6a80"
                        value={payQty} onChangeText={onPayQtyChange} keyboardType="decimal-pad" />
                      <Text style={styles.availableHint}>Disponible: {maxPayAvailable.toFixed(4)} {payTicker}</Text>
                      {parseFloat(payQty) > maxPayAvailable && (
                        <Text style={styles.errorHint}>⚠ Fondos insuficientes — máx {maxPayAvailable.toFixed(4)} {payTicker}</Text>
                      )}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Sell mode */}
                  <Text style={styles.inputLabel}>Ticker a vender</Text>
                  <ScrollView horizontal contentContainerStyle={styles.chipRow}>
                    {walletAssets.map(a => (
                      <TouchableOpacity key={a.ticker}
                        style={[styles.tickerChip, selectedTicker === a.ticker && styles.tickerChipActive]}
                        onPress={() => selectSellTicker(a.ticker)}>
                        <Text style={styles.tickerChipText}>{a.ticker} ({a.quantity.toFixed(2)})</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {selectedTicker ? (
                    <>
                      <Text style={styles.inputLabel}>Cantidad a vender</Text>
                      <TextInput style={[styles.input, parseFloat(sellQty) > maxSellAvailable ? styles.inputError : null]}
                        placeholder="0.00" placeholderTextColor="#4a6a80"
                        value={sellQty} onChangeText={onSellQtyChange} keyboardType="decimal-pad" />
                      <Text style={styles.availableHint}>Disponible: {maxSellAvailable.toFixed(4)}</Text>
                      {parseFloat(sellQty) > maxSellAvailable && (
                        <Text style={styles.errorHint}>⚠ Fondos insuficientes — máx {maxSellAvailable.toFixed(4)}</Text>
                      )}
                      {receiveUsd ? (
                        <View style={styles.receiveBox}>
                          <Text style={styles.receiveLabel}>Recibís</Text>
                          <Text style={styles.receiveValue}>{receiveUsd} USDT</Text>
                          <Text style={styles.receiveUsd}>≈ {formatUSD(parseFloat(receiveUsd || '0'))}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}

              <TouchableOpacity
                style={[styles.executeBtn, (submitting || insufficientFunds) && { opacity: 0.4 }]}
                onPress={insufficientFunds ? () => Alert.alert('Fondos insuficientes', 'No tenés suficiente saldo para esta operación') : execute}
                disabled={submitting || insufficientFunds}
              >
                {submitting ? <ActivityIndicator color="#fff" size="small" /> :
                  <Text style={styles.executeBtnText}>
                    {modalMode === 'buy' ? '✓ Confirmar Compra' : '✓ Confirmar Venta'}
                  </Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: '#e0e0e0', fontSize: 20, fontWeight: '700' },
  sellBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e74c3c20', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e74c3c40' },
  sellBtnText: { color: '#e74c3c', fontWeight: '600', fontSize: 13 },
  walletSelector: { paddingHorizontal: 16, paddingBottom: 8 },
  walletChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#132238' },
  walletChipActive: { backgroundColor: '#00ADD830', borderWidth: 1, borderColor: '#00ADD8' },
  walletChipText: { color: '#8aaabf', fontSize: 12, fontWeight: '600' },
  walletChipTextActive: { color: '#00ADD8' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1f35', borderRadius: 10, padding: 14, marginBottom: 8 },
  cardTicker: { color: '#e0e0e0', fontSize: 16, fontWeight: '700' },
  cardPrice: { color: '#2ecc71', fontSize: 14, marginTop: 2 },
  cardQty: { color: '#4a6a80', fontSize: 11, marginTop: 2 },
  buyBtn: { backgroundColor: '#2ecc71', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { color: '#4a6a80', textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0f1f35', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#e0e0e0', fontSize: 18, fontWeight: '700' },
  inputLabel: { color: '#8aaabf', fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#132238', color: '#e0e0e0', borderRadius: 8, padding: 14, fontSize: 18, fontWeight: '600' },
  inputError: { borderWidth: 1, borderColor: '#e74c3c' },
  conversionHint: { color: '#2ecc71', fontSize: 12, marginTop: 4 },
  availableHint: { color: '#4a6a80', fontSize: 11, marginTop: 4 },
  errorHint: { color: '#e74c3c', fontSize: 11, marginTop: 4 },
  chipRow: { gap: 8, paddingVertical: 4 },
  tickerChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#132238' },
  tickerChipActive: { backgroundColor: '#00ADD830', borderWidth: 1, borderColor: '#00ADD8' },
  tickerChipText: { color: '#c0c0c0', fontSize: 12, fontWeight: '600' },
  receiveBox: { backgroundColor: '#132238', borderRadius: 10, padding: 14, marginTop: 12, alignItems: 'center' },
  receiveLabel: { color: '#4a6a80', fontSize: 11 },
  receiveValue: { color: '#2ecc71', fontSize: 22, fontWeight: '700', marginTop: 4 },
  receiveUsd: { color: '#8aaabf', fontSize: 12, marginTop: 2 },
  executeBtn: { backgroundColor: '#00ADD8', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  executeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
