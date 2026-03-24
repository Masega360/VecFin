import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1628" />

      {/* Background decorations */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="trending-up" size={56} color="#00ADD8" />
          </View>
          <Text style={styles.appName}>VecFin</Text>
        </View>

        {/* Finance card illustration */}
        <View style={styles.illustrationArea}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="account-balance-wallet" size={18} color="#8aaabf" />
              <Text style={styles.cardLabel}>Balance total</Text>
              <Text style={styles.cardAmount}>$24.800</Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.cardRow}>
              <MaterialIcons name="arrow-upward" size={16} color="#4CAF50" />
              <Text style={styles.cardRowLabel}>Ingresos</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { width: '78%', backgroundColor: '#4CAF50' }]} />
              </View>
            </View>
            <View style={styles.cardRow}>
              <MaterialIcons name="arrow-downward" size={16} color="#FF5252" />
              <Text style={styles.cardRowLabel}>Gastos</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { width: '45%', backgroundColor: '#FF5252' }]} />
              </View>
            </View>
            <View style={styles.cardRow}>
              <MaterialIcons name="savings" size={16} color="#FF9800" />
              <Text style={styles.cardRowLabel}>Ahorros</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { width: '62%', backgroundColor: '#FF9800' }]} />
              </View>
            </View>
          </View>

          {/* Floating stat pill */}
          <View style={styles.pill}>
            <MaterialIcons name="show-chart" size={14} color="#4CAF50" />
            <Text style={styles.pillText}>+12.4% este mes</Text>
          </View>
        </View>

        {/* Tagline */}
        <View style={styles.textArea}>
          <Text style={styles.tagline}>Tu solución para</Text>
          <Text style={styles.taglineBold}>finanzas inteligentes</Text>
          <Text style={styles.subtitle}>
            Controlá gastos, inversiones y ahorros{'\n'}en un solo lugar.
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaButton} onPress={() => router.replace('/login')}>
          <Text style={styles.ctaText}>Empecemos</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#00ADD815',
  },
  circle2: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#1a3a5c60',
  },
  circle3: {
    position: 'absolute',
    top: '40%',
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#00ADD808',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#00ADD812',
    borderWidth: 1,
    borderColor: '#00ADD830',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  appName: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 3,
  },
  illustrationArea: {
    width: '100%',
    marginBottom: 40,
    position: 'relative',
  },
  card: {
    backgroundColor: '#132238',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e3a5a',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  cardLabel: {
    color: '#8aaabf',
    fontSize: 13,
    flex: 1,
  },
  cardAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#1e3a5a',
    marginBottom: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardRowLabel: {
    color: '#8aaabf',
    fontSize: 12,
    width: 56,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#0a1628',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
  pill: {
    position: 'absolute',
    bottom: -14,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d2a1a',
    borderWidth: 1,
    borderColor: '#1a4a2a',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 5,
  },
  pillText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    alignItems: 'center',
    marginBottom: 44,
    marginTop: 10,
  },
  tagline: {
    fontSize: 22,
    color: '#8aaabf',
    fontWeight: '400',
    textAlign: 'center',
  },
  taglineBold: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#4a6a80',
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ADD8',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 50,
    shadowColor: '#00ADD8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
