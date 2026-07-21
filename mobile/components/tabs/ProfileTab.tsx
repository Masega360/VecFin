import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, ScrollView, Modal, Switch
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL, getValidToken } from '@/utils/api';
import TokenUsageCard from '@/components/TokenUsageCard';

interface PrivacySettings {
  isPrivate: boolean;
  showWallets: boolean;
  showCommunities: boolean;
  showCommunityPosts: boolean;
}

interface NotificationSettings {
  priceAlerts: boolean;
  communityActivity: boolean;
  newMembers: boolean;
  marketing: boolean;
  followRequests: boolean;
  enabledChannels: string[];
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  risk_type: string;
  privacy?: PrivacySettings;
}

type TabView = 'overview' | 'settings';

const RISK_LABELS: Record<string, string> = {
  conservative: 'Conservador',
  moderate: 'Moderado',
  aggressive: 'Agresivo',
};

export default function ProfileTab() {
  const [view, setView] = useState<TabView>('overview');
  const [user, setUser] = useState<User | null>(null);
  const [pendingRequests, setPendingRequests] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exportingFiscal, setExportingFiscal] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Estados para los Modales
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [riskModalVisible, setRiskModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false); // Modal Notificaciones
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  // Estados locales para los settings
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    isPrivate: false, showWallets: true, showCommunities: true, showCommunityPosts: true
  });
  const [selectedRisk, setSelectedRisk] = useState<string>('moderate');

  const [notifications, setNotifications] = useState<NotificationSettings>({
    priceAlerts: false, communityActivity: false, newMembers: false, marketing: false, followRequests: true, enabledChannels: ['IN_APP']
  });

  useFocusEffect(
      useCallback(() => {
        fetchData();
      }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const token = await getValidToken();
    if (!token) return;

    try {
      // 1. Fetch del Perfil
      const resProfile = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resProfile.ok) {
        const userData = await resProfile.json();

        if (userData.privacy) {
          const mappedPrivacy = {
            isPrivate: userData.privacy.is_private ?? false,
            showWallets: userData.privacy.show_wallets ?? false,
            showCommunities: userData.privacy.show_communities ?? false,
            showCommunityPosts: userData.privacy.show_community_posts ?? false,
          };
          userData.privacy = mappedPrivacy;
          setPrivacy(mappedPrivacy);
        }
        setUser(userData);
        if (userData.risk_type) setSelectedRisk(userData.risk_type);
      } else {
        setError('No se pudo cargar el perfil');
      }

      // 2. Fetch de Solicitudes de Seguimiento
      const resRequests = await fetch(`${API_URL}/users/me/follow-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resRequests.ok) {
        const data = await resRequests.json();
        setPendingRequests(Array.isArray(data) ? data : []);
      }

      const resNotif = await fetch(`${API_URL}/notifications/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resNotif.ok) {
        const notifData = await resNotif.json();
        setNotifications({
          priceAlerts: notifData.price_alerts ?? false,
          communityActivity: notifData.community_activity ?? false,
          newMembers: notifData.new_members ?? false,
          marketing: notifData.marketing ?? false,
          followRequests: notifData.follow_requests ?? false,
          enabledChannels: notifData.enabled_channels || [],
        });
      }

    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveRequest = async (followerId: string, accept: boolean) => {
    setActionLoading(followerId);
    try {
      const token = await getValidToken();
      if (!token) return;

      const endpoint = accept ? 'accept' : 'reject';
      const res = await fetch(`${API_URL}/users/followers/${followerId}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setPendingRequests(prev => prev.filter(req => req.id !== followerId));
      } else {
        Alert.alert('Error', `No se pudo ${accept ? 'aceptar' : 'rechazar'} la solicitud.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Sin conexión al servidor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    router.replace('/login');
  };

  const handleDelete = async () => {
    const token = await getValidToken();
    if (!token || !user) return;
    try {
      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204) {
        await AsyncStorage.removeItem('userToken');
        router.replace('/login');
      } else {
        setError('No se pudo eliminar la cuenta');
      }
    } catch {
      setError('Sin conexión al servidor');
    }
  };
  const handleExportFiscal = async () => {
    if (exportingFiscal) return; // evita descargas dobles mientras se genera
    const token = await getValidToken();
    if (!token) return;
    setExportingFiscal(true);
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(`${API_URL}/users/me/fiscal-report`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { Alert.alert('Error', 'No se pudo generar el reporte fiscal'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte_fiscal.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const dir = FileSystem.documentDirectory;
        if (!dir) {
          Alert.alert('Error', 'El sistema de archivos no está disponible');
          return;
        }
        const fileUri = dir + 'reporte_fiscal.pdf';
        const res = await FileSystem.downloadAsync(
            `${API_URL}/users/me/fiscal-report`,
            fileUri,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.status === 200) {
          await Sharing.shareAsync(res.uri, { mimeType: 'application/pdf' });
        } else {
          Alert.alert('Error', 'No se pudo generar el reporte fiscal');
        }
      }
    } catch {
      Alert.alert('Error', 'Sin conexión al servidor');
    } finally {
      setExportingFiscal(false);
    }
  };

  // ── Handlers Adaptados a las Rutas de Go ──
  const handleSavePrivacy = async () => {
    if (!user) return;
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/users/${user.id}/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          is_private: privacy.isPrivate,
          show_wallets: privacy.showWallets,
          show_communities: privacy.showCommunities,
          show_community_posts: privacy.showCommunityPosts
        })
      });

      if (res.ok) {
        setUser({
          ...user,
          privacy: { ...privacy }
        });
        setPrivacyModalVisible(false);
        Alert.alert('Éxito', 'Preferencias de privacidad guardadas.');
      } else {
        Alert.alert('Error', 'No se pudieron guardar las preferencias');
      }
    } catch {
      Alert.alert('Error', 'Problema de conexión');
    }
  };

  const handleSaveRisk = async () => {
    if (!user) return;
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/users/${user.id}/risk`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ risk_type: selectedRisk })
      });

      if (res.ok) {
        setUser({ ...user, risk_type: selectedRisk });
        setRiskModalVisible(false);
        Alert.alert('Éxito', 'Perfil de riesgo actualizado.');
      } else {
        Alert.alert('Error', 'No se pudo actualizar el perfil de riesgo');
      }
    } catch {
      Alert.alert('Error', 'Problema de conexión');
    }
  };

  const handleSaveNotifications = async () => {
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/notifications/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          price_alerts: notifications.priceAlerts,
          community_activity: notifications.communityActivity,
          new_members: notifications.newMembers,
          marketing: notifications.marketing,
          follow_requests: notifications.followRequests,
          enabled_channels: notifications.enabledChannels
        })
      });

      if (res.ok) {
        setNotificationsModalVisible(false);
        Alert.alert('Éxito', 'Preferencias de notificaciones actualizadas.');
      } else {
        Alert.alert('Error', 'No se pudieron guardar las notificaciones');
      }
    } catch {
      Alert.alert('Error', 'Problema de conexión');
    }
  };

  // Función auxiliar para activar/desactivar canales
  const toggleChannel = (channel: string) => {
    setNotifications(prev => {
      const channels = prev.enabledChannels.includes(channel)
          ? prev.enabledChannels.filter(c => c !== channel)
          : [...prev.enabledChannels, channel];
      return { ...prev, enabledChannels: channels };
    });
  };

  if (loading) return <ActivityIndicator size="large" color="#00ADD8" style={s.loader} />;

  return (
      <View style={s.container}>
        {/* Toggle */}
        <View style={s.toggle}>
          {(['overview', 'settings'] as TabView[]).map(t => (
              <TouchableOpacity
                  key={t}
                  style={[s.toggleBtn, view === t && s.toggleBtnActive]}
                  onPress={() => setView(t)}
              >
                <MaterialIcons
                    name={t === 'overview' ? 'person' : 'settings'}
                    size={16}
                    color={view === t ? '#00ADD8' : '#3d5a70'}
                />
                <Text style={[s.toggleBtnText, view === t && s.toggleBtnTextActive]}>
                  {t === 'overview' ? 'Perfil' : 'Ajustes'}
                </Text>
              </TouchableOpacity>
          ))}
        </View>

        {error ? (
            <View style={s.errorBox}>
              <MaterialIcons name="error-outline" size={16} color="#ff4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
        ) : null}

        {/* ── Vista: Perfil y Solicitudes ── */}
        {view === 'overview' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={s.card}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </Text>
                </View>
                <Text style={s.name}>{user?.first_name} {user?.last_name}</Text>
                <Text style={s.email}>{user?.email}</Text>
                {user?.risk_type ? (
                    <View style={s.riskBadge}>
                      <Text style={s.riskText}>{RISK_LABELS[user.risk_type] || user.risk_type}</Text>
                    </View>
                ) : null}
              </View>

              {/* Solicitudes Pendientes */}
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Solicitudes de Seguimiento</Text>
                {pendingRequests.length > 0 && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{pendingRequests.length}</Text>
                    </View>
                )}
              </View>

              {pendingRequests.length === 0 ? (
                  <View style={s.emptyBox}>
                    <MaterialIcons name="check-circle-outline" size={40} color="#1e3a5a" />
                    <Text style={s.emptyText}>No tienes solicitudes pendientes.</Text>
                  </View>
              ) : (
                  pendingRequests.map(req => (
                      <View key={req.id} style={s.requestCard}>
                        <View style={s.requestInfo}>
                          <View style={s.requestAvatar}>
                            <Text style={s.requestAvatarText}>{req.first_name[0]}</Text>
                          </View>
                          <View>
                            <Text style={s.requestName}>{req.first_name} {req.last_name}</Text>
                            <Text style={s.requestEmail}>{req.email}</Text>
                          </View>
                        </View>

                        <View style={s.requestActions}>
                          <TouchableOpacity
                              style={[s.actionBtn, s.actionBtnReject]}
                              onPress={() => handleResolveRequest(req.id, false)}
                              disabled={actionLoading === req.id}
                          >
                            <MaterialIcons name="close" size={20} color="#ff4d4f" />
                          </TouchableOpacity>
                          <TouchableOpacity
                              style={[s.actionBtn, s.actionBtnAccept]}
                              onPress={() => handleResolveRequest(req.id, true)}
                              disabled={actionLoading === req.id}
                          >
                            {actionLoading === req.id ? (
                                <ActivityIndicator size="small" color="#00D26A" />
                            ) : (
                                <MaterialIcons name="check" size={20} color="#00D26A" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                  ))
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
        )}

        {/* ── Vista: Ajustes ── */}
        {view === 'settings' && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

              <Text style={s.settingsGroupTitle}>Cuenta</Text>
              <TouchableOpacity style={s.settingItem} onPress={() => router.push('/edit-profile')}>
                <View style={s.settingItemLeft}>
                  <MaterialIcons name="edit" size={20} color="#aab8c8" />
                  <Text style={s.settingItemText}>Editar información personal</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#3d5a70" />
              </TouchableOpacity>

              <TouchableOpacity
                  style={[s.settingItem, exportingFiscal && { opacity: 0.6 }]}
                  onPress={handleExportFiscal}
                  disabled={exportingFiscal}
              >
                <View style={s.settingItemLeft}>
                  <MaterialIcons name="description" size={20} color="#aab8c8" />
                  <Text style={s.settingItemText}>
                    {exportingFiscal ? 'Generando reporte…' : 'Exportar reporte fiscal'}
                  </Text>
                </View>
                {exportingFiscal ? (
                    <ActivityIndicator size="small" color="#00ADD8" />
                ) : (
                    <MaterialIcons name="chevron-right" size={20} color="#3d5a70" />
                )}
              </TouchableOpacity>

              <Text style={s.settingsGroupTitle}>Privacidad y Preferencias</Text>

              <TouchableOpacity
                  style={s.settingItem}
                  onPress={() => {
                    if (user?.privacy) {
                      setPrivacy({
                        isPrivate: user.privacy.isPrivate,
                        showWallets: user.privacy.showWallets,
                        showCommunities: user.privacy.showCommunities,
                        showCommunityPosts: user.privacy.showCommunityPosts,
                      });
                    }
                    setPrivacyModalVisible(true);
                  }}
              >
                <View style={s.settingItemLeft}>
                  <MaterialIcons name="lock" size={20} color="#aab8c8" />
                  <Text style={s.settingItemText}>Privacidad del perfil</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#3d5a70" />
              </TouchableOpacity>

              <TouchableOpacity style={s.settingItem} onPress={() => setNotificationsModalVisible(true)}>
                <View style={s.settingItemLeft}>
                  <MaterialIcons name="notifications" size={20} color="#aab8c8" />
                  <Text style={s.settingItemText}>Notificaciones</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#3d5a70" />
              </TouchableOpacity>

              <TouchableOpacity style={s.settingItem} onPress={() => setRiskModalVisible(true)}>
                <View style={s.settingItemLeft}>
                  <MaterialIcons name="trending-up" size={20} color="#aab8c8" />
                  <Text style={s.settingItemText}>Actualizar perfil de riesgo</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#3d5a70" />
              </TouchableOpacity>

              <View style={{ marginVertical: 20 }}>
                <TokenUsageCard />
              </View>

              <Text style={s.settingsGroupTitle}>Zona de peligro</Text>
              <TouchableOpacity style={[s.settingItem, s.settingItemDanger]} onPress={handleLogout}>
                <View style={s.settingItemLeft}>
                  <MaterialIcons name="logout" size={20} color="#ff4d4f" />
                  <Text style={[s.settingItemText, { color: '#ff4d4f' }]}>Cerrar sesión</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[s.settingItem, s.settingItemDanger]} onPress={() => setDeleteModalVisible(true)}>
                <View style={s.settingItemLeft}>
                  <MaterialIcons name="delete-outline" size={20} color="#ff4d4f" />
                  <Text style={[s.settingItemText, { color: '#ff4d4f' }]}>Eliminar cuenta</Text>
                </View>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
        )}

        <Modal visible={deleteModalVisible} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Eliminar cuenta</Text>
              <Text style={s.modalSubtitle}>
                ¿Estás seguro de que querés eliminar tu cuenta de forma definitiva? Esta acción no se puede deshacer.
              </Text>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalBtnCancel} onPress={() => setDeleteModalVisible(false)}>
                  <Text style={s.modalBtnTextCancel}>Cancelar</Text>
                </TouchableOpacity>

                {/* Este botón ejecuta tu función original con el fetch DELETE */}
                <TouchableOpacity style={[s.modalBtnSave, { backgroundColor: '#ff4d4f' }]} onPress={handleDelete}>
                  <Text style={s.modalBtnTextSave}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL: Privacidad ── */}
        <Modal visible={privacyModalVisible} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Privacidad del Perfil</Text>

              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Perfil Privado</Text>
                <Switch
                    value={privacy.isPrivate}
                    onValueChange={(v) => setPrivacy({...privacy, isPrivate: v})}
                    trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                />
              </View>
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Mostrar mis Wallets</Text>
                <Switch
                    value={privacy.showWallets}
                    onValueChange={(v) => setPrivacy({...privacy, showWallets: v})}
                    trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                />
              </View>
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Mostrar Comunidades</Text>
                <Switch
                    value={privacy.showCommunities}
                    onValueChange={(v) => setPrivacy({...privacy, showCommunities: v})}
                    trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                />
              </View>
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Mostrar mis Posts</Text>
                <Switch
                    value={privacy.showCommunityPosts}
                    onValueChange={(v) => setPrivacy({...privacy, showCommunityPosts: v})}
                    trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                />
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalBtnCancel} onPress={() => setPrivacyModalVisible(false)}>
                  <Text style={s.modalBtnTextCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalBtnSave} onPress={handleSavePrivacy}>
                  <Text style={s.modalBtnTextSave}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={notificationsModalVisible} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Notificaciones</Text>

              <Text style={s.sectionSubtitle}>¿Dónde querés recibirlas?</Text>
              <View style={s.channelRow}>
                {['IN_APP', 'EMAIL'].map(channel => {
                  const isActive = notifications.enabledChannels.includes(channel);
                  const labels: Record<string, string> = { IN_APP: 'En la app', EMAIL: 'Email' };
                  return (
                      <TouchableOpacity
                          key={channel}
                          style={[s.channelPill, isActive && s.channelPillActive]}
                          onPress={() => toggleChannel(channel)}
                      >
                        <Text style={[s.channelText, isActive && s.channelTextActive]}>{labels[channel]}</Text>
                      </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.sectionSubtitle}>¿Qué querés recibir?</Text>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Alertas de Precio</Text>
                  <Switch
                      value={notifications.priceAlerts}
                      onValueChange={(v) => setNotifications({...notifications, priceAlerts: v})}
                      trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                  />
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Actividad de la Comunidad</Text>
                  <Switch
                      value={notifications.communityActivity}
                      onValueChange={(v) => setNotifications({...notifications, communityActivity: v})}
                      trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                  />
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Nuevos Miembros</Text>
                  <Switch
                      value={notifications.newMembers}
                      onValueChange={(v) => setNotifications({...notifications, newMembers: v})}
                      trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                  />
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Marketing y Promos</Text>
                  <Switch
                      value={notifications.marketing}
                      onValueChange={(v) => setNotifications({...notifications, marketing: v})}
                      trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                  />
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Solicitudes de Seguimiento</Text>
                  <Switch
                      value={notifications.followRequests}
                      onValueChange={(v) => setNotifications({...notifications, followRequests: v})}
                      trackColor={{ false: '#1a2d42', true: '#00ADD8' }}
                  />
                </View>
              </ScrollView>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalBtnCancel} onPress={() => setNotificationsModalVisible(false)}>
                  <Text style={s.modalBtnTextCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalBtnSave} onPress={handleSaveNotifications}>
                  <Text style={s.modalBtnTextSave}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL: Perfil de Riesgo ── */}
        <Modal visible={riskModalVisible} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Perfil de Riesgo</Text>
              <Text style={s.modalSubtitle}>Seleccioná tu nivel de tolerancia al riesgo para ajustar tus recomendaciones.</Text>

              {Object.keys(RISK_LABELS).map((riskKey) => (
                  <TouchableOpacity
                      key={riskKey}
                      style={[s.radioBtn, selectedRisk === riskKey && s.radioBtnActive]}
                      onPress={() => setSelectedRisk(riskKey)}
                  >
                    <MaterialIcons
                        name={selectedRisk === riskKey ? "radio-button-checked" : "radio-button-unchecked"}
                        size={20}
                        color={selectedRisk === riskKey ? "#00ADD8" : "#7a9ab0"}
                    />
                    <Text style={[s.radioText, selectedRisk === riskKey && s.radioTextActive]}>
                      {RISK_LABELS[riskKey]}
                    </Text>
                  </TouchableOpacity>
              ))}

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalBtnCancel} onPress={() => setRiskModalVisible(false)}>
                  <Text style={s.modalBtnTextCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalBtnSave} onPress={handleSaveRisk}>
                  <Text style={s.modalBtnTextSave}>Actualizar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
  );
}

const s = StyleSheet.create({

  loader: { flex: 1, marginTop: 60 },

  container: { flex: 1, padding: 16, backgroundColor: '#080f1a' },

  toggle: {
    flexDirection: 'row', marginBottom: 16, backgroundColor: '#0d1826',
    borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#1a2d42',
  },

  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },

  toggleBtnActive: { backgroundColor: '#111e2e' },

  toggleBtnText: { color: '#3d5a70', fontSize: 14, fontWeight: '600' },

  toggleBtnTextActive: { color: '#e8f4f8' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff0f0',
    borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ffd0d0',
  },

  errorText: { color: '#cc2222', fontSize: 13, flex: 1 },

  card: {
    backgroundColor: '#111e2e', borderRadius: 20, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#1a2d42', marginBottom: 24,
  },

  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#0a2a40',
    borderWidth: 2, borderColor: '#00ADD8', justifyContent: 'center',
    alignItems: 'center', marginBottom: 14,
  },

  avatarText: { color: '#00ADD8', fontSize: 28, fontWeight: '700' },

  name: { fontSize: 22, fontWeight: '700', color: '#e8f4f8', marginBottom: 4 },

  email: { color: '#7a9ab0', fontSize: 14 },

  riskBadge: {
    marginTop: 10, backgroundColor: '#0a2a40', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: '#1a2d42',
  },

  riskText: { color: '#00ADD8', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4,
  },

  sectionTitle: { color: '#e8f4f8', fontSize: 16, fontWeight: '700' },

  badge: {
    backgroundColor: '#00ADD8', borderRadius: 10, paddingHorizontal: 6,
    paddingVertical: 2, justifyContent: 'center', alignItems: 'center',
  },

  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  emptyBox: {
    alignItems: 'center', padding: 24, backgroundColor: '#0d1826',
    borderRadius: 14, borderWidth: 1, borderColor: '#1a2d42', borderStyle: 'dashed',
  },

  emptyText: { color: '#7a9ab0', fontSize: 14, marginTop: 8 },

  requestCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111e2e', padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#1a2d42', marginBottom: 10,
  },

  requestInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },

  requestAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a2d42',
    alignItems: 'center', justifyContent: 'center',
  },

  requestAvatarText: { color: '#aab8c8', fontSize: 16, fontWeight: '700' },

  requestName: { color: '#e8f4f8', fontSize: 14, fontWeight: '600' },

  requestEmail: { color: '#7a9ab0', fontSize: 12 },

  requestActions: { flexDirection: 'row', gap: 8 },

  actionBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1,
  },

  actionBtnReject: { backgroundColor: 'rgba(255,77,79,0.1)', borderColor: 'rgba(255,77,79,0.3)' },

  actionBtnAccept: { backgroundColor: 'rgba(0,210,106,0.1)', borderColor: 'rgba(0,210,106,0.3)' },

  settingsGroupTitle: {
    color: '#7a9ab0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 8, marginTop: 16, paddingHorizontal: 4,
  },

  settingItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111e2e', padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#1a2d42', marginBottom: 8,
  },

  settingItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  settingItemText: { color: '#e8f4f8', fontSize: 15, fontWeight: '500' },

  settingItemDanger: { borderColor: 'rgba(255,77,79,0.3)', backgroundColor: '#0d1826' },

  // Estilos para Modales
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20
  },

  modalContent: {
    backgroundColor: '#111e2e', width: '100%', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: '#1a2d42', maxHeight: '85%' // Limita altura para scroll interno
  },

  modalTitle: { color: '#e8f4f8', fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },

  modalSubtitle: { color: '#7a9ab0', fontSize: 14, marginBottom: 20, textAlign: 'center' },

  sectionSubtitle: { color: '#e8f4f8', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },

  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a2d42'
  },

  switchLabel: { color: '#e8f4f8', fontSize: 15 },

  radioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: '#1a2d42', marginBottom: 10
  },

  radioBtnActive: { borderColor: '#00ADD8', backgroundColor: 'rgba(0, 173, 216, 0.1)' },

  radioText: { color: '#7a9ab0', fontSize: 16, textTransform: 'capitalize' },

  radioTextActive: { color: '#00ADD8', fontWeight: '600' },

  // Estilos de los canales (pills)
  channelRow: {
    flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap'
  },
  channelPill: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1, borderColor: '#1a2d42', backgroundColor: '#0d1826'
  },
  channelPillActive: {
    borderColor: '#00ADD8', backgroundColor: 'rgba(0, 173, 216, 0.1)'
  },
  channelText: { color: '#7a9ab0', fontSize: 13, fontWeight: '500' },
  channelTextActive: { color: '#00ADD8', fontWeight: 'bold' },

  modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 24 },

  modalBtnCancel: {
    flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#0d1826', borderWidth: 1, borderColor: '#1a2d42'
  },

  modalBtnTextCancel: { color: '#aab8c8', fontWeight: '600' },

  modalBtnSave: {
    flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#00ADD8'
  },

  modalBtnTextSave: { color: '#ffffff', fontWeight: 'bold' }

});