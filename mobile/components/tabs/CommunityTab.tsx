import React, { useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, Animated, ScrollView,
    RefreshControl, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Community {
    id: string;
    name: string;
    description: string;
    rules: string;
    topics: string[];
    logo_url: string;
    is_private: boolean;
    creation_date: string;
    member_count: number;
    post_count: number;
}

type TabView = 'my_communities' | 'search';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authFetch(url: string, opts: RequestInit = {}) {
    const token = await getValidToken();
    return fetch(url, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(opts.headers ?? {}),
        },
    });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopicPill({ topic }: { topic: string }) {
    return (
        <View style={s.topicPill}>
            <Text style={s.topicPillText}>#{topic}</Text>
        </View>
    );
}

function CommunityCard({ item, onPress }: { item: Community; onPress: () => void }) {
    const scale = React.useRef(new Animated.Value(1)).current;
    const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
    const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
                style={s.card}
                onPress={onPress}
                onPressIn={onIn}
                onPressOut={onOut}
                activeOpacity={1}
            >
                <View style={s.cardAvatar}>
                    <Text style={s.cardAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>

                <View style={s.cardBody}>
                    <View style={s.cardHeader}>
                        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                        <View style={s.cardMeta}>
                            {item.is_private && (
                                <MaterialIcons name="lock" size={13} color="#e05c5c" style={{ marginRight: 4 }} />
                            )}
                            <MaterialIcons name="people" size={13} color="#00b4d8" />
                            <Text style={s.cardMetaText}>{item.member_count.toLocaleString()}</Text>
                        </View>
                    </View>

                    <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>

                    {item.topics?.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ marginTop: 8 }}
                        >
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                {item.topics.slice(0, 5).map(t => <TopicPill key={t} topic={t} />)}
                            </View>
                        </ScrollView>
                    )}
                </View>

                <MaterialIcons name="chevron-right" size={22} color="#3d5a70" />
            </TouchableOpacity>
        </Animated.View>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommunityTab() {
    const router = useRouter();
    const [view, setView] = useState<TabView>('my_communities');

    // Mis comunidades
    const [myCommunities, setMyCommunities] = useState<Community[]>([]);
    const [loadingMine, setLoadingMine] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Búsqueda
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Community[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const fetchMyCommunities = async () => {
        setLoadingMine(true);
        try {
            const res = await authFetch(`${API_URL}/communities/me`);
            if (res.ok) setMyCommunities(await res.json() ?? []);
        } catch (e) {
            console.error('Error fetching communities:', e);
        } finally {
            setLoadingMine(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchMyCommunities();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMyCommunities();
        setRefreshing(false);
    };

    const search = useCallback(async () => {
        const q = query.trim();
        if (!q) return;
        setSearching(true);
        setSearchError('');
        setHasSearched(true);
        try {
            const res = await authFetch(`${API_URL}/communities/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                setResults(await res.json() ?? []);
            } else {
                setSearchError('Error al buscar comunidades');
                setResults([]);
            }
        } catch {
            setSearchError('Sin conexión al servidor');
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, [query]);

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setSearchError('');
        setHasSearched(false);
    };

    const goToDetail = (community: Community) => {
        router.push({
            pathname: '/community-detail',
            params: {
                id: community.id,
                name: community.name,
                description: community.description,
                rules: community.rules,
                topics: JSON.stringify(community.topics ?? []),
                is_private: community.is_private ? '1' : '0',
                member_count: String(community.member_count),
                post_count: String(community.post_count),
            },
        });
    };

    return (
        <View style={s.root}>
            {/* Toggle */}
            <View style={s.toggle}>
                {(['my_communities', 'search'] as TabView[]).map(t => (
                    <TouchableOpacity
                        key={t}
                        style={[s.toggleBtn, view === t && s.toggleBtnActive]}
                        onPress={() => setView(t)}
                    >
                        <MaterialIcons
                            name={t === 'search' ? 'explore' : 'group'}
                            size={16}
                            color={view === t ? '#00b4d8' : '#3d5a70'}
                        />
                        <Text style={[s.toggleBtnText, view === t && s.toggleBtnTextActive]}>
                            {t === 'search' ? 'Explorar' : 'Mis Comunidades'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Vista: Mis Comunidades ── */}
            {view === 'my_communities' && (
                <>
                    {loadingMine ? (
                        <ActivityIndicator color="#00b4d8" style={{ marginTop: 40 }} size="large" />
                    ) : (
                        <FlatList
                            data={myCommunities}
                            keyExtractor={i => i.id}
                            renderItem={({ item }) => (
                                <CommunityCard item={item} onPress={() => goToDetail(item)} />
                            )}
                            contentContainerStyle={s.list}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#00b4d8"
                                />
                            }
                            ListEmptyComponent={
                                <View style={s.emptyBox}>
                                    <MaterialIcons name="group-add" size={52} color="#1e3a5a" />
                                    <Text style={s.emptyTitle}>Sin comunidades aún</Text>
                                    <Text style={s.emptyText}>
                                        Explorá y unite a comunidades, o creá la tuya
                                    </Text>
                                </View>
                            }
                        />
                    )}

                    <TouchableOpacity
                        style={s.createBtn}
                        onPress={() => router.push('/create-community')}
                    >
                        <MaterialIcons name="add" size={22} color="#fff" />
                        <Text style={s.createBtnText}>Crear Comunidad</Text>
                    </TouchableOpacity>
                </>
            )}

            {/* ── Vista: Explorar / Buscar ── */}
            {view === 'search' && (
                <>
                    <View style={s.searchWrapper}>
                        <View style={s.searchBar}>
                            <MaterialIcons name="search" size={18} color="#3d5a70" style={{ marginRight: 8 }} />
                            <TextInput
                                style={s.searchInput}
                                placeholder="Crypto, acciones, noticias..."
                                placeholderTextColor="#3d5a70"
                                value={query}
                                onChangeText={setQuery}
                                onSubmitEditing={search}
                                returnKeyType="search"
                                autoCorrect={false}
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={clearSearch}>
                                    <MaterialIcons name="close" size={17} color="#3d5a70" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[s.searchBtn, !query.trim() && s.searchBtnDisabled]}
                            onPress={search}
                            disabled={searching || !query.trim()}
                        >
                            {searching
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={s.searchBtnText}>Buscar</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    {searchError ? (
                        <View style={s.errorRow}>
                            <MaterialIcons name="error-outline" size={14} color="#e05c5c" />
                            <Text style={s.errorText}>{searchError}</Text>
                        </View>
                    ) : null}

                    {searching ? (
                        <ActivityIndicator color="#00b4d8" style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={i => i.id}
                            renderItem={({ item }) => (
                                <CommunityCard item={item} onPress={() => goToDetail(item)} />
                            )}
                            contentContainerStyle={s.list}
                            ListEmptyComponent={
                                hasSearched && !searchError ? (
                                    <View style={s.emptyBox}>
                                        <MaterialIcons name="search-off" size={48} color="#1e3a5a" />
                                        <Text style={s.emptyText}>
                                            Sin resultados para "{query.trim()}"
                                        </Text>
                                    </View>
                                ) : !hasSearched ? (
                                    <View style={s.emptyBox}>
                                        <MaterialIcons name="explore" size={52} color="#1e3a5a" />
                                        <Text style={s.emptyTitle}>Explorá comunidades</Text>
                                        <Text style={s.emptyText}>
                                            Buscá por nombre, descripción o tema
                                        </Text>
                                    </View>
                                ) : null
                            }
                        />
                    )}
                </>
            )}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#080f1a' },

    toggle: {
        flexDirection: 'row',
        margin: 16,
        marginBottom: 8,
        backgroundColor: '#0d1826',
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: '#1a2d42',
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    toggleBtnActive: { backgroundColor: '#111e2e' },
    toggleBtnText: { color: '#3d5a70', fontSize: 14, fontWeight: '600' },
    toggleBtnTextActive: { color: '#e8f4f8' },

    searchWrapper: { paddingHorizontal: 16, gap: 10, marginBottom: 4 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111e2e',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1a2d42',
        paddingHorizontal: 14,
        height: 48,
    },
    searchInput: { flex: 1, color: '#e8f4f8', fontSize: 15 },
    searchBtn: {
        backgroundColor: '#00b4d8',
        borderRadius: 12,
        paddingVertical: 13,
        alignItems: 'center',
        shadowColor: '#00b4d8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    searchBtnDisabled: { backgroundColor: '#0d1826', shadowOpacity: 0 },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginHorizontal: 16,
        marginTop: 6,
    },
    errorText: { color: '#e05c5c', fontSize: 13 },

    list: { padding: 12, paddingBottom: 24, gap: 10 },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111e2e',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1a2d42',
        gap: 12,
    },
    cardAvatar: {
        width: 46,
        height: 46,
        borderRadius: 13,
        backgroundColor: '#0a2a40',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1a2d42',
    },
    cardAvatarText: { color: '#00b4d8', fontSize: 20, fontWeight: '700' },
    cardBody: { flex: 1 },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    cardName: { color: '#e8f4f8', fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardMetaText: { color: '#00b4d8', fontSize: 12, fontWeight: '600' },
    cardDesc: { color: '#7a9ab0', fontSize: 13, lineHeight: 18 },

    topicPill: {
        backgroundColor: '#0a2030',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a2d42',
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    topicPillText: { color: '#7a9ab0', fontSize: 11, fontWeight: '500' },

    emptyBox: {
        alignItems: 'center',
        marginTop: 60,
        gap: 10,
        paddingHorizontal: 40,
    },
    emptyTitle: { color: '#4a6a80', fontSize: 17, fontWeight: '700' },
    emptyText: { color: '#3d5a70', textAlign: 'center', fontSize: 14, lineHeight: 20 },

    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00b4d8',
        margin: 16,
        paddingVertical: 15,
        borderRadius: 14,
        gap: 8,
        shadowColor: '#00b4d8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});