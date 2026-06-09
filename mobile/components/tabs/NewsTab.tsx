import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Image,
  ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '@/utils/api';

type NewsItem = {
  title: string;
  url: string;
  image_url?: string;
  source: string;
  published_at: string;
  tickers?: string[];
};

export default function NewsTab() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/news`);
      if (res.ok) setNews(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#00ADD8" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Noticias Financieras</Text>
        <TouchableOpacity onPress={fetchNews}>
          <MaterialIcons name="refresh" size={22} color="#00ADD8" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={news}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.url)}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
            ) : null}
            <View style={styles.cardContent}>
              <Text style={styles.newsTitle} numberOfLines={3}>{item.title}</Text>
              <View style={styles.meta}>
                {item.source ? <Text style={styles.source}>{item.source}</Text> : null}
                <Text style={styles.date}>
                  {item.published_at ? new Date(item.published_at).toLocaleDateString() : ''}
                </Text>
              </View>
              {item.tickers && item.tickers.length > 0 ? (
                <View style={styles.tickers}>
                  {item.tickers.slice(0, 4).map(t => (
                    <Text key={t} style={styles.ticker}>{t}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#132238' },
  title: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: '#0f2035', borderRadius: 12, borderWidth: 1, borderColor: '#132238', overflow: 'hidden' },
  thumbnail: { width: '100%', height: 160 },
  cardContent: { padding: 14, gap: 6 },
  newsTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  source: { color: '#00ADD8', fontSize: 11, fontWeight: '600' },
  date: { color: '#4a6a80', fontSize: 11 },
  tickers: { flexDirection: 'row', gap: 6, marginTop: 4 },
  ticker: { backgroundColor: '#132238', color: '#00ADD8', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
});
