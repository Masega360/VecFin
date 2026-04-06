import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet,
  Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '@/utils/api';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'Mínimo 8 caracteres',    ok: password.length >= 8 },
    { label: 'Al menos un número',      ok: /[0-9]/.test(password) },
    { label: 'Al menos un símbolo',     ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  return (
    <View style={{ marginBottom: 12 }}>
      {checks.map(c => (
        <Text key={c.label} style={{ color: c.ok ? '#00D26A' : '#4a6a80', fontSize: 12, marginBottom: 3 }}>
          {c.ok ? '✓' : '○'} {c.label}
        </Text>
      ))}
    </View>
  );
}

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const router = useRouter();

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) return 'Nombre y apellido son obligatorios';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'El email no es válido';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número';
    if (!/[^a-zA-Z0-9]/.test(password)) return 'La contraseña debe tener al menos un símbolo';
    return null;
  };

  const handleRegister = async () => {
    setSuccess('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError('');
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
          email:      email.trim(),
          password,
        }),
      });
      if (res.status === 201) {
        setSuccess('Cuenta creada. Iniciá sesión.');
        setTimeout(() => router.replace('/login'), 1500);
      } else {
        const text = await res.text();
        setError(text.trim() || 'No se pudo crear el usuario');
      }
    } catch {
      setError('Sin conexión al servidor');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/login')}>
          <MaterialIcons name="arrow-back" size={20} color="#8aaabf" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crear cuenta</Text>
        <Text style={styles.headerSub}>Completá tus datos para registrarte</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error   ? <View style={styles.errorBox}><MaterialIcons name="error-outline" size={16} color="#ff4444" /><Text style={styles.errorText}>{error}</Text></View>   : null}
        {success ? <View style={styles.successBox}><MaterialIcons name="check-circle" size={16} color="#00D26A" /><Text style={styles.successText}>{success}</Text></View> : null}

        <View style={styles.inputWrapper}>
          <MaterialIcons name="person" size={20} color="#00ADD8" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="#aab8c8"
            value={firstName} onChangeText={setFirstName} />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="person-outline" size={20} color="#00ADD8" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Apellido" placeholderTextColor="#aab8c8"
            value={lastName} onChangeText={setLastName} />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="email" size={20} color="#00ADD8" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#aab8c8"
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="lock" size={20} color="#00ADD8" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#aab8c8"
            value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
          <TouchableOpacity onPress={() => setShowPass(v => !v)}>
            <MaterialIcons name={showPass ? 'visibility-off' : 'visibility'} size={20} color="#aab8c8" />
          </TouchableOpacity>
        </View>

        {password.length > 0 && <PasswordStrength password={password} />}

        <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister}>
          <Text style={styles.btnText}>Crear cuenta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.replace('/login')}>
          <Text style={styles.btnText}>Ya tengo cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0a1628' },
  header: {
    paddingTop: 52, paddingHorizontal: 28, paddingBottom: 24,
  },
  backBtn: { marginBottom: 12, alignSelf: 'flex-start' },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub:   { fontSize: 14, color: '#8aaabf' },
  form: {
    backgroundColor: '#f4f7fb', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 48, flexGrow: 1,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff0f0', borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#ffd0d0',
  },
  errorText:   { color: '#cc2222', fontSize: 13, flex: 1 },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fff4', borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#b0f0c0',
  },
  successText: { color: '#007730', fontSize: 13, flex: 1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e0eaf4',
    marginBottom: 14, paddingHorizontal: 14, height: 56,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  icon:  { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#1a2e4a', height: '100%' },
  btnPrimary: {
    backgroundColor: '#00ADD8', paddingVertical: 17, borderRadius: 14,
    alignItems: 'center', marginTop: 6, marginBottom: 12,
    shadowColor: '#00ADD8', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  btnSecondary: {
    backgroundColor: '#8aaabf', paddingVertical: 16,
    borderRadius: 14, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
