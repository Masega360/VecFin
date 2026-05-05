import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  total_value?: number;
  currency?: string;
}

interface PlatformItem {
  id: string;
  name: string;
  description: string;
}

type TabView = 'list' | 'typeSelect' | 'form';
type WalletType = 'manual' | 'connected';

// ─────────────────────────────────────────────────────────────────────────────

export default function WalletsTab() {
  const router = useRouter();

  // list
  const [wallets,   setWallets]   = useState<Wallet[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [listError, setListError] = useState('');

  // create flow
  const [view,             setView]             = useState<TabView>('list');
  const [walletType,       setWalletType]       = useState<WalletType>('manual');
  const [name,             setName]             = useState('');
  const [platformQuery,    setPlatformQuery]    = useState('');
  const [platforms,        setPlatforms]        = useState<PlatformItem[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformItem | null>(null);
  const [apiKey,           setApiKey]           = useState('');
  const [apiSecret,        setApiSecret]        = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [formError,        setFormError]        = useState('');

  useEffect(() => { loadWallets(); }, []);

  // ─── API ───────────────────────────────────────────────────────────────────

  const loadWallets = async () => {
    setLoading(true);
    setListError('');
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setListError('Error al cargar wallets'); return; }
      const list: Wallet[] = await res.json() ?? [];

      // Cargar total_value de cada wallet en paralelo
      const details = await Promise.allSettled(
        list.map(w =>
          fetch(`${API_URL}/wallets/${w.id}/details`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.ok ? r.json() : null)
        )
      );

      setWallets(list.map((w, i) => {
        const d = details[i].status === 'fulfilled' ? details[i].value : null;
        return { ...w, total_value: d?.total_value, currency: d?.currency };
      }));
    } catch {
      setListError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  const searchPlatforms = useCallback(async (q: string) => {
    if (!q.trim()) { setPlatforms([]); return; }
    try {
      const res = await fetch(`${API_URL}/platform/search?query=${encodeURIComponent(q)}`);
      if (res.ok) setPlatforms(await res.json() ?? []);
    } catch {
      // no bloquear la UI
    }
  }, []);

  const resetForm = () => {
    setName('');
    setPlatformQuery('');
    setPlatforms([]);
    setSelectedPlatform(null);
    setApiKey('');
    setApiSecret('');
    setFormError('');
  };

  const handleSubmit = async () => {
    if (!name.trim())        { setFormError('El nombre es requerido'); return; }
    if (!selectedPlatform)   { setFormError('Seleccioná una plataforma'); return; }
    if (walletType === 'connected' && (!apiKey.trim() || !apiSecret.trim())) {
      setFormError('API Key y API Secret son requeridos');
      return;
    }

    setSubmitting(true);
    setFormError('');
    const token = await getValidToken();
    if (!token) return;

    const endpoint = walletType === 'connected' ? '/wallets/connect' : '/wallets';
    const body: Record<string, string> = {
      platform_id: selectedPlatform.id,
      name: name.trim(),
    };
    if (walletType === 'connected') {
      body.api_key    = apiKey.trim();
      body.api_secret = apiSecret.trim();
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        resetForm();
        setView('list');
        loadWallets();
      } else {
        setFormError((await res.text()) || 'Error al crear la wallet');
      }
    } catch {
      setFormError('Sin conexión al servidor');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render: selección de tipo ────────────────────────────────────────────

  if (view === 'typeSelect') {
    return (
      <View style={styles.container}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setView('list')}>
            <MaterialIcons name="arrow-back" size={24} color="#00ADD8" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>Tipo de wallet</Text>
          <View style={{ width: 24 }} />
        </View>

        <TouchableOpacity
          style={styles.typeCard}
          onPress={() => { setWalletType('manual'); setView('form'); }}
          activeOpacity={0.75}
        >
          <View style={styles.typeIcon}>
            <MaterialIcons name="edit" size={26} color="#00ADD8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.typeTitle}>Manual</Text>
            <Text style={styles.typeDesc}>Registrás vos mismo tus activos y cantidades.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#4a6a80" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.typeCard}
          onPress={() => { setWalletType('connected'); setView('form'); }}
          activeOpacity={0.75}
        >
          <View style={styles.typeIcon}>
            <MaterialIcons name="link" size={26} color="#00ADD8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.typeTitle}>Conectada</Text>
            <Text style={styles.typeDesc}>
              Vinculada con API Key para sincronizar automáticamente.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#4a6a80" />
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: formulario ───────────────────────────────────────────────────

  if (view === 'form') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => { resetForm(); setView('typeSelect'); }}>
            <MaterialIcons name="arrow-back" size={24} color="#00ADD8" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>
            {walletType === 'manual' ? 'Wallet manual' : 'Wallet conectada'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Mi Binance principal"
            placeholderTextColor="#4a6a80"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Plataforma</Text>
          {selectedPlatform ? (
            <TouchableOpacity
              style={[styles.input, styles.selectedPlatformRow]}
              onPress={() => { setSelectedPlatform(null); setPlatformQuery(''); setPlatforms([]); }}
            >
              <Text style={{ color: '#fff', flex: 1 }}>{selectedPlatform.name}</Text>
              <MaterialIcons name="close" size={16} color="#4a6a80" />
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Buscar plataforma..."
                  placeholderTextColor="#4a6a80"
                  value={platformQuery}
                  onChangeText={q => { setPlatformQuery(q); searchPlatforms(q); }}
                  returnKeyType="search"
                  onSubmitEditing={() => searchPlatforms(platformQuery)}
                />
                <TouchableOpacity
                  style={styles.searchIconBtn}
                  onPress={() => searchPlatforms(platformQuery)}
                >
                  <MaterialIcons name="search" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              {platforms.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.platformRow}
                  onPress={() => { setSelectedPlatform(p); setPlatforms([]); setPlatformQuery(p.name); }}
                >
                  <Text style={styles.platformName}>{p.name}</Text>
                  <Text style={styles.platformDesc} numberOfLines={1}>{p.description}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {walletType === 'connected' && (
            <>
              <Text style={styles.label}>API Key</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu API Key de la plataforma"
                placeholderTextColor="#4a6a80"
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                secureTextEntry
              />
              <Text style={styles.label}>API Secret</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu API Secret de la plataforma"
                placeholderTextColor="#4a6a80"
                value={apiSecret}
                onChangeText={setApiSecret}
                autoCapitalize="none"
                secureTextEntry
              />
            </>
          )}

          {formError ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={14} color="#ff6666" />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Crear wallet</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Render: lista ────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {listError ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={14} color="#ff6666" />
          <Text style={styles.errorText}>{listError}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#00ADD8" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={wallets}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onRefresh={loadWallets}
          refreshing={loading}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.walletCard}
              activeOpacity={0.75}
              onPress={() =>
                router.push({
                  pathname: '/wallet-detail',
                  params: { walletId: item.id, walletName: item.name },
                })
              }
            >
              <View style={styles.walletIcon}>
                <MaterialIcons
                  name={item.api_key ? 'link' : 'edit'}
                  size={24}
                  color="#00ADD8"
                />
              </View>
              <View style={styles.walletCardBody}>
                <Text style={styles.walletName}>{item.name}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, item.api_key ? styles.badgeConnected : styles.badgeManual]}>
                    <Text style={styles.badgeText}>{item.api_key ? 'conectada' : 'manual'}</Text>
                  </View>
                  {item.last_sync ? (
                    <Text style={styles.syncText}>
                      sync {new Date(item.last_sync).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
                {item.total_value != null && item.total_value > 0 && (
                  <Text style={styles.totalValue}>
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: item.currency || 'USD', maximumFractionDigits: 2 }).format(item.total_value)}
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#4a6a80" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="account-balance-wallet" size={56} color="#1e3a5a" />
              <Text style={styles.emptyTitle}>Sin wallets</Text>
              <Text style={styles.emptyText}>Tocá + para agregar la primera</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setView('typeSelect')}>
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // form header
  formHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#132238',
  },
  formTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },
  formScroll: { padding: 20, paddingBottom: 48 },

  // inputs
  label: { color: '#8aaabf', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: '#132238', borderRadius: 12, borderWidth: 1, borderColor: '#1e3a5a',
    color: '#fff', paddingHorizontal: 14, height: 50,
  },
  selectedPlatformRow: { flexDirection: 'row', alignItems: 'center' },
  searchRow:    { flexDirection: 'row', gap: 8 },
  searchIconBtn: {
    backgroundColor: '#00ADD8', borderRadius: 12, width: 50, height: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  platformRow: {
    backgroundColor: '#1e3a5a', borderRadius: 10, padding: 12, marginTop: 6,
  },
  platformName: { color: '#fff', fontWeight: '600', fontSize: 14 },
  platformDesc: { color: '#8aaabf', fontSize: 12, marginTop: 2 },
  submitBtn: {
    backgroundColor: '#00ADD8', padding: 15, borderRadius: 14,
    alignItems: 'center', marginTop: 28,
    shadowColor: '#00ADD8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // type select
  typeCard: {
    backgroundColor: '#132238', borderRadius: 16, borderWidth: 1, borderColor: '#1e3a5a',
    margin: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  typeIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },
  typeTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  typeDesc:  { color: '#8aaabf', fontSize: 13, lineHeight: 18 },

  // list
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  walletCard: {
    backgroundColor: '#132238', borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#1e3a5a', flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  walletIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00ADD815', justifyContent: 'center', alignItems: 'center',
  },
  walletCardBody: { flex: 1 },
  walletName:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  badgeRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge:          { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeConnected: { backgroundColor: '#00ADD820' },
  badgeManual:    { backgroundColor: '#1e3a5a' },
  badgeText:      { color: '#00ADD8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  syncText:       { color: '#4a6a80', fontSize: 11 },
  totalValue:     { color: '#00ADD8', fontSize: 15, fontWeight: '700', marginTop: 4 },

  // empty
  empty:      { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyTitle: { color: '#4a6a80', fontSize: 20, fontWeight: '700' },
  emptyText:  { color: '#2a4a60', fontSize: 14 },

  // error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 12,
  },
  errorText: { color: '#ff6666', fontSize: 13 },

  // fab
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: '#00ADD8', width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00ADD8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
});
