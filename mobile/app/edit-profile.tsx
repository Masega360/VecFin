import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function EditProfileScreen() {
  const [id, setId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) { router.replace('/'); return; }

      const response = await fetch(`${API_URL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setId(data.id);
        setFirstName(data.first_name);
        setLastName(data.last_name);
        setEmail(data.email);
      } else {
        setError('No se pudo cargar el perfil');
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;

    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
    });

    if (response.ok) {
      setSuccess('Perfil actualizado correctamente');
    } else {
      setError('No se pudo actualizar el perfil');
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Editar Perfil</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TextInput style={styles.input} placeholder="Nombre" value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder="Apellido" value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />

      <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
        <Text style={styles.btnText}>Guardar cambios</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnBack} onPress={() => router.back()}>
        <Text style={styles.btnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f0f2f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  error: { color: '#ff4444', textAlign: 'center', marginBottom: 10 },
  success: { color: '#00aa55', textAlign: 'center', marginBottom: 10 },
  input: { backgroundColor: '#fff', height: 50, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8 },
  btnSave: { backgroundColor: '#00ADD8', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnBack: { backgroundColor: '#888', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
