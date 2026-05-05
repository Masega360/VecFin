import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import AssetChart, { OHLCPoint, ChartRange } from '@/components/AssetChart';
import { API_URL, getValidToken } from '@/utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RANGES: { label: string; value: ChartRange }[] = [
  { label: '7D',  value: '7d'  },
  { label: '1M',  value: '1mo' },
  { label: '3M',  value: '3mo' },
  { label: '1A',  value: '1y'  },
];

interface AssetDetails {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  change: number;
  change_pct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  market_cap: number;
  history: OHLCPoint[];
}

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(v);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function AssetDetailScreen() {
  const { symbol, name, from, fallbackPrice, fallbackCurrency } = useLocalSearchParams<{
    symbol: string;
    name: string;
    from?: string;
    fallbackPrice?: string;
    fallbackCurrency?: string;
  }>();
  const router = useRouter();

  const [details,      setDetails]      = useState<AssetDetails | null>(null);
  const [pageLoading,  setPageLoading]  = useState(true);
  const [pageError,    setPageError]    = useState('');
  const [history,      setHistory]      = useState<OHLCPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [range,        setRange]        = useState<ChartRange>('1mo');
  const [isFav,        setIsFav]        = useState(false);
  const [favLoading,   setFavLoading]   = useState(false);

  useEffect(() => { fetchInitial(); checkFav(); }, []);
  useEffect(() => { if (details) fetchHistory(range); }, [range]);

  // Volvemos siempre a la tab de origen (from). router.back() en web
  // no garantiza caer en la tab correcta, así que navegamos explícito.
  const goBack = () => {
    router.replace({ pathname: '/home', params: { tab: from || 'assets' } });
  };

  const fetchInitial = async () => {
    setPageLoading(true);
    setPageError('');
    try {
      const res = await fetch(`${API_URL}/assets/${symbol}?range=1mo`);
      if (res.ok) {
        const data: AssetDetails = await res.json();
        setDetails(data);
        setHistory(data.history ?? []);
      } else if (res.status === 404) {
        // Asset no existe en Yahoo (ej: token de exchange) → usar datos del fallback
        const price = parseFloat(fallbackPrice ?? '0') || 0;
        const currency = fallbackCurrency ?? 'USD';
        if (price > 0) {
          setDetails({
            symbol: symbol ?? '',
            name: name ?? symbol ?? '',
            currency,
            price,
            change: 0, change_pct: 0,
            open: 0, high: 0, low: 0, volume: 0, market_cap: 0,
            history: [],
          });
        } else {
          setPageError('Activo no disponible en el mercado');
        }
      } else {
        setPageError('No se pudo cargar el activo');
      }
    } catch {
      setPageError('Sin conexión al servidor');
    } finally {
      setPageLoading(false);
    }
  };

  const fetchHistory = async (r: ChartRange) => {
    setChartLoading(true);
    try {
      const res = await fetch(`${API_URL}/assets/${symbol}?range=${r}`);
      if (res.ok) {
        const data: AssetDetails = await res.json();
        setHistory(data.history ?? []);
      }
    } catch {
      // el chart muestra estado vacío si falla
    } finally {
      setChartLoading(false);
    }
  };

  const checkFav = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/assets/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const favs: { asset_id: string }[] = await res.json() ?? [];
        setIsFav(favs.some(f => f.asset_id === symbol));
      }
    } catch {}
  };

  const toggleFav = async () => {
    if (favLoading) return;
    const token = await getValidToken();
    if (!token) return;

    const wasF = isFav;
    setIsFav(f => !f);       // optimistic
    setFavLoading(true);
    try {
      const res = isFav
        ? await fetch(`${API_URL}/assets/favorites/${encodeURIComponent(symbol)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        : await fetch(`${API_URL}/assets/favorites`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ asset_id: symbol }),
          });

      if (!res.ok) setIsFav(wasF); // rollback si falló
    } catch {
      setIsFav(wasF);              // rollback si no hay red
    } finally {
      setFavLoading(false);
    }
  };

  const positive = (details?.change ?? 0) >= 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#8aaabf" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSymbol}>{symbol}</Text>
          <Text style={styles.headerName} numberOfLines={1}>{details?.name ?? name ?? ''}</Text>
        </View>
        <TouchableOpacity onPress={toggleFav} style={styles.favBtn} disabled={favLoading}>
          <MaterialIcons
            name={isFav ? 'star' : 'star-border'}
            size={26}
            color={favLoading ? '#2a4a60' : isFav ? '#FFB300' : '#4a6a80'}
          />
        </TouchableOpacity>
      </View>

      {pageLoading ? (
        <ActivityIndicator color="#00ADD8" style={{ flex: 1 }} />
      ) : pageError ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={20} color="#ff4444" />
          <Text style={styles.errorText}>{pageError}</Text>
        </View>
      ) : details ? (
        <ScrollView contentContainerStyle={styles.scroll} scrollEventThrottle={16}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{details.currency} {details.price.toFixed(2)}</Text>
            <View style={[styles.changePill, { backgroundColor: positive ? '#0d2a1a' : '#2a0d0d' }]}>
              <MaterialIcons
                name={positive ? 'arrow-drop-up' : 'arrow-drop-down'}
                size={20} color={positive ? '#00D26A' : '#FF4D4D'}
              />
              <Text style={[styles.changeText, { color: positive ? '#00D26A' : '#FF4D4D' }]}>
                {positive ? '+' : ''}{details.change.toFixed(2)}{'  '}
                ({positive ? '+' : ''}{details.change_pct.toFixed(2)}%)
              </Text>
            </View>
          </View>

          <View style={styles.rangeBar}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.rangeBtn, range === r.value && styles.rangeBtnActive]}
                onPress={() => setRange(r.value)}
              >
                <Text style={[styles.rangeBtnText, range === r.value && styles.rangeBtnTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chartCard}>
            <AssetChart
              history={history}
              positive={positive}
              currency={details.currency}
              currentPrice={details.price}
              range={range}
              loading={chartLoading}
            />
          </View>

          <View style={styles.statsGrid}>
            <Stat label="Apertura"       value={details.open.toFixed(2)} />
            <Stat label="Máximo del día" value={details.high.toFixed(2)} />
            <Stat label="Mínimo del día" value={details.low.toFixed(2)} />
            <Stat label="Volumen"        value={formatVolume(details.volume)} />
            {details.market_cap > 0 && (
              <Stat label="Cap. mercado" value={formatVolume(details.market_cap)} />
            )}
            <Stat label="Moneda"         value={details.currency} />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#0a1628',
    paddingTop: Platform.OS === 'android' ? 36 : 52,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#132238',
  },
  backBtn:      { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerSymbol: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerName:   { color: '#8aaabf', fontSize: 12, marginTop: 1 },
  favBtn:       { padding: 4 },
  scroll:       { padding: 16, paddingBottom: 40 },
  priceRow: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: 10, marginBottom: 14,
  },
  price: { color: '#fff', fontSize: 30, fontWeight: '800' },
  changePill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 2,
  },
  changeText: { fontSize: 13, fontWeight: '600' },
  rangeBar: {
    flexDirection: 'row', backgroundColor: '#0d1e30',
    borderRadius: 12, padding: 4, marginBottom: 10,
  },
  rangeBtn:           { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  rangeBtnActive:     { backgroundColor: '#132238' },
  rangeBtnText:       { color: '#4a6a80', fontSize: 13, fontWeight: '600' },
  rangeBtnTextActive: { color: '#00ADD8' },
  chartCard: {
    backgroundColor: '#0d1e30', borderRadius: 16,
    paddingVertical: 10, marginBottom: 16, overflow: 'hidden',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    backgroundColor: '#132238', borderRadius: 14, padding: 14,
    width: (SCREEN_WIDTH - 32 - 8) / 2 - 4,
    borderWidth: 1, borderColor: '#1e3a5a',
  },
  statLabel: { color: '#4a6a80', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  errorBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  errorText: { color: '#ff6666', fontSize: 14 },
});
