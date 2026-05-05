import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface Asset {
  symbol: string;
  name: string;
  type: string;
}

interface FavAsset {
  id: number;
  asset_id: string;
  created_at: string;
}

export default function AssetsTab() {
  const router = useRouter();
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<Asset[]>([]);
  const [favorites,   setFavorites]   = useState<FavAsset[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');
  const [view,        setView]        = useState<'search' | 'favorites'>('search');

  useEffect(() => { loadFavorites(); }, []);

  const loadFavorites = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/assets/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setFavorites(await res.json() ?? []);
    } catch {
      // favoritos no críticos, no bloquear la UI
    }
  };

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`${API_URL}/assets/search?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        setResults(await res.json() ?? []);
      } else {
        setSearchError('Error al buscar activos');
        setResults([]);
      }
    } catch {
      setSearchError('Sin conexión al servidor');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const addFavorite = async (symbol: string) => {
    const token = await getValidToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/assets/favorites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: symbol }),
      });
      loadFavorites();
    } catch {}
  };

  const removeFavorite = async (symbol: string) => {
    const token = await getValidToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/assets/favorites/${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadFavorites();
    } catch {}
  };

  const isFav = (symbol: string) => favorites.some(f => f.asset_id === symbol);

  const goToDetail = (symbol: string, name: string) => {
    router.push({ pathname: '/asset-detail', params: { symbol, name, from: 'assets' } });
  };

  const renderAsset = ({ item }: { item: Asset }) => (
    <TouchableOpacity style={styles.assetRow} onPress={() => goToDetail(item.symbol, item.name)} activeOpacity={0.7}>
      <View style={styles.assetInfo}>
        <Text style={styles.symbol}>{item.symbol}</Text>
        <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.assetType}>{item.type}</Text>
      </View>
      <TouchableOpacity
        style={[styles.favBtn, isFav(item.symbol) && styles.favBtnActive]}
        onPress={() => isFav(item.symbol) ? removeFavorite(item.symbol) : addFavorite(item.symbol)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons
          name={isFav(item.symbol) ? 'star' : 'star-border'}
          size={22}
          color={isFav(item.symbol) ? '#FFB300' : '#4a6a80'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFav = ({ item }: { item: FavAsset }) => (
    <TouchableOpacity style={styles.assetRow} onPress={() => goToDetail(item.asset_id, item.asset_id)} activeOpacity={0.7}>
      <View style={styles.assetInfo}>
        <Text style={styles.symbol}>{item.asset_id}</Text>
      </View>
      <TouchableOpacity
        style={styles.favBtn}
        onPress={() => removeFavorite(item.asset_id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons name="star" size={22} color="#FFB300" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'search' && styles.toggleActive]}
          onPress={() => setView('search')}
        >
          <MaterialIcons name="search" size={16} color={view === 'search' ? '#00ADD8' : '#4a6a80'} />
          <Text style={[styles.toggleText, view === 'search' && styles.toggleTextActive]}>Buscar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'favorites' && styles.toggleActive]}
          onPress={() => { setView('favorites'); loadFavorites(); }}
        >
          <MaterialIcons name="star" size={16} color={view === 'favorites' ? '#FFB300' : '#4a6a80'} />
          <Text style={[styles.toggleText, view === 'favorites' && styles.toggleTextActive]}>
            Favoritos{favorites.length > 0 ? ` (${favorites.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {view === 'search' ? (
        <>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color="#4a6a80" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ej: AAPL, Tesla, BTC..."
              placeholderTextColor="#4a6a80"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              returnKeyType="search"
              autoCapitalize="characters"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearchError(''); }}>
                <MaterialIcons name="close" size={18} color="#4a6a80" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.searchBtn} onPress={search} disabled={searching}>
            {searching
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchBtnText}>Buscar</Text>
            }
          </TouchableOpacity>

          {searchError ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={14} color="#ff6666" />
              <Text style={styles.errorText}>{searchError}</Text>
            </View>
          ) : null}

          <FlatList
            data={results}
            keyExtractor={item => item.symbol}
            renderItem={renderAsset}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              !searching && query.trim().length > 0 && !searchError
                ? <Text style={styles.emptyText}>Sin resultados para "{query.trim()}"</Text>
                : null
            }
          />
        </>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => String(item.id)}
          renderItem={renderFav}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyFavs}>
              <MaterialIcons name="star-border" size={48} color="#1e3a5a" />
              <Text style={styles.emptyText}>No tenés favoritos aún</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggle: {
    flexDirection: 'row', margin: 16,
    backgroundColor: '#0d1e30', borderRadius: 12, padding: 4,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10,
  },
  toggleActive:     { backgroundColor: '#132238' },
  toggleText:       { color: '#4a6a80', fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#132238', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e3a5a',
    marginHorizontal: 16, paddingHorizontal: 14, height: 52,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  searchBtn: {
    backgroundColor: '#00ADD8', marginHorizontal: 16, marginTop: 10,
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    shadowColor: '#00ADD8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 8,
  },
  errorText:  { color: '#ff6666', fontSize: 13 },
  list:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  assetRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#132238', borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#1e3a5a',
  },
  assetInfo:  { flex: 1 },
  symbol:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  assetName:  { color: '#8aaabf', fontSize: 13, marginTop: 2 },
  assetType:  { color: '#00ADD8', fontSize: 11, marginTop: 4, textTransform: 'uppercase', fontWeight: '600' },
  favBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0d1e30', justifyContent: 'center', alignItems: 'center',
  },
  favBtnActive: { backgroundColor: '#2a2000' },
  emptyText:  { color: '#4a6a80', textAlign: 'center', marginTop: 20 },
  emptyFavs:  { alignItems: 'center', marginTop: 60, gap: 12 },
});
