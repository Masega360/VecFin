import React, { useEffect, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet,
  Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { MaterialIcons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
const GOOGLE_CLIENT_ID = '1041823470474-j3l8qlq348e8c3ceoql92d3um9sfl38s.apps.googleusercontent.com';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
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
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header with illustration on the right */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <MaterialIcons name="arrow-back" size={20} color="#8aaabf" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bienvenido</Text>
          <Text style={styles.headerSubtitle}>Iniciá sesión para continuar</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.illustrationBox}>
            <MaterialIcons name="account-balance" size={44} color="#00ADD8" />
            <View style={styles.dot1} />
            <View style={styles.dot2} />
            <View style={styles.dot3} />
          </View>
        </View>
      </View>

      {/* Form */}
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color="#ff4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputWrapper}>
          <MaterialIcons name="email" size={20} color="#00ADD8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aab8c8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="lock" size={20} color="#00ADD8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#aab8c8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#aab8c8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin}>
          <Text style={styles.btnText}>Entrar</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.btnGoogle} disabled={!request} onPress={() => promptAsync()}>
          <MaterialIcons name="language" size={20} color="#fff" />
          <Text style={styles.btnText}>Continuar con Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/register')}>
          <MaterialIcons name="person-add" size={20} color="#fff" />
          <Text style={styles.btnText}>Crear cuenta nueva</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  headerLeft: {
    flex: 1,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8aaabf',
  },
  headerRight: {
    marginLeft: 16,
  },
  illustrationBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#132238',
    borderWidth: 1,
    borderColor: '#1e3a5a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dot1: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ADD8',
    opacity: 0.8,
  },
  dot2: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    opacity: 0.7,
  },
  dot3: {
    position: 'absolute',
    top: 12,
    left: 10,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF9800',
    opacity: 0.6,
  },
  form: {
    flexGrow: 1,
    backgroundColor: '#f4f7fb',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 48,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff0f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ffd0d0',
  },
  errorText: {
    color: '#cc2222',
    fontSize: 13,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0eaf4',
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1a2e4a',
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  btnPrimary: {
    backgroundColor: '#00ADD8',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
    shadowColor: '#00ADD8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dce8f0',
  },
  dividerText: {
    color: '#aab8c8',
    fontSize: 13,
  },
  btnGoogle: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnSecondary: {
    backgroundColor: '#FF9800',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
