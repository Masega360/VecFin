import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Backend URL - en producción usa el tunnel HTTPS, en dev usa localhost
const PROD_API = 'https://headline-period-consumers-attract.trycloudflare.com';

function getApiUrl(): string {
    if (Platform.OS === 'web') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        if (host === 'localhost') return 'http://localhost:8080';
        return PROD_API;
    }
    try {
        const Constants = require('expo-constants').default;
        const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
        return `http://${devHost}:8080`;
    } catch {
        return 'http://localhost:8080';
    }
}

export const API_URL = getApiUrl();
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
