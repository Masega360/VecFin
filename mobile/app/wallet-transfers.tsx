import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface Transfer {
  id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  ticker: string;
  quantity: number;
  note?: string;
  created_by: string;
  created_at: string;
}

interface WalletOption {
  id: string;
  name: string;
}

interface AssetHolding {
  ticker: string;
  quantity: number;
}

export default function WalletTransfersScreen() {
  const { walletId, walletName } = useLocalSearchParams<{ walletId: string; walletName: string }>();
  const router = useRouter();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // form
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // wallet destino autocomplete
  const [myWallets, setMyWallets] = useState<WalletOption[]>([]);
  const [walletQuery, setWalletQuery] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);
  const [showWalletSuggestions, setShowWalletSuggestions] = useState(false);

  // ticker autocomplete
  const [myAssets, setMyAssets] = useState<AssetHolding[]>([]);
  const [tickerQuery, setTickerQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetHolding | null>(null);
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);

  // quantity
  const [quantity, setQuantity] = useState('');
  const [qtyError, setQtyError] = useState('');

  useEffect(() => { loadTransfers(); loadMyWallets(); loadMyAssets(); }, []);

  const loadTransfers = async () => {
    setLoading(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/transfers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTransfers(await res.json());
      else setError('Error al cargar transferencias');
    } catch { setError('Sin conexión'); }
    finally { setLoading(false); }
  };

  const loadMyWallets = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = await res.json();
        // Excluir la wallet actual
        setMyWallets((list || []).filter((w: any) => w.id !== walletId).map((w: any) => ({ id: w.id, name: w.name })));
      }
    } catch {}
  };

  const loadMyAssets = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMyAssets(await res.json() || []);
    } catch {}
  };

  const filteredWallets = myWallets.filter(w =>
    w.name.toLowerCase().includes(walletQuery.toLowerCase()) ||
    w.id.toLowerCase().includes(walletQuery.toLowerCase())
  );

  const filteredTickers = myAssets.filter(a =>
    a.ticker.toLowerCase().includes(tickerQuery.toLowerCase())
  );

  const validateQuantity = (val: string) => {
    setQuantity(val);
    const num = parseFloat(val);
    if (!selectedAsset) { setQtyError(''); return; }
    if (isNaN(num) || num <= 0) { setQtyError('Debe ser mayor a 0'); return; }
    if (num > selectedAsset.quantity) { setQtyError(`Máx: ${selectedAsset.quantity}`); return; }
    setQtyError('');
  };

  const doTransfer = async () => {
    if (!selectedWallet) { Alert.alert('Error', 'Seleccioná una wallet destino'); return; }
    if (!selectedAsset) { Alert.alert('Error', 'Seleccioná un ticker'); return; }
    const num = parseFloat(quantity);
    if (isNaN(num) || num <= 0) { Alert.alert('Error', 'Cantidad inválida'); return; }
    if (num > selectedAsset.quantity) { Alert.alert('Error', `Saldo insuficiente. Tenés ${selectedAsset.quantity}`); return; }

    setSubmitting(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/transfers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_wallet_id: selectedWallet.id,
          ticker: selectedAsset.ticker,
          quantity: num,
          note: note.trim(),
        }),
      });
      if (res.ok || res.status === 201) {
        setSelectedWallet(null); setWalletQuery('');
        setSelectedAsset(null); setTickerQuery('');
        setQuantity(''); setNote(''); setShowForm(false);
        loadTransfers(); loadMyAssets();
      } else {
        const txt = await res.text();
        Alert.alert('Error', txt || 'No se pudo transferir');
      }
    } catch { Alert.alert('Error', 'Sin conexión'); }
    finally { setSubmitting(false); }
  };

  const isOutgoing = (t: Transfer) => t.from_wallet_id === walletId;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#e0e0e0" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Transferencias · {walletName}</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}>
          <MaterialIcons name="send" size={22} color="#00ADD8" />
        </TouchableOpacity>
      </View>

      {/* Transfer form */}
      {showForm && (
        <View style={styles.form}>
          {/* Wallet destino */}
          <Text style={styles.label}>Wallet destino</Text>
          {selectedWallet ? (
            <TouchableOpacity style={styles.selected} onPress={() => { setSelectedWallet(null); setWalletQuery(''); }}>
              <Text style={styles.selectedText}>{selectedWallet.name}</Text>
              <MaterialIcons name="close" size={16} color="#8aaabf" />
            </TouchableOpacity>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Buscar wallet..."
                placeholderTextColor="#4a6a80"
                value={walletQuery}
                onChangeText={v => { setWalletQuery(v); setShowWalletSuggestions(true); }}
                onFocus={() => setShowWalletSuggestions(true)}
              />
              {showWalletSuggestions && filteredWallets.length > 0 && (
                <View style={styles.suggestions}>
                  {filteredWallets.slice(0, 5).map(w => (
                    <TouchableOpacity key={w.id} style={styles.suggestionItem}
                      onPress={() => { setSelectedWallet(w); setWalletQuery(w.name); setShowWalletSuggestions(false); }}>
                      <Text style={styles.suggestionText}>{w.name}</Text>
                      <Text style={styles.suggestionSub}>{w.id.slice(0, 8)}...</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Ticker */}
          <Text style={styles.label}>Ticker</Text>
          {selectedAsset ? (
            <TouchableOpacity style={styles.selected} onPress={() => { setSelectedAsset(null); setTickerQuery(''); setQuantity(''); setQtyError(''); }}>
              <Text style={styles.selectedText}>{selectedAsset.ticker}</Text>
              <Text style={styles.selectedSub}>Disponible: {selectedAsset.quantity}</Text>
              <MaterialIcons name="close" size={16} color="#8aaabf" />
            </TouchableOpacity>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Buscar ticker..."
                placeholderTextColor="#4a6a80"
                value={tickerQuery}
                onChangeText={v => { setTickerQuery(v.toUpperCase()); setShowTickerSuggestions(true); }}
                onFocus={() => setShowTickerSuggestions(true)}
                autoCapitalize="characters"
              />
              {showTickerSuggestions && filteredTickers.length > 0 && (
                <View style={styles.suggestions}>
                  {filteredTickers.map(a => (
                    <TouchableOpacity key={a.ticker} style={styles.suggestionItem}
                      onPress={() => { setSelectedAsset(a); setTickerQuery(a.ticker); setShowTickerSuggestions(false); }}>
                      <Text style={styles.suggestionText}>{a.ticker}</Text>
                      <Text style={styles.suggestionSub}>Tenés: {a.quantity}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {myAssets.length === 0 && (
                <Text style={styles.hint}>Esta wallet no tiene assets</Text>
              )}
            </View>
          )}

          {/* Cantidad */}
          <Text style={styles.label}>Cantidad</Text>
          <TextInput
            style={[styles.input, qtyError ? styles.inputError : null]}
            placeholder={selectedAsset ? `Máx: ${selectedAsset.quantity}` : 'Cantidad'}
            placeholderTextColor="#4a6a80"
            value={quantity}
            onChangeText={validateQuantity}
            keyboardType="decimal-pad"
          />
          {qtyError ? <Text style={styles.qtyError}>{qtyError}</Text> : null}

          {/* Nota */}
          <TextInput
            style={styles.input}
            placeholder="Nota (opcional)"
            placeholderTextColor="#4a6a80"
            value={note}
            onChangeText={setNote}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (qtyError || !selectedWallet || !selectedAsset) && styles.submitDisabled]}
            onPress={doTransfer}
            disabled={submitting || !!qtyError || !selectedWallet || !selectedAsset}
          >
            {submitting ? <ActivityIndicator color="#fff" size="small" /> :
              <Text style={styles.submitText}>Enviar</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? <ActivityIndicator color="#00ADD8" style={{ marginTop: 40 }} /> :
        error ? <Text style={styles.errorText}>{error}</Text> :
          <FlatList
            data={transfers}
            keyExtractor={t => t.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const out = isOutgoing(item);
              return (
                <View style={styles.card}>
                  <View style={styles.cardIcon}>
                    <MaterialIcons
                      name={out ? 'arrow-upward' : 'arrow-downward'}
                      size={20}
                      color={out ? '#e74c3c' : '#2ecc71'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTicker}>{item.ticker} · {item.quantity}</Text>
                    <Text style={styles.cardNote}>
                      {out ? 'Enviado' : 'Recibido'}{item.note ? ` · ${item.note}` : ''}
                    </Text>
                    <Text style={styles.cardDate}>
                      {new Date(item.created_at).toLocaleDateString('es-AR')}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Sin transferencias</Text>}
          />
      }
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628', paddingTop: Platform.OS === 'android' ? 40 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, color: '#e0e0e0', fontSize: 18, fontWeight: '700' },
  form: { padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: '#132238' },
  label: { color: '#8aaabf', fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: { backgroundColor: '#132238', color: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 14 },
  inputError: { borderWidth: 1, borderColor: '#e74c3c' },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#00ADD815', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#00ADD840' },
  selectedText: { color: '#e0e0e0', fontWeight: '600', flex: 1 },
  selectedSub: { color: '#8aaabf', fontSize: 11 },
  suggestions: { backgroundColor: '#1a2d45', borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#132238' },
  suggestionText: { color: '#e0e0e0', fontWeight: '600' },
  suggestionSub: { color: '#4a6a80', fontSize: 11 },
  hint: { color: '#4a6a80', fontSize: 11, marginTop: 4 },
  qtyError: { color: '#e74c3c', fontSize: 11, marginTop: 2 },
  submitBtn: { backgroundColor: '#00ADD8', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1f35', borderRadius: 10, padding: 14, marginBottom: 10, gap: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#132238', alignItems: 'center', justifyContent: 'center' },
  cardTicker: { color: '#e0e0e0', fontSize: 15, fontWeight: '700' },
  cardNote: { color: '#4a6a80', fontSize: 12, marginTop: 2 },
  cardDate: { color: '#2a4a60', fontSize: 11, marginTop: 2 },
  empty: { color: '#4a6a80', textAlign: 'center', marginTop: 40 },
  errorText: { color: '#e74c3c', textAlign: 'center', marginTop: 40 },
});
