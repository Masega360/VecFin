import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform, Modal,
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
  const [quantity, setQuantity] = useState('');
  const [payTicker, setPayTicker] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // wallets del user (para elegir desde cuál operar)
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);
  const [walletAssets, setWalletAssets] = useState<AssetHolding[]>([]);

  useEffect(() => { loadPool(); loadWallets(); }, []);

  const loadPool = async () => {
    setLoading(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/marketplace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPool(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  const loadWallets = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const list = await res.json() || [];
        const operable = list.filter((w: any) => w.my_role === 'owner' || w.my_role === 'admin');
        setWallets(operable);
        if (operable.length > 0) setSelectedWallet(operable[0]);
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

  const openBuy = (ticker: string) => {
    setSelectedTicker(ticker);
    setModalMode('buy');
    setQuantity('');
    setPayTicker('');
    if (selectedWallet) loadWalletAssets(selectedWallet.id);
    setModalVisible(true);
  };

  const openSell = () => {
    setModalMode('sell');
    setSelectedTicker('');
    setQuantity('');
    if (selectedWallet) loadWalletAssets(selectedWallet.id);
    setModalVisible(true);
  };

  const execute = async () => {
    if (!selectedWallet || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Completá los campos');
      return;
    }
    setSubmitting(true);
    const token = await getValidToken();
    if (!token) return;

    const endpoint = modalMode === 'buy' ? '/marketplace/buy' : '/marketplace/sell';
    const payload: any = {
      wallet_id: selectedWallet.id,
      ticker: selectedTicker,
      quantity: parseFloat(quantity),
    };
    if (modalMode === 'buy') payload.pay_ticker = payTicker;

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok || res.status === 201) {
        const data = await res.json();
        Alert.alert('✓ Operación exitosa',
          modalMode === 'buy'
            ? `Compraste ${quantity} ${selectedTicker}\nPagaste ${data.paid?.toFixed(4)} ${payTicker}`
            : `Vendiste ${quantity} ${selectedTicker}\nRecibiste ${data.received_usdt?.toFixed(2)} USDT`
        );
        setModalVisible(false);
        loadPool();
      } else {
        const txt = await res.text();
        Alert.alert('Error', txt);
      }
    } catch { Alert.alert('Error', 'Sin conexión'); }
    finally { setSubmitting(false); }
  };

  const formatUSD = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Marketplace</Text>
        <TouchableOpacity style={styles.sellBtn} onPress={openSell}>
          <MaterialIcons name="sell" size={16} color="#e74c3c" />
          <Text style={styles.sellBtnText}>Vender</Text>
        </TouchableOpacity>
      </View>

      {/* Wallet selector */}
      {wallets.length > 1 && (
        <View style={styles.walletSelector}>
          {wallets.map(w => (
            <TouchableOpacity
              key={w.id}
              style={[styles.walletChip, selectedWallet?.id === w.id && styles.walletChipActive]}
              onPress={() => { setSelectedWallet(w); loadWalletAssets(w.id); }}
            >
              <Text style={[styles.walletChipText, selectedWallet?.id === w.id && styles.walletChipTextActive]} numberOfLines={1}>
                {w.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Pool list */}
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
              <TouchableOpacity style={styles.buyBtn} onPress={() => openBuy(item.ticker)}>
                <Text style={styles.buyBtnText}>Comprar</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Pozo vacío</Text>}
        />
      )}

      {/* Modal buy/sell */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'buy' ? 'Comprar' : 'Vender'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#8aaabf" />
              </TouchableOpacity>
            </View>

            {modalMode === 'sell' && (
              <>
                <Text style={styles.inputLabel}>Ticker a vender</Text>
                <View style={styles.chipRow}>
                  {walletAssets.map(a => (
                    <TouchableOpacity key={a.ticker}
                      style={[styles.tickerChip, selectedTicker === a.ticker && styles.tickerChipActive]}
                      onPress={() => setSelectedTicker(a.ticker)}>
                      <Text style={styles.tickerChipText}>{a.ticker} ({a.quantity.toFixed(2)})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {modalMode === 'buy' && (
              <>
                <Text style={styles.inputLabel}>Comprar: {selectedTicker}</Text>
                <Text style={styles.inputLabel}>Pagar con:</Text>
                <View style={styles.chipRow}>
                  {walletAssets.filter(a => a.ticker !== selectedTicker).map(a => (
                    <TouchableOpacity key={a.ticker}
                      style={[styles.tickerChip, payTicker === a.ticker && styles.tickerChipActive]}
                      onPress={() => setPayTicker(a.ticker)}>
                      <Text style={styles.tickerChipText}>{a.ticker} ({a.quantity.toFixed(2)})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>Cantidad</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#4a6a80"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.executeBtn} onPress={execute} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> :
                <Text style={styles.executeBtnText}>{modalMode === 'buy' ? 'Confirmar Compra' : 'Confirmar Venta'}</Text>}
            </TouchableOpacity>
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
  walletSelector: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  walletChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#132238' },
  walletChipActive: { backgroundColor: '#00ADD830', borderWidth: 1, borderColor: '#00ADD8' },
  walletChipText: { color: '#4a6a80', fontSize: 12, fontWeight: '600', maxWidth: 100 },
  walletChipTextActive: { color: '#00ADD8' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1f35', borderRadius: 10, padding: 14, marginBottom: 8 },
  cardTicker: { color: '#e0e0e0', fontSize: 16, fontWeight: '700' },
  cardPrice: { color: '#2ecc71', fontSize: 14, marginTop: 2 },
  cardQty: { color: '#4a6a80', fontSize: 11, marginTop: 2 },
  buyBtn: { backgroundColor: '#2ecc71', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { color: '#4a6a80', textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0f1f35', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#e0e0e0', fontSize: 18, fontWeight: '700' },
  inputLabel: { color: '#8aaabf', fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#132238', color: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tickerChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#132238' },
  tickerChipActive: { backgroundColor: '#00ADD830', borderWidth: 1, borderColor: '#00ADD8' },
  tickerChipText: { color: '#c0c0c0', fontSize: 12, fontWeight: '600' },
  executeBtn: { backgroundColor: '#00ADD8', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  executeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
