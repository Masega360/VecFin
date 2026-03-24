import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          first_name: firstName,  // Clave exacta requerida por Go
          last_name: lastName,    // Clave exacta requerida por Go
          email: email, 
          password: password 
        }),
      });

      if (response.status === 201) {
        Alert.alert('¡Éxito!', 'Usuario creado correctamente. Ahora iniciá sesión.');
        router.replace('/'); // Te manda de vuelta al login
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Error', errorData.error || 'No se pudo crear el usuario. Revisá los logs de Go.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No hay conexión con el servidor.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrate en VecFin</Text>
      <TextInput style={styles.input} placeholder="Nombre" value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder="Apellido" value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Crear Cuenta" onPress={handleRegister} />
      <Button title="Volver al Login" color="gray" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { height: 50, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8 },
});