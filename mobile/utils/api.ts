import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export const API_URL =
  Platform.OS === 'android' ? 'http://172.22.41.203:8080' : 'http://localhost:8080';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Devuelve el token si existe y no expiró.
 * Si expiró o falta, limpia storage y redirige al login.
 */
export async function getValidToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token || isTokenExpired(token)) {
      await AsyncStorage.removeItem('userToken');
      router.replace('/login');
      return null;
    }
    return token;
  } catch {
    router.replace('/login');
    return null;
  }
}
