import React, { useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface Community {
    id: string;
    name: string;
    description: string;
    member_count: number;
    is_private: boolean;
    topics: string[];
}

export default function CommunityTab() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Community[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [view, setView] = useState<'search' | 'my_communities'>('search');

    // TODO: Implementar fetch de "Mis Comunidades" cuando el backend tenga el endpoint
    const [myCommunities, setMyCommunities] = useState<Community[]>([]);

    const search = useCallback(async () => {
        const q = query.trim();
        if (!q) return;
        setSearching(true);
        setSearchError('');
        try {
            const res = await fetch(`${API_URL}/communities/search?q=${encodeURIComponent(q)}`);
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

    const goToDetail = (id: string, name: string) => {
        router.push({ pathname: '/community-detail', params: { id, name } });
    };

    const renderCommunity = ({ item }: { item: Community }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => goToDetail(item.id, item.name)}
            activeOpacity={0.7}
        >
            <View style={styles.cardInfo}>
                <View style={styles.headerRow}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.is_private && (
                        <MaterialIcons name="lock" size={14} color="#ff6666" style={{ marginLeft: 6 }} />
                    )}
                </View>
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

                <View style={styles.footerRow}>
                    <View style={styles.memberBadge}>
                        <MaterialIcons name="people" size={14} color="#00ADD8" />
                        <Text style={styles.memberCount}>{item.member_count} miembros</Text>
                    </View>
                    {item.topics && item.topics.length > 0 && (
                        <Text style={styles.topic}>#{item.topics[0]}</Text>
                    )}
                </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#4a6a80" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.toggle}>
                <TouchableOpacity
                    style={[styles.toggleBtn, view === 'search' && styles.toggleActive]}
                    onPress={() => setView('search')}
                >
                    <MaterialIcons name="explore" size={16} color={view === 'search' ? '#00ADD8' : '#4a6a80'} />
                    <Text style={[styles.toggleText, view === 'search' && styles.toggleTextActive]}>Explorar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, view === 'my_communities' && styles.toggleActive]}
                    onPress={() => setView('my_communities')}
                >
                    <MaterialIcons name="group" size={16} color={view === 'my_communities' ? '#00ADD8' : '#4a6a80'} />
                    <Text style={[styles.toggleText, view === 'my_communities' && styles.toggleTextActive]}>
                        Mis Comunidades
                    </Text>
                </TouchableOpacity>
            </View>

            {view === 'search' ? (
                <>
                    <View style={styles.searchBar}>
                        <MaterialIcons name="search" size={20} color="#4a6a80" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Ej: Crypto, Acciones, Noticias..."
                            placeholderTextColor="#4a6a80"
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={search}
                            returnKeyType="search"
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
                        keyExtractor={item => item.id}
                        renderItem={renderCommunity}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            !searching && query.trim().length > 0 && !searchError
                                ? <Text style={styles.emptyText}>Sin resultados para "{query.trim()}"</Text>
                                : null
                        }
                    />
                </>
            ) : (
                <View style={styles.myCommunitiesContainer}>
                    <FlatList
                        data={myCommunities}
                        keyExtractor={item => item.id}
                        renderItem={renderCommunity}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.emptyFavs}>
                                <MaterialIcons name="group-add" size={56} color="#1e3a5a" />
                                <Text style={styles.emptyText}>Todavía no perteneces a ninguna comunidad</Text>
                            </View>
                        }
                    />

                    <TouchableOpacity
                        style={styles.createBtn}
                        onPress={() => router.push('/create-community')}
                    >
                        <MaterialIcons name="add" size={24} color="#fff" />
                        <Text style={styles.createBtnText}>Crear Comunidad</Text>
                    </TouchableOpacity>
                </View>
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
    toggleActive: { backgroundColor: '#132238' },
    toggleText: { color: '#4a6a80', fontSize: 14, fontWeight: '600' },
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
    errorText: { color: '#ff6666', fontSize: 13 },
    list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#132238', borderRadius: 14,
        padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: '#1e3a5a',
    },
    cardInfo: { flex: 1, marginRight: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    name: { color: '#fff', fontWeight: '700', fontSize: 16 },
    description: { color: '#8aaabf', fontSize: 13, lineHeight: 18, marginBottom: 8 },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    memberCount: { color: '#00ADD8', fontSize: 12, fontWeight: '600' },
    topic: { color: '#4a6a80', fontSize: 12, fontStyle: 'italic' },
    emptyText: { color: '#4a6a80', textAlign: 'center', marginTop: 20 },
    emptyFavs: { alignItems: 'center', marginTop: 60, gap: 12 },

    // Nuevos estilos añadidos
    myCommunitiesContainer: {
        flex: 1,
        position: 'relative',
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00ADD8',
        margin: 16,
        paddingVertical: 16,
        borderRadius: 14,
        shadowColor: '#00ADD8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        gap: 8,
    },
    createBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    }
});