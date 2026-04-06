import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  risk_type: string;
}

export default function ProfileTab() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) { router.replace('/login'); return; }

      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setError('No se pudo cargar el perfil');
      }
    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    router.replace('/login');
  };

  const handleDelete = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token || !user) return;
    const res = await fetch(`${API_URL}/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) {
      await AsyncStorage.removeItem('userToken');
      router.replace('/login');
    } else {
      setError('No se pudo eliminar la cuenta');
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#00ADD8" style={styles.loader} />;

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={16} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </Text>
        </View>
        <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.risk_type ? (
          <View style={styles.riskBadge}>
            <Text style={styles.riskText}>{user.risk_type}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={styles.btnEdit} onPress={() => router.push('/edit-profile')}>
        <MaterialIcons name="edit" size={18} color="#fff" />
        <Text style={styles.btnText}>Editar perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
        <MaterialIcons name="logout" size={18} color="#fff" />
        <Text style={styles.btnText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnDelete} onPress={handleDelete}>
        <MaterialIcons name="delete-outline" size={18} color="#fff" />
        <Text style={styles.btnText}>Eliminar cuenta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, marginTop: 60 },
  container: { flex: 1, padding: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff0f0', borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#ffd0d0',
  },
  errorText: { color: '#cc2222', fontSize: 13, flex: 1 },
  card: {
    backgroundColor: '#132238', borderRadius: 20, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: '#1e3a5a',
    marginBottom: 20,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#00ADD820', borderWidth: 2, borderColor: '#00ADD8',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarText: { color: '#00ADD8', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  email: { color: '#8aaabf', fontSize: 14 },
  riskBadge: {
    marginTop: 10, backgroundColor: '#00ADD815',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: '#00ADD830',
  },
  riskText: { color: '#00ADD8', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  btnEdit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ADD8', padding: 15, borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#00ADD8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  btnLogout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1e3a5a', padding: 15, borderRadius: 14, marginBottom: 10,
  },
  btnDelete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3a1a1a', padding: 15, borderRadius: 14,
    borderWidth: 1, borderColor: '#5a2222',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
