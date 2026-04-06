import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, PanResponder,
  ActivityIndicator, Dimensions,
} from 'react-native';
import Svg, {
  Path, Defs, LinearGradient, Stop,
  Line, Circle, Text as SvgText,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const W = SCREEN_WIDTH - 32;
const H = 200;
const PAD = { top: 16, bottom: 28, left: 54, right: 8 };

export interface OHLCPoint { t: number; c: number; }

export type ChartRange = '7d' | '1mo' | '3mo' | '1y';

interface Props {
  history: OHLCPoint[];
  positive: boolean;
  currency: string;
  currentPrice: number;
  range: ChartRange;
  loading?: boolean;
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtLabel(ts: number, range: ChartRange): string {
  const d = new Date(ts * 1000);
  if (range === '7d') return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}h`;
  if (range === '1y') return `${MONTHS[d.getMonth()].slice(0,3)} '${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`;
}

function fmtFull(ts: number, range: ChartRange): string {
  const d = new Date(ts * 1000);
  if (range === '7d') return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:00`;
  if (range === '1y') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function AssetChart({ history, positive, currency, currentPrice, range, loading }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const color = positive ? '#00D26A' : '#FF4D4D';
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const closes = useMemo(() => history.map(p => p.c), [history]);
  const min = useMemo(() => Math.min(...closes), [closes]);
  const max = useMemo(() => Math.max(...closes), [closes]);
  const priceRange = max - min || 1;

  const toX = (i: number) => PAD.left + (i / Math.max(closes.length - 1, 1)) * innerW;
  const toY = (v: number) => PAD.top + (1 - (v - min) / priceRange) * innerH;

  // Paths
  const linePath = closes
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ');

  const fillPath = closes.length > 1
    ? linePath
      + ` L${toX(closes.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)}`
      + ` L${PAD.left.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`
    : '';

  // Y axis: 4 horizontal guides
  const yGuides = [0, 0.33, 0.66, 1].map(pct => ({
    y: PAD.top + pct * innerH,
    val: (max - pct * priceRange).toFixed(2),
  }));

  // X axis: first / mid / last
  const xGuides = history.length > 1
    ? [0, Math.floor((history.length - 1) / 2), history.length - 1].map(idx => ({
        x: toX(idx),
        label: fmtLabel(history[idx].t, range),
        anchor: idx === 0 ? 'start' : idx === history.length - 1 ? 'end' : 'middle',
      }))
    : [];

  // Cursor values
  const cursorX = activeIdx !== null ? toX(activeIdx) : null;
  const cursorY = activeIdx !== null ? toY(closes[activeIdx]) : null;

  // PanResponder
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => activate(e.nativeEvent.locationX),
    onPanResponderMove: (e) => activate(e.nativeEvent.locationX),
    onPanResponderRelease: () => setActiveIdx(null),
    onPanResponderTerminate: () => setActiveIdx(null),
  }), [closes.length, innerW]);

  function activate(rawX: number) {
    const x = rawX - PAD.left;
    const idx = Math.round((x / innerW) * (closes.length - 1));
    setActiveIdx(Math.max(0, Math.min(idx, closes.length - 1)));
  }

  // What to show in the tooltip
  const displayPrice = activeIdx !== null ? closes[activeIdx] : currentPrice;
  const displayDate  = activeIdx !== null ? fmtFull(history[activeIdx].t, range) : 'Precio actual';
  const tooltipColor = activeIdx !== null ? color : '#fff';

  if (closes.length < 2) {
    return (
      <View style={[styles.wrapper, styles.empty]}>
        <Text style={styles.emptyText}>Sin datos para este rango</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* ── Tooltip fijo arriba ── */}
      <View style={styles.tooltip}>
        <Text style={[styles.tooltipPrice, { color: tooltipColor }]}>
          {currency} {displayPrice.toFixed(2)}
        </Text>
        <Text style={styles.tooltipDate}>{displayDate}</Text>
      </View>

      {/* ── SVG ── */}
      <View style={styles.svgWrapper}>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.22" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Y guides + labels */}
          {yGuides.map((g, i) => (
            <React.Fragment key={i}>
              <Line
                x1={PAD.left} y1={g.y}
                x2={W - PAD.right} y2={g.y}
                stroke="#1a3050" strokeWidth="1" strokeDasharray="4,3"
              />
              <SvgText
                x={PAD.left - 6} y={g.y + 4}
                fontSize="9" fill="#3a5a70" textAnchor="end"
              >
                {g.val}
              </SvgText>
            </React.Fragment>
          ))}

          {/* X axis labels */}
          {xGuides.map((g, i) => (
            <SvgText
              key={i}
              x={g.x} y={H - 6}
              fontSize="9" fill="#3a5a70"
              textAnchor={g.anchor as 'start' | 'middle' | 'end'}
            >
              {g.label}
            </SvgText>
          ))}

          {/* Gradient fill */}
          <Path d={fillPath} fill="url(#grad)" />

          {/* Price line */}
          <Path
            d={linePath}
            stroke={color} strokeWidth="2"
            fill="none" strokeLinejoin="round" strokeLinecap="round"
          />

          {/* Cursor */}
          {cursorX !== null && cursorY !== null && (
            <>
              <Line
                x1={cursorX} y1={PAD.top}
                x2={cursorX} y2={PAD.top + innerH}
                stroke={color} strokeWidth="1"
                strokeDasharray="4,3" strokeOpacity="0.7"
              />
              <Circle cx={cursorX} cy={cursorY} r="9" fill={color} fillOpacity="0.15" />
              <Circle cx={cursorX} cy={cursorY} r="4.5" fill={color} />
            </>
          )}
        </Svg>

        {/* Touch capture overlay — encima del SVG */}
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      </View>

      {/* Loading overlay cuando cambia el rango */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#00ADD8" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  empty: {
    height: H + 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: '#4a6a80', fontSize: 13 },
  tooltip: {
    paddingHorizontal: PAD.left,
    paddingBottom: 6,
    minHeight: 48,
    justifyContent: 'flex-end',
  },
  tooltipPrice: {
    fontSize: 22,
    fontWeight: '700',
  },
  tooltipDate: {
    fontSize: 11,
    color: '#4a6a80',
    marginTop: 2,
  },
  svgWrapper: {
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d1e3088',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
});
