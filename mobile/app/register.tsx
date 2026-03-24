import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
      });

      if (response.status === 201) {
        setSuccess('Cuenta creada. Iniciá sesión.');
        setTimeout(() => router.replace('/'), 1500);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'No se pudo crear el usuario');
      }
    } catch {
      setError('Sin conexión al servidor');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrate en VecFin</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <TextInput style={styles.input} placeholder="Nombre" value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder="Apellido" value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister}>
        <Text style={styles.btnText}>Crear Cuenta</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.replace('/')}>
        <Text style={styles.btnText}>Volver al Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f0f2f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#fff', height: 50, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8 },
  error: { color: '#ff4444', textAlign: 'center', marginBottom: 10 },
  success: { color: '#00aa55', textAlign: 'center', marginBottom: 10 },
  btnPrimary: { backgroundColor: '#00ADD8', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnSecondary: { backgroundColor: '#888', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});