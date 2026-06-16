import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  risk_type?: string;
  is_private?: boolean;
  is_following?: boolean;
  follow_status?: string;
  can_see_wallets?: boolean;
  can_see_communities?: boolean;
}

interface DashboardData {
  total_value?: number;
  currency?: string;
  wallet_count?: number;
  asset_count?: number;
  top_assets?: { ticker: string; value: number }[];
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => { if (userId) loadProfile(); }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users/${userId}/public-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
      const dashRes = await fetch(`${API_URL}/users/${userId}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dashRes.ok) setDashboard(await dashRes.json());
    } catch {}
    finally { setLoading(false); }
  };

  const toggleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users/${profile.id}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) loadProfile();
    } catch {}
    finally { setFollowLoading(false); }
  };

  const formatUSD = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color="#00ADD8" style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.root}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#e0e0e0" />
        </TouchableOpacity>
        <Text style={styles.error}>Usuario no encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#e0e0e0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + Name */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.first_name?.[0]}{profile.last_name?.[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.first_name} {profile.last_name}</Text>
            {profile.email && <Text style={styles.email}>{profile.email}</Text>}
            {profile.risk_type && (
              <View style={styles.riskBadge}>
                <Text style={styles.riskText}>{profile.risk_type}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Follow button */}
        <TouchableOpacity
          style={[styles.followBtn, profile.is_following && styles.followBtnActive]}
          onPress={toggleFollow}
          disabled={followLoading}
        >
          {followLoading ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={styles.followBtnText}>
              {profile.follow_status === 'pending' ? 'Pendiente' :
               profile.is_following ? 'Siguiendo' : 'Seguir'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Dashboard data */}
        {profile.is_private && !profile.can_see_wallets ? (
          <View style={styles.privateBox}>
            <MaterialIcons name="lock" size={32} color="#4a6a80" />
            <Text style={styles.privateText}>Perfil privado</Text>
          </View>
        ) : dashboard ? (
          <View style={styles.statsBox}>
            {dashboard.total_value != null && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatUSD(dashboard.total_value)}</Text>
                <Text style={styles.statLabel}>Portfolio total</Text>
              </View>
            )}
            {dashboard.wallet_count != null && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{dashboard.wallet_count}</Text>
                <Text style={styles.statLabel}>Wallets</Text>
              </View>
            )}
            {dashboard.asset_count != null && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{dashboard.asset_count}</Text>
                <Text style={styles.statLabel}>Assets</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Top assets */}
        {dashboard?.top_assets && dashboard.top_assets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Assets</Text>
            {dashboard.top_assets.map((a, i) => (
              <View key={a.ticker} style={styles.assetRow}>
                <Text style={styles.assetRank}>#{i + 1}</Text>
                <Text style={styles.assetTicker}>{a.ticker}</Text>
                <Text style={styles.assetValue}>{formatUSD(a.value)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628', paddingTop: Platform.OS === 'android' ? 40 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: '#e0e0e0', fontSize: 18, fontWeight: '700' },
  content: { padding: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a3050', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#00ADD8', fontSize: 20, fontWeight: '700' },
  name: { color: '#e0e0e0', fontSize: 20, fontWeight: '700' },
  email: { color: '#4a6a80', fontSize: 13, marginTop: 2 },
  riskBadge: { backgroundColor: '#132238', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 },
  riskText: { color: '#8aaabf', fontSize: 11, fontWeight: '600' },
  followBtn: { backgroundColor: '#00ADD8', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 20 },
  followBtnActive: { backgroundColor: '#132238', borderWidth: 1, borderColor: '#00ADD8' },
  followBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  privateBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  privateText: { color: '#4a6a80', fontSize: 14 },
  statsBox: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#0f1f35', borderRadius: 10, padding: 14, alignItems: 'center' },
  statValue: { color: '#e0e0e0', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#4a6a80', fontSize: 11, marginTop: 4 },
  section: { marginTop: 10 },
  sectionTitle: { color: '#8aaabf', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  assetRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f1f35', borderRadius: 8, padding: 12, marginBottom: 6, gap: 10 },
  assetRank: { color: '#4a6a80', fontSize: 12, fontWeight: '700', width: 24 },
  assetTicker: { color: '#e0e0e0', fontSize: 14, fontWeight: '600', flex: 1 },
  assetValue: { color: '#2ecc71', fontSize: 14, fontWeight: '600' },
  error: { color: '#e74c3c', textAlign: 'center', marginTop: 40 },
});
