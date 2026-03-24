import React, { useEffect, useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
const GOOGLE_CLIENT_ID = '1041823470474-j3l8qlq348e8c3ceoql92d3um9sfl38s.apps.googleusercontent.com';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleToken(id_token);
    } else if (response?.type === 'error') {
      setError('Error al iniciar sesión con Google');
    }
  }, [response]);

  const handleGoogleToken = async (idToken: string) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await AsyncStorage.setItem('userToken', data.token);
        router.replace('/home');
      } else {
        setError(data.error || 'Error al iniciar sesión con Google');
      }
    } catch {
      setError('Sin conexión al servidor');
    }
  };

  const handleLogin = async () => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        await AsyncStorage.setItem('userToken', data.token);
        router.replace('/home');
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Sin conexión al servidor');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VecFin 💰</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin}>
        <Text style={styles.btnText}>Entrar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnGoogle} disabled={!request} onPress={() => promptAsync()}>
        <Text style={styles.btnText}>Continuar con Google</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/register')}>
        <Text style={styles.btnText}>Crear cuenta nueva</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { height: 50, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8 },
  error: { color: '#ff4444', textAlign: 'center', marginBottom: 10 },
  btnPrimary: { backgroundColor: '#00ADD8', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnGoogle: { backgroundColor: '#4285F4', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnSecondary: { backgroundColor: '#f90', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
