import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

export default function EditProfileScreen() {
  const [id,        setId]        = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const router = useRouter();

  useEffect(() => { loadProfile(); }, []);

  // Fallback si no hay historial (deep link / refresh en web)
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/home', params: { tab: 'profile' } });
  };

  const loadProfile = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setId(data.id);
        setFirstName(data.first_name);
        setLastName(data.last_name);
        setEmail(data.email);
      } else {
        setError('No se pudo cargar el perfil');
      }
    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    if (!firstName.trim()) return 'El nombre no puede estar vacío';
    if (!lastName.trim())  return 'El apellido no puede estar vacío';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'El email no es válido';
    return null;
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const token = await getValidToken();
    if (!token) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
          email:      email.trim(),
        }),
      });
      if (res.ok) {
        setSuccess('Perfil actualizado correctamente');
      } else {
        const text = await res.text();
        setError(text.trim() || 'No se pudo actualizar el perfil');
      }
    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#00ADD8" style={{ flex: 1, backgroundColor: '#0a1628' }} />;

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <MaterialIcons name="arrow-back" size={20} color="#8aaabf" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar perfil</Text>
        <Text style={styles.headerSub}>Modificá tus datos personales</Text>
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

        <TouchableOpacity style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>Guardar cambios</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={goBack}>
          <Text style={styles.btnText}>Cancelar</Text>
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
  backBtn:     { marginBottom: 12, alignSelf: 'flex-start' },
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
  errorText: { color: '#cc2222', fontSize: 13, flex: 1 },
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
  btnDisabled: { opacity: 0.6 },
  btnSecondary: {
    backgroundColor: '#8aaabf', paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
