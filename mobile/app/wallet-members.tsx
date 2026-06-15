import React, { useEffect, useState } from 'react';
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
}

export default function WalletMembersScreen() {
  const { walletId, walletName } = useLocalSearchParams<{ walletId: string; walletName: string }>();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // add form
  const [showAdd, setShowAdd] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [submitting, setSubmitting] = useState(false);

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

  const addMember = async () => {
    if (!userId.trim()) return;
    setSubmitting(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId.trim(), role }),
      });
      if (res.ok || res.status === 201) {
        setUserId('');
        setShowAdd(false);
        loadMembers();
      } else {
        const txt = await res.text();
        Alert.alert('Error', txt || 'No se pudo agregar');
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

      {/* Add form */}
      {showAdd && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="User ID del miembro"
            placeholderTextColor="#4a6a80"
            value={userId}
            onChangeText={setUserId}
          />
          <View style={styles.roleRow}>
            {(['admin', 'viewer'] as const).map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.submitBtn} onPress={addMember} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> :
              <Text style={styles.submitText}>Agregar</Text>}
          </TouchableOpacity>
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
              <View style={styles.memberCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberId} numberOfLines={1}>{item.user_id}</Text>
                  <Text style={[styles.memberRole, { color: roleColor(item.role) }]}>
                    {item.role.toUpperCase()}
                  </Text>
                </View>
                {item.role !== 'owner' && (
                  <TouchableOpacity onPress={() => removeMember(item.user_id)}>
                    <MaterialIcons name="remove-circle" size={22} color="#e74c3c" />
                  </TouchableOpacity>
                )}
              </View>
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
  addForm: { padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#132238' },
  input: { backgroundColor: '#132238', color: '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 14 },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#132238' },
  roleBtnActive: { backgroundColor: '#00ADD8' },
  roleBtnText: { color: '#4a6a80', fontWeight: '600' },
  roleBtnTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#00ADD8', borderRadius: 8, padding: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1f35', borderRadius: 10, padding: 14, marginBottom: 10 },
  memberId: { color: '#c0c0c0', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  memberRole: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  empty: { color: '#4a6a80', textAlign: 'center', marginTop: 40 },
  error: { color: '#e74c3c', textAlign: 'center', marginTop: 40 },
});
