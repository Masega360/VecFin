import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, Dimensions,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Line, Text as SvgText } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;
const CHART_HEIGHT = 180;
const CHART_PAD = { top: 12, bottom: 28, left: 8, right: 8 };

type Range = '7d' | '1mo' | '3mo' | '1y';

const RANGES: { label: string; value: Range }[] = [
  { label: '7D', value: '7d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1A', value: '1y' },
];

interface OHLCPoint { t: number; c: number; }

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

// ─── Line chart ──────────────────────────────────────────────────────────────
function LineChart({ history, positive }: { history: OHLCPoint[]; positive: boolean }) {
  if (!history || history.length < 2) return null;

  const closes = history.map(p => p.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const innerW = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const toX = (i: number) => CHART_PAD.left + (i / (closes.length - 1)) * innerW;
  const toY = (v: number) => CHART_PAD.top + (1 - (v - min) / range) * innerH;

  const linePath = closes
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ');

  const fillPath =
    linePath +
    ` L${toX(closes.length - 1).toFixed(1)},${(CHART_PAD.top + innerH).toFixed(1)}` +
    ` L${toX(0).toFixed(1)},${(CHART_PAD.top + innerH).toFixed(1)} Z`;

  const color = positive ? '#00D26A' : '#FF4D4D';
  const gradId = positive ? 'gradUp' : 'gradDown';

  // 3 horizontal guide lines
  const guides = [0, 0.5, 1].map(pct => ({
    y: CHART_PAD.top + pct * innerH,
    val: (max - pct * range).toFixed(2),
  }));

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {guides.map((g, i) => (
        <React.Fragment key={i}>
          <Line
            x1={CHART_PAD.left} y1={g.y}
            x2={CHART_WIDTH - CHART_PAD.right} y2={g.y}
            stroke="#1e3a5a" strokeWidth="1" strokeDasharray="4,4"
          />
          <SvgText
            x={CHART_WIDTH - CHART_PAD.right + 2} y={g.y + 4}
            fontSize="9" fill="#4a6a80"
          >
            {g.val}
          </SvgText>
        </React.Fragment>
      ))}

      <Path d={fillPath} fill={`url(#${gradId})`} />
      <Path d={linePath} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(v);
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function AssetDetailScreen() {
  const { symbol, name } = useLocalSearchParams<{ symbol: string; name: string }>();
  const router = useRouter();

  const [details, setDetails] = useState<AssetDetails | null>(null);
  const [range, setRange] = useState<Range>('1mo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [range]);

  useEffect(() => {
    checkFav();
  }, []);

  const fetchDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/assets/${symbol}?range=${range}`);
      if (res.ok) setDetails(await res.json());
      else setError('No se pudo cargar el activo');
    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  const checkFav = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;
    const res = await fetch(`${API_URL}/assets/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const favs: { asset_id: string }[] = await res.json() ?? [];
      setIsFav(favs.some(f => f.asset_id === symbol));
    }
  };

  const toggleFav = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;
    if (isFav) {
      await fetch(`${API_URL}/assets/favorites/${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      await fetch(`${API_URL}/assets/favorites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: symbol }),
      });
    }
    setIsFav(f => !f);
  };

  const positive = (details?.change ?? 0) >= 0;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#8aaabf" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSymbol}>{symbol}</Text>
          <Text style={styles.headerName} numberOfLines={1}>
            {details?.name ?? name ?? ''}
          </Text>
        </View>
        <TouchableOpacity onPress={toggleFav} style={styles.favBtn}>
          <MaterialIcons
            name={isFav ? 'star' : 'star-border'}
            size={26}
            color={isFav ? '#FFB300' : '#4a6a80'}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#00ADD8" style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={20} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : details ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Price block */}
          <View style={styles.priceBlock}>
            <Text style={styles.price}>
              {details.currency} {details.price.toFixed(2)}
            </Text>
            <View style={[styles.changePill, { backgroundColor: positive ? '#0d2a1a' : '#2a0d0d' }]}>
              <MaterialIcons
                name={positive ? 'arrow-drop-up' : 'arrow-drop-down'}
                size={20}
                color={positive ? '#00D26A' : '#FF4D4D'}
              />
              <Text style={[styles.changeText, { color: positive ? '#00D26A' : '#FF4D4D' }]}>
                {positive ? '+' : ''}{details.change.toFixed(2)} ({positive ? '+' : ''}{details.change_pct.toFixed(2)}%)
              </Text>
            </View>
          </View>

          {/* Range selector */}
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

          {/* Chart */}
          <View style={styles.chartContainer}>
            <LineChart history={details.history} positive={positive} />
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <Stat label="Apertura" value={details.open.toFixed(2)} />
            <Stat label="Máximo" value={details.high.toFixed(2)} />
            <Stat label="Mínimo" value={details.low.toFixed(2)} />
            <Stat label="Volumen" value={formatVolume(details.volume)} />
            {details.market_cap > 0 && (
              <Stat label="Cap. de mercado" value={formatVolume(details.market_cap)} />
            )}
            <Stat label="Moneda" value={details.currency} />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a1628',
    paddingTop: Platform.OS === 'android' ? 36 : 52,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#132238',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerSymbol: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerName: { color: '#8aaabf', fontSize: 12, marginTop: 1 },
  favBtn: { padding: 4 },
  scroll: { padding: 16, paddingBottom: 40 },
  priceBlock: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  price: { color: '#fff', fontSize: 32, fontWeight: '800' },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 2,
  },
  changeText: { fontSize: 14, fontWeight: '600' },
  rangeBar: {
    flexDirection: 'row',
    backgroundColor: '#0d1e30',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  rangeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  rangeBtnActive: { backgroundColor: '#132238' },
  rangeBtnText: { color: '#4a6a80', fontSize: 13, fontWeight: '600' },
  rangeBtnTextActive: { color: '#00ADD8' },
  chartContainer: {
    backgroundColor: '#0d1e30',
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    backgroundColor: '#132238',
    borderRadius: 14,
    padding: 14,
    width: (SCREEN_WIDTH - 32 - 8) / 2 - 4,
    borderWidth: 1,
    borderColor: '#1e3a5a',
  },
  statLabel: { color: '#4a6a80', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  errorBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  errorText: { color: '#ff6666', fontSize: 14 },
});
