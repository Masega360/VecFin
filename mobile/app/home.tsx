import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

interface User {
  first_name: string;
  last_name: string;
  email: string;
}

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/');
        return;
      }

      // En un caso real, el ID vendría dentro del Token o lo sabría el Backend.
      // Por ahora, como es para probar el perfil, pedimos el usuario 1 o el que creaste.
      const response = await fetch(`${API_URL}/users/1`, { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`, // <-- ACÁ MANDAMOS EL PERMISO
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        Alert.alert("Error", "No se pudo cargar el perfil");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    router.replace('/');
  };

  if (loading) return <ActivityIndicator size="large" style={{flex: 1}} />;

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
           <Text style={styles.avatarText}>{user?.first_name?.[0]}{user?.last_name?.[0]}</Text>
        </View>
        <Text style={styles.welcome}>¡Hola, {user?.first_name}!</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Estado de Cuenta</Text>
        <Text>Plan: Developer Free</Text>
        <Text>Seguridad: JWT Activo</Text>
      </View>

      <Button title="Cerrar Sesión" color="#ff4444" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 20, justifyContent: 'center' },
  profileCard: { backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#00ADD8', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  welcome: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  email: { color: '#777', marginBottom: 10 },
  infoBox: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 30 },
  infoTitle: { fontWeight: 'bold', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }
});