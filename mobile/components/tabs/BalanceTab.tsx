import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, TextInput, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface Balance {
  balance_usd: number;
  free_tokens_remaining: number;
  is_premium: boolean;
  max_message_length: number;
}

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000];

export default function BalanceTab() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const fetchBalance = useCallback(async () => {
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBalance(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const handleTopup = async (amountARS: number) => {
    if (amountARS < 100) {
      Alert.alert('Error', 'El monto mínimo es $100 ARS');
      return;
    }
    setTopupLoading(true);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/balance/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_ars: amountARS }),
      });
      const data = await res.json();
      if (res.ok && data.checkout_url) {
        if (Platform.OS === 'web') {
          window.open(data.checkout_url, '_blank');
        } else {
          await Linking.openURL(data.checkout_url);
        }
      } else {
        const msg = data.error || data.message || JSON.stringify(data);
        Alert.alert('Error', msg);
        console.error('[topup] error:', msg);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Error de conexión');
      console.error('[topup] catch:', e);
    } finally {
      setTopupLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ADD8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Balance actual */}
      <View style={styles.balanceCard}>
        <MaterialIcons name="account-balance-wallet" size={32} color="#00ADD8" />
        <Text style={styles.balanceLabel}>Saldo disponible</Text>
        <Text style={styles.balanceAmount}>
          USD {balance?.balance_usd?.toFixed(4) ?? '0.0000'}
        </Text>
        <View style={styles.tierRow}>
          <View style={[styles.badge, balance?.is_premium ? styles.premiumBadge : styles.freeBadge]}>
            <Text style={styles.badgeText}>
              {balance?.is_premium ? '⭐ Premium' : 'Free'}
            </Text>
          </View>
          <Text style={styles.tierInfo}>
            {balance?.is_premium
              ? `Mensajes hasta ${balance.max_message_length} chars`
              : `${balance?.free_tokens_remaining ?? 0} usos gratuitos restantes`
            }
          </Text>
        </View>
      </View>

      {/* Cargar saldo */}
      <Text style={styles.sectionTitle}>Cargar saldo con MercadoPago</Text>
      <Text style={styles.sectionSubtitle}>
        Elegí un monto o ingresá uno personalizado
      </Text>

      <View style={styles.presetsRow}>
        {PRESET_AMOUNTS.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.presetBtn}
            onPress={() => handleTopup(amount)}
            disabled={topupLoading}
          >
            <Text style={styles.presetText}>${amount}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          placeholder="Otro monto (ARS)"
          placeholderTextColor="#5a7a8a"
          keyboardType="numeric"
          value={customAmount}
          onChangeText={setCustomAmount}
        />
        <TouchableOpacity
          style={[styles.customBtn, topupLoading && styles.disabled]}
          onPress={() => handleTopup(Number(customAmount))}
          disabled={topupLoading || !customAmount}
        >
          {topupLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.customBtnText}>Pagar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <MaterialIcons name="info-outline" size={18} color="#5a7a8a" />
        <Text style={styles.infoText}>
          Al cargar saldo accedés a beneficios premium: mensajes más largos en el chat IA y uso ilimitado.
          Se te redirigirá a MercadoPago para completar el pago.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a1628' },
  balanceCard: {
    backgroundColor: '#111d2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1a2d42',
  },
  balanceLabel: { color: '#8aaabf', fontSize: 14, marginTop: 8 },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 4 },
  tierRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  premiumBadge: { backgroundColor: '#f5a623' },
  freeBadge: { backgroundColor: '#2a3f52' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tierInfo: { color: '#8aaabf', fontSize: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { color: '#5a7a8a', fontSize: 13, marginBottom: 16 },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  presetBtn: {
    backgroundColor: '#1a2d42',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a4a5f',
  },
  presetText: { color: '#00ADD8', fontSize: 16, fontWeight: '600' },
  customRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  customInput: {
    flex: 1,
    backgroundColor: '#111d2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1a2d42',
  },
  customBtn: {
    backgroundColor: '#00ADD8',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  customBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#111d2e',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: { color: '#5a7a8a', fontSize: 12, flex: 1, lineHeight: 18 },
});
