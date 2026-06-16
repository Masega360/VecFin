import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_URL, getValidToken } from '@/utils/api';

interface RankEntry {
  rank: number;
  user_id: string;
  first_name: string;
  last_name: string;
  value: number;
  label: string;
}

type Category = 'portfolio' | 'diversified' | 'active';

const CATEGORIES: { id: Category; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'portfolio', label: 'Top Holdings', icon: 'account-balance' },
  { id: 'diversified', label: 'Más Diversificados', icon: 'pie-chart' },
  { id: 'active', label: 'Más Activos', icon: 'flash-on' },
];

export default function LeaderboardTab() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>('portfolio');
  const [data, setData] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [category]);

  const load = async () => {
    setLoading(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/leaderboard/${category}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json() || []);
      else setData([]);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  const medalColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#4a6a80';
  };

  return (
    <View style={styles.root}>
      {/* Category selector */}
      <View style={styles.catRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.catBtn, category === c.id && styles.catBtnActive]}
            onPress={() => setCategory(c.id)}
          >
            <MaterialIcons name={c.icon} size={16} color={category === c.id ? '#00ADD8' : '#4a6a80'} />
            <Text style={[styles.catText, category === c.id && styles.catTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? <ActivityIndicator color="#00ADD8" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={data}
          keyExtractor={item => item.user_id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/user-profile', params: { userId: item.user_id } })} activeOpacity={0.7}>
              <Text style={[styles.rank, { color: medalColor(item.rank) }]}>
                {item.rank <= 3 ? '🏆' : `#${item.rank}`}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                <Text style={styles.label}>{Math.round(item.value)} {item.label}</Text>
              </View>
              {item.rank <= 3 && (
                <Text style={[styles.medal, { color: medalColor(item.rank) }]}>
                  {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                </Text>
              )}
              <MaterialIcons name="chevron-right" size={20} color="#3d5a70" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin datos aún</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628', paddingTop: Platform.OS === 'android' ? 8 : 0 },
  catRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: '#132238' },
  catBtnActive: { backgroundColor: '#00ADD820', borderWidth: 1, borderColor: '#00ADD8' },
  catText: { fontSize: 11, fontWeight: '600', color: '#4a6a80' },
  catTextActive: { color: '#00ADD8' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1f35', borderRadius: 10, padding: 14, marginBottom: 8, gap: 12 },
  rank: { fontSize: 18, fontWeight: '800', width: 36, textAlign: 'center' },
  name: { color: '#e0e0e0', fontSize: 15, fontWeight: '600' },
  label: { color: '#4a6a80', fontSize: 12, marginTop: 2 },
  medal: { fontSize: 22 },
  empty: { color: '#4a6a80', textAlign: 'center', marginTop: 40 },
});
