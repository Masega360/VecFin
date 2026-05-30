import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, Dimensions, Image, TextInput, Linking,
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

type NewsItem = { title: string; url: string; image_url?: string; source: string; published_at: string };
type Comment = { id: string; author_name: string; content: string; likes: number; user_liked: boolean; replies?: Comment[]; created_at: string };

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
  const [news,         setNews]         = useState<NewsItem[]>([]);
  const [comments,     setComments]     = useState<Comment[]>([]);
  const [commentText,  setCommentText]  = useState('');
  const [posting,      setPosting]      = useState(false);
  const [replyTo,      setReplyTo]      = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { fetchInitial(); checkFav(); fetchNews(); fetchComments(); }, []);
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
        const price = parseFloat(fallbackPrice ?? '0') || 0;
        const currency = fallbackCurrency ?? 'USD';
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

  const fetchNews = async () => {
    try {
      const res = await fetch(`${API_URL}/news?q=${encodeURIComponent(symbol)}`);
      if (res.ok) setNews(await res.json());
    } catch {}
  };

  const fetchComments = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/assets/${encodeURIComponent(symbol)}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setComments(await res.json());
    } catch {}
  };

  const postComment = async () => {
    if (!commentText.trim() || posting) return;
    setPosting(true);
    const token = await getValidToken();
    if (!token) { setPosting(false); return; }
    try {
      const body: any = { content: commentText.trim() };
      if (replyTo) body.parent_id = replyTo.id;
      const res = await fetch(`${API_URL}/assets/${encodeURIComponent(symbol)}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCommentText('');
        setReplyTo(null);
        fetchComments();
      }
    } catch {}
    setPosting(false);
  };

  const toggleLike = async (commentId: string) => {
    const token = await getValidToken();
    if (!token) return;
    await fetch(`${API_URL}/assets/comments/${commentId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchComments();
  };

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
            <Text style={styles.price}>
              {details.price > 0 ? `${details.currency} ${details.price.toFixed(2)}` : 'Sin precio disponible'}
            </Text>
            {details.price > 0 && (
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
            )}
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

          {/* News */}
          {news.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Noticias</Text>
              {news.map((n, i) => (
                <TouchableOpacity key={i} style={styles.newsCard} onPress={() => Linking.openURL(n.url)}>
                  {n.image_url ? <Image source={{ uri: n.image_url }} style={styles.newsImg} /> : null}
                  <View style={styles.newsBody}>
                    <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
                    <Text style={styles.newsMeta}>{n.source}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Comments */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comentarios</Text>
            <View style={styles.commentInput}>
              <View style={{ flex: 1 }}>
                {replyTo && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: '#00ADD8', fontSize: 11 }}>Respondiendo a {replyTo.name}</Text>
                    <TouchableOpacity onPress={() => setReplyTo(null)} style={{ marginLeft: 6 }}>
                      <MaterialIcons name="close" size={14} color="#4a6a80" />
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  style={styles.commentTextInput}
                  placeholder={replyTo ? 'Escribí tu respuesta...' : 'Escribí un comentario...'}
                  placeholderTextColor="#4a6a80"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
              </View>
              <TouchableOpacity onPress={postComment} disabled={posting}>
                <MaterialIcons name="send" size={20} color={posting ? '#2a4a60' : '#00ADD8'} />
              </TouchableOpacity>
            </View>
            {comments.length === 0 ? (
              <Text style={styles.emptyComments}>Sin comentarios aún. ¡Sé el primero!</Text>
            ) : (
              comments.map(c => (
                <View key={c.id}>
                  <View style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{c.author_name}</Text>
                      <Text style={styles.commentDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.commentContent}>{c.content}</Text>
                    <View style={styles.commentActions}>
                      <TouchableOpacity style={styles.commentAction} onPress={() => toggleLike(c.id)}>
                        <MaterialIcons name={c.user_liked ? 'favorite' : 'favorite-border'} size={16} color={c.user_liked ? '#ef4444' : '#4a6a80'} />
                        <Text style={[styles.commentActionText, c.user_liked && { color: '#ef4444' }]}>{c.likes}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.commentAction} onPress={() => setReplyTo({ id: c.id, name: c.author_name })}>
                        <MaterialIcons name="reply" size={16} color="#4a6a80" />
                        <Text style={styles.commentActionText}>Responder</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {c.replies && c.replies.length > 0 && c.replies.map(reply => (
                    <View key={reply.id} style={[styles.commentCard, { marginLeft: 24, borderLeftWidth: 2, borderLeftColor: '#00ADD8' }]}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{reply.author_name}</Text>
                        <Text style={styles.commentDate}>{new Date(reply.created_at).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.commentContent}>{reply.content}</Text>
                      <View style={styles.commentActions}>
                        <TouchableOpacity style={styles.commentAction} onPress={() => toggleLike(reply.id)}>
                          <MaterialIcons name={reply.user_liked ? 'favorite' : 'favorite-border'} size={14} color={reply.user_liked ? '#ef4444' : '#4a6a80'} />
                          <Text style={[styles.commentActionText, reply.user_liked && { color: '#ef4444' }]}>{reply.likes}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
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
  section:   { marginTop: 20 },
  sectionTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  newsCard:  { flexDirection: 'row', backgroundColor: '#132238', borderRadius: 12, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#1e3a5a' },
  newsImg:   { width: 80, height: 70 },
  newsBody:  { flex: 1, padding: 10, justifyContent: 'center', gap: 4 },
  newsTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  newsMeta:  { color: '#4a6a80', fontSize: 11 },
  commentInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#132238', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: '#1e3a5a', gap: 8 },
  commentTextInput: { flex: 1, color: '#e2e8f0', fontSize: 14, maxHeight: 60 },
  emptyComments: { color: '#4a6a80', fontSize: 13, textAlign: 'center', marginTop: 8 },
  commentCard: { backgroundColor: '#132238', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1e3a5a' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { color: '#00ADD8', fontSize: 12, fontWeight: '700' },
  commentDate: { color: '#4a6a80', fontSize: 11 },
  commentContent: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  commentAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { color: '#4a6a80', fontSize: 12 },
});
