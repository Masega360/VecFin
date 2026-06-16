import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface Member {
  wallet_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface UserSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function WalletMembersScreen() {
  const { walletId, walletName } = useLocalSearchParams<{ walletId: string; walletName: string }>();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // add form
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadMembers(); }, []);

  const loadMembers = async () => {
    setLoading(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers(await res.json());
      else setError('Error al cargar miembros');
    } catch { setError('Sin conexión'); }
    finally { setLoading(false); }
  };

  const onSearchChange = (q: string) => {
    setSearchQuery(q);
    setSelectedUser(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const token = await getValidToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(q.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Excluir miembros actuales
          const memberIds = members.map(m => m.user_id);
          setSearchResults((data || []).filter((u: UserSearchResult) => !memberIds.includes(u.id)));
        }
      } catch {}
      finally { setSearching(false); }
    }, 300);
  };

  const pickUser = (u: UserSearchResult) => {
    setSelectedUser(u);
    setSearchQuery(`${u.first_name} ${u.last_name}`);
    setSearchResults([]);
  };

  const addMember = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, role }),
      });
      if (res.ok || res.status === 201) {
        setSelectedUser(null);
        setSearchQuery('');
        setShowAdd(false);
        loadMembers();
      } else {
        Alert.alert('Error', await res.text() || 'No se pudo agregar');
      }
    } catch { Alert.alert('Error', 'Sin conexión'); }
    finally { setSubmitting(false); }
  };

  const removeMember = (targetId: string) => {
    Alert.alert('Remover miembro', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => doRemove(targetId) },
    ]);
  };

  const doRemove = async (targetId: string) => {
    const token = await getValidToken();
    if (!token) return;
    await fetch(`${API_URL}/wallets/${walletId}/members/${targetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadMembers();
  };

  const roleColor = (r: string) => {
    if (r === 'owner') return '#FFD700';
    if (r === 'admin') return '#00ADD8';
    return '#4a6a80';
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#e0e0e0" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Miembros · {walletName}</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
          <MaterialIcons name="person-add" size={24} color="#00ADD8" />
        </TouchableOpacity>
      </View>

      {/* Add form con buscador */}
      {showAdd && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Buscar usuario por nombre o email..."
            placeholderTextColor="#4a6a80"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searching && <ActivityIndicator color="#00ADD8" size="small" />}
          {searchResults.length > 0 && (
            <View style={styles.suggestions}>
              {searchResults.slice(0, 5).map(u => (
                <TouchableOpacity key={u.id} style={styles.suggestionItem} onPress={() => pickUser(u)}>
                  <View style={styles.suggestionAvatar}>
                    <Text style={styles.suggestionAvatarText}>{u.first_name?.[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{u.first_name} {u.last_name}</Text>
                    <Text style={styles.suggestionEmail}>{u.email}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {selectedUser && (
            <>
              <View style={styles.roleRow}>
                {(['admin', 'viewer'] as const).map(r => (
                  <TouchableOpacity key={r} style={[styles.roleBtn, role === r && styles.roleBtnActive]} onPress={() => setRole(r)}>
                    <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={addMember} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> :
                  <Text style={styles.submitText}>Agregar a {selectedUser.first_name}</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* List */}
      {loading ? <ActivityIndicator color="#00ADD8" style={{ marginTop: 40 }} /> :
        error ? <Text style={styles.error}>{error}</Text> :
          <FlatList
            data={members}
            keyExtractor={m => m.user_id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.memberCard}
                onPress={() => router.push({ pathname: '/user-profile', params: { userId: item.user_id } })}
                activeOpacity={0.7}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{item.first_name?.[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{item.first_name} {item.last_name}</Text>
                  <Text style={styles.memberEmail}>{item.email}</Text>
                  <Text style={[styles.memberRole, { color: roleColor(item.role) }]}>{item.role.toUpperCase()}</Text>
                </View>
                {item.role !== 'owner' && (
                  <TouchableOpacity onPress={() => removeMember(item.user_id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialIcons name="remove-circle" size={22} color="#e74c3c" />
                  </TouchableOpacity>
                )}
                <MaterialIcons name="chevron-right" size={20} color="#3d5a70" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Sin miembros</Text>}
          />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628', paddingTop: Platform.OS === 'android' ? 40 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, color: '#e0e0e0', fontSize: 18, fontWeight: '700' },
  addForm: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: '#132238' },
  input: { backgroundColor: '#132238', color: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 14 },
  suggestions: { backgroundColor: '#1a2d45', borderRadius: 8, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#132238' },
  suggestionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a3050', alignItems: 'center', justifyContent: 'center' },
  suggestionAvatarText: { color: '#00ADD8', fontWeight: '700' },
  suggestionName: { color: '#e0e0e0', fontSize: 14, fontWeight: '600' },
  suggestionEmail: { color: '#4a6a80', fontSize: 11 },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#132238' },
  roleBtnActive: { backgroundColor: '#00ADD8' },
  roleBtnText: { color: '#4a6a80', fontWeight: '600' },
  roleBtnTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#00ADD8', borderRadius: 8, padding: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1f35', borderRadius: 10, padding: 14, marginBottom: 10, gap: 10 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a3050', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#00ADD8', fontWeight: '700' },
  memberName: { color: '#e0e0e0', fontSize: 15, fontWeight: '600' },
  memberEmail: { color: '#4a6a80', fontSize: 12, marginTop: 2 },
  memberRole: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  empty: { color: '#4a6a80', textAlign: 'center', marginTop: 40 },
  error: { color: '#e74c3c', textAlign: 'center', marginTop: 40 },
});
