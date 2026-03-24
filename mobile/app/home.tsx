import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) { router.replace('/login'); return; }

      const response = await fetch(`${API_URL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setUser(await response.json());
      } else {
        setError('No se pudo cargar el perfil');
      }
    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token || !user) return;

    const response = await fetch(`${API_URL}/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (response.status === 204) {
      await AsyncStorage.removeItem('userToken');
      router.replace('/login');
    } else {
      setError('No se pudo eliminar la cuenta');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    router.replace('/login');
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.first_name?.[0]}{user?.last_name?.[0]}</Text>
        </View>
        <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={styles.btnEdit} onPress={() => router.push('/edit-profile')}>
        <Text style={styles.btnText}>Editar perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
        <Text style={styles.btnText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnDelete} onPress={handleDelete}>
        <Text style={styles.btnText}>Eliminar cuenta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 20, justifyContent: 'center' },
  error: { color: '#ff4444', textAlign: 'center', marginBottom: 10 },
  profileCard: { backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#00ADD8', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  email: { color: '#777', marginTop: 4 },
  btnEdit: { backgroundColor: '#00ADD8', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnLogout: { backgroundColor: '#888', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnDelete: { backgroundColor: '#ff4444', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
