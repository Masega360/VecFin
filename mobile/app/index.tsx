import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    // Intentamos parsear el JSON de la respuesta
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      // CASO ÉXITO: 200 OK
      await AsyncStorage.setItem('userToken', data.token);
      Alert.alert('¡Éxito!', 'Sesión iniciada correctamente');
      router.replace('/home'); 
    } else {
      // CASO ERROR: 401, 400, 500, etc.
      // Si el backend manda un mensaje de error, lo mostramos, si no, uno genérico
      const msg = data.error || 'Credenciales inválidas o usuario no encontrado';
      Alert.alert('No se pudo ingresar', msg);
    }
  } catch (error) {
    // CASO FALLO DE RED: El servidor Go está caído o la IP está mal
    console.error(error);
    Alert.alert('Error de conexión', 'No se pudo contactar al servidor de VecFin');
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VecFin 💰</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Email" 
        value={email} 
        onChangeText={setEmail} 
        autoCapitalize="none" 
      />
      <TextInput 
        style={styles.input} 
        placeholder="Contraseña" 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
      />
      <Button title="Entrar" onPress={handleLogin} />
      <View style={{ marginTop: 10 }}>
        <Button 
          title="Crear cuenta nueva" 
          color="orange" 
          onPress={() => router.push('/register')} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { height: 50, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8 },
});