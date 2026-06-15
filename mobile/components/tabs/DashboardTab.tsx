import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl,
  TextInput, TouchableOpacity, Modal, Alert, FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ── Interfaces Principales ──
interface HoldingInfo { symbol: string; name: string; value: number; percentage: number; change_pct: number; }
interface PerformerInfo { symbol: string; name: string; change_pct: number; }

interface DashboardData {
  user_id: string;
  followers_count: number;
  following_count: number;
  follow_status: 'pending' | 'approved' | 'canceled' | '';
  total_value: number;
  total_cost: number;
  total_gain: number;
  total_gain_pct: number;
  day_change: number;
  day_change_pct: number;
  holdings: HoldingInfo[];
  top_performer: PerformerInfo | null;
  worst_performer: PerformerInfo | null;
  total_wallets: number;
  total_assets: number;
  community_count: number;
  post_count: number;
}

interface PublicProfile {
  id: string;
  first_name: string;
  last_name: string;
  is_private: boolean;
  wallets_visible: boolean;
  communities_visible: boolean;
  posts_visible: boolean;
}

interface UserBase { id: string; first_name: string; last_name: string; }

// ── Interfaces Paginadas ──
interface WalletItem { id: string; name: string; created_at: string; }
interface CommunityItem { id: string; name: string; description: string; member_count: number; }
interface PostItem { id: string; title: string; content: string; upvotes: number; comment_count: number; created_at: string; }

type TabView = 'mine' | 'search';
type ProfileSubTab = 'overview' | 'wallets' | 'communities' | 'posts';
type FollowListType = 'followers' | 'following' | null;

const LIMIT = 10;

export default function DashboardTab() {
  const [view, setView] = useState<TabView>('mine');

  // Mi estado
  const [myProfile, setMyProfile] = useState<PublicProfile | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados de Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserBase[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estados del Perfil de Terceros
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [guestDashboard, setGuestDashboard] = useState<DashboardData | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Estados de Seguidores/Seguidos
  const [followListVisible, setFollowListVisible] = useState(false);
  const [followListType, setFollowListType] = useState<FollowListType>(null);
  const [followList, setFollowList] = useState<UserBase[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  // ── Estados para las Listas Paginadas ──
  const [subTab, setSubTab] = useState<ProfileSubTab>('overview');
  const [subTabLoading, setSubTabLoading] = useState(false);

  const [paginatedWallets, setPaginatedWallets] = useState<WalletItem[]>([]);
  const [paginatedComms, setPaginatedComms] = useState<CommunityItem[]>([]);
  const [paginatedPosts, setPaginatedPosts] = useState<PostItem[]>([]);

  // ── Estados de Paginación ──
  const [offsets, setOffsets] = useState({ wallets: 0, communities: 0, posts: 0 });
  const [hasMore, setHasMore] = useState({ wallets: true, communities: true, posts: true });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchMyDashboard();
    fetchMyPublicProfile();
  }, []);

  const fetchMyPublicProfile = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const p = await res.json();
        setMyProfile({
          id: p.id, first_name: p.first_name, last_name: p.last_name,
          is_private: false, wallets_visible: true, communities_visible: true, posts_visible: true
        });
      }
    } catch (e) { console.error(e); }
  };

  const fetchMyDashboard = async () => {
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const token = await getValidToken();
    try {
      const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSearchResults(await res.json());
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };

  const handleOpenProfile = async (userId: string) => {
    setFollowListVisible(false);
    setSubTab('overview');

    setProfileModalVisible(true);
    setSelectedProfile(null);
    setGuestDashboard(null);

    const token = await getValidToken();
    if (!token) return;

    try {
      const resProfile = await fetch(`${API_URL}/users/${userId}/public-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resProfile.ok) {
        const profileData = await resProfile.json();
        setSelectedProfile(profileData);
      }

      const dashRes = await fetch(`${API_URL}/users/${userId}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dashRes.ok) {
        setGuestDashboard(await dashRes.json());
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar el perfil');
    }
  };

  const toggleFollow = async () => {
    if (!selectedProfile || !guestDashboard) return;
    setActionLoading(true);
    const token = await getValidToken();
    if (!token) return;

    const isCurrentlyFollowing = guestDashboard.follow_status === 'approved' || guestDashboard.follow_status === 'pending';
    const method = isCurrentlyFollowing ? 'DELETE' : 'POST';

    try {
      const res = await fetch(`${API_URL}/users/${selectedProfile.id}/follow`, {
        method, headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const dashRes = await fetch(`${API_URL}/users/${selectedProfile.id}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dashRes.ok) setGuestDashboard(await dashRes.json());
      } else {
        Alert.alert('Error', 'No se pudo completar la acción');
      }
    } catch (e) { Alert.alert('Error', 'Problema de conexión'); }
    finally { setActionLoading(false); }
  };

  const openFollowList = async (userId: string, type: FollowListType) => {
    setFollowListType(type);
    setFollowListVisible(true);
    setFollowListLoading(true);
    setFollowList([]);

    const token = await getValidToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/users/${userId}/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setFollowList(await res.json());
    } catch (e) { Alert.alert('Error', `No se pudo cargar la lista`); }
    finally { setFollowListLoading(false); }
  };

  // ── Función Paginada para Cargar Sub-Pestañas ──
  const fetchSubTab = async (tab: ProfileSubTab, targetUserId: string, isLoadMore = false) => {
    setSubTab(tab);
    if (tab === 'overview') return;

    const currentOffset = isLoadMore ? offsets[tab] : 0;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setSubTabLoading(true);
    }

    const token = await getValidToken();
    if (!token) return;

    try {
      const endpoint = `/users/${targetUserId}/${tab}?limit=${LIMIT}&offset=${currentOffset}`;
      const res = await fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });

      if (res.ok) {
        const json = await res.json();
        const fetchedCount = json.length;

        if (tab === 'wallets') {
          setPaginatedWallets(prev => isLoadMore ? [...prev, ...json] : json);
        } else if (tab === 'communities') {
          setPaginatedComms(prev => isLoadMore ? [...prev, ...json] : json);
        } else if (tab === 'posts') {
          setPaginatedPosts(prev => isLoadMore ? [...prev, ...json] : json);
        }

        // Actualizamos los parámetros para el próximo "Cargar más"
        setOffsets(prev => ({ ...prev, [tab]: currentOffset + LIMIT }));
        setHasMore(prev => ({ ...prev, [tab]: fetchedCount === LIMIT }));

      } else if (res.status === 403) {
        if (!isLoadMore) {
          if (tab === 'wallets') setPaginatedWallets([]);
          if (tab === 'communities') setPaginatedComms([]);
          if (tab === 'posts') setPaginatedPosts([]);
        }
        setHasMore(prev => ({ ...prev, [tab]: false }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubTabLoading(false);
      setLoadingMore(false);
    }
  };

  const getFollowBtnStyle = (status: string) => {
    if (status === 'approved') return { bg: '#1a2d42', text: 'Dejar de seguir', color: '#aab8c8' };
    if (status === 'pending') return { bg: '#2a220d', text: 'Pendiente', color: '#f0b90b' };
    return { bg: '#00ADD8', text: 'Seguir', color: '#fff' };
  };

  const renderProfileContent = (d: DashboardData, profileContext: PublicProfile | null) => {
    const positive = d.day_change >= 0;

    const canSeeWallets = profileContext ? profileContext.wallets_visible : true;
    const canSeeComms = profileContext ? profileContext.communities_visible : true;
    const canSeePosts = profileContext ? profileContext.posts_visible : true;

    return (
        <View>
          {/* Social Bar */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialItem} onPress={() => openFollowList(d.user_id, 'followers')}>
              <Text style={styles.socialCount}>{d.followers_count}</Text>
              <Text style={styles.socialLabel}>Seguidores</Text>
            </TouchableOpacity>
            <View style={styles.socialDivider} />
            <TouchableOpacity style={styles.socialItem} onPress={() => openFollowList(d.user_id, 'following')}>
              <Text style={styles.socialCount}>{d.following_count}</Text>
              <Text style={styles.socialLabel}>Seguidos</Text>
            </TouchableOpacity>
          </View>

          {/* SubTabs Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabRow}>
            <TouchableOpacity style={[styles.subTabBtn, subTab === 'overview' && styles.subTabBtnActive]} onPress={() => setSubTab('overview')}>
              <Text style={[styles.subTabBtnText, subTab === 'overview' && styles.subTabBtnTextActive]}>Resumen</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.subTabBtn, subTab === 'wallets' && styles.subTabBtnActive]} onPress={() => fetchSubTab('wallets', d.user_id)}>
              <Text style={[styles.subTabBtnText, subTab === 'wallets' && styles.subTabBtnTextActive]}>Wallets</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.subTabBtn, subTab === 'communities' && styles.subTabBtnActive]} onPress={() => fetchSubTab('communities', d.user_id)}>
              <Text style={[styles.subTabBtnText, subTab === 'communities' && styles.subTabBtnTextActive]}>Comunidades</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.subTabBtn, subTab === 'posts' && styles.subTabBtnActive]} onPress={() => fetchSubTab('posts', d.user_id)}>
              <Text style={[styles.subTabBtnText, subTab === 'posts' && styles.subTabBtnTextActive]}>Posts</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={{ height: 16 }} />

          {/* ── Render del Contenido según la pestaña seleccionada ── */}

          {subTab === 'overview' && (
              <View>
                <View style={styles.statsGrid}>
                  <View style={styles.statCardSmall}>
                    <MaterialIcons name="account-balance-wallet" size={18} color="#00ADD8" />
                    <View>
                      <Text style={styles.statNumberSmall}>{canSeeWallets ? d.total_wallets : '-'}</Text>
                      <Text style={styles.statLabelSmall}>Wallets</Text>
                    </View>
                  </View>
                  <View style={styles.statCardSmall}>
                    <MaterialIcons name="trending-up" size={18} color="#00ADD8" />
                    <View>
                      <Text style={styles.statNumberSmall}>{canSeeWallets ? d.total_assets : '-'}</Text>
                      <Text style={styles.statLabelSmall}>Assets</Text>
                    </View>
                  </View>
                  <View style={styles.statCardSmall}>
                    <MaterialIcons name="groups" size={18} color="#00ADD8" />
                    <View>
                      <Text style={styles.statNumberSmall}>{canSeeComms ? d.community_count : '-'}</Text>
                      <Text style={styles.statLabelSmall}>Comunidades</Text>
                    </View>
                  </View>
                  <View style={styles.statCardSmall}>
                    <MaterialIcons name="forum" size={18} color="#00ADD8" />
                    <View>
                      <Text style={styles.statNumberSmall}>{canSeePosts ? d.post_count : '-'}</Text>
                      <Text style={styles.statLabelSmall}>Posts</Text>
                    </View>
                  </View>
                </View>

                {canSeeWallets ? (
                    <>
                      <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Valor del Portfolio</Text>
                        <Text style={styles.summaryValue}>${d.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        <View style={[styles.changePill, { backgroundColor: positive ? '#0d2a1a' : '#2a0d0d' }]}>
                          <MaterialIcons name={positive ? 'arrow-drop-up' : 'arrow-drop-down'} size={20} color={positive ? '#00D26A' : '#FF4D4D'} />
                          <Text style={{ color: positive ? '#00D26A' : '#FF4D4D', fontWeight: '700', fontSize: 14 }}>
                            {positive ? '+' : ''}{d.day_change.toFixed(2)} ({positive ? '+' : ''}{d.day_change_pct.toFixed(2)}%) hoy
                          </Text>
                        </View>
                      </View>

                      {d.holdings && d.holdings.length > 0 && (
                          <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Distribución</Text>
                            {d.holdings.map(h => (
                                <View key={h.symbol} style={styles.holdingRow}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                                    <Text style={styles.holdingName}>{h.name}</Text>
                                  </View>
                                  <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.holdingValue}>${h.value.toFixed(2)}</Text>
                                    <Text style={styles.holdingPct}>{h.percentage.toFixed(1)}%</Text>
                                  </View>
                                  <View style={styles.barContainer}>
                                    <View style={[styles.bar, { width: `${Math.min(h.percentage, 100)}%` }]} />
                                  </View>
                                </View>
                            ))}
                          </View>
                      )}
                    </>
                ) : (
                    <View style={styles.emptyBox}>
                      <MaterialIcons name="visibility-off" size={40} color="#1e3a5a" />
                      <Text style={styles.emptyText}>El portfolio de este usuario es privado</Text>
                    </View>
                )}
              </View>
          )}

          {/* ── SubTab: WALLETS ── */}
          {subTab === 'wallets' && (
              <View>
                {!canSeeWallets ? (
                    <View style={styles.emptyBox}><MaterialIcons name="visibility-off" size={40} color="#1e3a5a" /><Text style={styles.emptyText}>Wallets Privadas</Text></View>
                ) : subTabLoading ? (
                    <ActivityIndicator color="#00ADD8" style={{ marginTop: 20 }}/>
                ) : paginatedWallets.length === 0 ? (
                    <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay wallets</Text></View>
                ) : (
                    <>
                      {paginatedWallets.map(w => (
                          <View key={w.id} style={styles.listItemCard}>
                            <MaterialIcons name="account-balance-wallet" size={24} color="#00ADD8" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.listItemTitle}>{w.name}</Text>
                              <Text style={styles.listItemSub}>Creada: {new Date(w.created_at).toLocaleDateString()}</Text>
                            </View>
                          </View>
                      ))}
                      {hasMore.wallets && paginatedWallets.length > 0 && (
                          <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchSubTab('wallets', d.user_id, true)} disabled={loadingMore}>
                            {loadingMore ? <ActivityIndicator size="small" color="#00ADD8" /> : <Text style={styles.loadMoreText}>Cargar más</Text>}
                          </TouchableOpacity>
                      )}
                    </>
                )}
              </View>
          )}

          {/* ── SubTab: COMMUNITIES ── */}
          {subTab === 'communities' && (
              <View>
                {!canSeeComms ? (
                    <View style={styles.emptyBox}><MaterialIcons name="visibility-off" size={40} color="#1e3a5a" /><Text style={styles.emptyText}>Comunidades Privadas</Text></View>
                ) : subTabLoading ? (
                    <ActivityIndicator color="#00ADD8" style={{ marginTop: 20 }}/>
                ) : paginatedComms.length === 0 ? (
                    <View style={styles.emptyBox}><Text style={styles.emptyText}>No pertenece a ninguna comunidad</Text></View>
                ) : (
                    <>
                      {paginatedComms.map(c => (
                          <View key={c.id} style={styles.listItemCard}>
                            <MaterialIcons name="groups" size={24} color="#00ADD8" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.listItemTitle}>{c.name}</Text>
                              <Text style={styles.listItemSub}>{c.member_count} miembros</Text>
                            </View>
                          </View>
                      ))}
                      {hasMore.communities && paginatedComms.length > 0 && (
                          <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchSubTab('communities', d.user_id, true)} disabled={loadingMore}>
                            {loadingMore ? <ActivityIndicator size="small" color="#00ADD8" /> : <Text style={styles.loadMoreText}>Cargar más</Text>}
                          </TouchableOpacity>
                      )}
                    </>
                )}
              </View>
          )}

          {/* ── SubTab: POSTS ── */}
          {subTab === 'posts' && (
              <View>
                {!canSeePosts ? (
                    <View style={styles.emptyBox}><MaterialIcons name="visibility-off" size={40} color="#1e3a5a" /><Text style={styles.emptyText}>Posts Privados</Text></View>
                ) : subTabLoading ? (
                    <ActivityIndicator color="#00ADD8" style={{ marginTop: 20 }}/>
                ) : paginatedPosts.length === 0 ? (
                    <View style={styles.emptyBox}><Text style={styles.emptyText}>No tiene posts publicados</Text></View>
                ) : (
                    <>
                      {paginatedPosts.map(p => (
                          <View key={p.id} style={styles.postCard}>
                            <Text style={styles.postTitle}>{p.title || 'Sin Título'}</Text>
                            <Text style={styles.postContent} numberOfLines={3}>{p.content}</Text>
                            <View style={styles.postFooter}>
                              <View style={styles.postFooterItem}>
                                <MaterialIcons name="thumb-up" size={14} color="#7a9ab0" />
                                <Text style={styles.postFooterText}>{p.upvotes}</Text>
                              </View>
                              <View style={styles.postFooterItem}>
                                <MaterialIcons name="chat-bubble-outline" size={14} color="#7a9ab0" />
                                <Text style={styles.postFooterText}>{p.comment_count}</Text>
                              </View>
                              <Text style={styles.postDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
                            </View>
                          </View>
                      ))}
                      {hasMore.posts && paginatedPosts.length > 0 && (
                          <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchSubTab('posts', d.user_id, true)} disabled={loadingMore}>
                            {loadingMore ? <ActivityIndicator size="small" color="#00ADD8" /> : <Text style={styles.loadMoreText}>Cargar más</Text>}
                          </TouchableOpacity>
                      )}
                    </>
                )}
              </View>
          )}
        </View>
    );
  };

  if (loading) return <ActivityIndicator color="#00ADD8" style={{ flex: 1, backgroundColor: '#080f1a' }} />;

  return (
      <View style={styles.container}>
        {/* ── Tabs Superiores ── */}
        <View style={styles.toggleRow}>
          {(['mine', 'search'] as TabView[]).map(t => (
              <TouchableOpacity
                  key={t}
                  style={[styles.toggleBtn, view === t && styles.toggleBtnActive]}
                  onPress={() => { setView(t); setSubTab('overview'); }}
              >
                <MaterialIcons
                    name={t === 'mine' ? 'dashboard' : 'search'}
                    size={18}
                    color={view === t ? '#00ADD8' : '#3d5a70'}
                />
                <Text style={[styles.toggleBtnText, view === t && styles.toggleBtnTextActive]}>
                  {t === 'mine' ? 'Mi Dashboard' : 'Buscar'}
                </Text>
              </TouchableOpacity>
          ))}
        </View>

        {/* ── Vista: MI DASHBOARD ── */}
        {view === 'mine' && (
            <ScrollView
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMyDashboard(); }} tintColor="#00ADD8" />}
            >
              {data ? renderProfileContent(data, myProfile) : (
                  <View style={styles.empty}>
                    <MaterialIcons name="error-outline" size={48} color="#1e3a5a" />
                    <Text style={styles.emptyText}>No se pudo cargar el dashboard</Text>
                  </View>
              )}
            </ScrollView>
        )}

        {/* ── Vista: BÚSQUEDA ── */}
        {view === 'search' && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={20} color="#7a9ab0" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar inversores..."
                    placeholderTextColor="#7a9ab0"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                />
                {isSearching && <ActivityIndicator size="small" color="#00ADD8" />}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {searchResults.map((u) => (
                    <TouchableOpacity key={u.id} style={styles.userCard} onPress={() => handleOpenProfile(u.id)}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>{u.first_name?.[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{u.first_name} {u.last_name}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color="#3d5a70" />
                    </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
        )}

        {/* ── MODAL: PERFIL PÚBLICO ── */}
        <Modal visible={profileModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>

              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#aab8c8" />
                </TouchableOpacity>
              </View>

              {selectedProfile && guestDashboard ? (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={styles.avatarBig}>
                        <Text style={styles.avatarBigText}>{selectedProfile.first_name[0]}</Text>
                      </View>
                      <Text style={styles.profileName}>{selectedProfile.first_name} {selectedProfile.last_name}</Text>
                      {selectedProfile.is_private && (
                          <View style={styles.privateBadge}>
                            <MaterialIcons name="lock" size={14} color="#7a9ab0" />
                            <Text style={styles.privateBadgeText}>Cuenta Privada</Text>
                          </View>
                      )}
                    </View>

                    {/* Botón de Seguir Dinámico */}
                    <TouchableOpacity
                        style={[styles.followBtn, { backgroundColor: getFollowBtnStyle(guestDashboard.follow_status).bg }]}
                        onPress={toggleFollow}
                        disabled={actionLoading}
                    >
                      {actionLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                      ) : (
                          <Text style={[styles.followBtnText, { color: getFollowBtnStyle(guestDashboard.follow_status).color }]}>
                            {getFollowBtnStyle(guestDashboard.follow_status).text}
                          </Text>
                      )}
                    </TouchableOpacity>

                    <View style={{ height: 24 }} />

                    {/* Renderizar Dashboard del Invitado */}
                    {renderProfileContent(guestDashboard, selectedProfile)}

                  </ScrollView>
              ) : (
                  <ActivityIndicator size="large" color="#00ADD8" style={{ marginTop: 40 }} />
              )}
            </View>
          </View>
        </Modal>

        {/* ── MODAL: LISTA DE SEGUIDORES / SEGUIDOS ── */}
        <Modal visible={followListVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentList}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitleList}>
                  {followListType === 'followers' ? 'Seguidores' : 'Seguidos'}
                </Text>
                <TouchableOpacity onPress={() => setFollowListVisible(false)}>
                  <MaterialIcons name="close" size={24} color="#aab8c8" />
                </TouchableOpacity>
              </View>

              {followListLoading ? (
                  <ActivityIndicator size="large" color="#00ADD8" style={{ marginTop: 40 }} />
              ) : followList.length === 0 ? (
                  <View style={styles.emptyList}>
                    <MaterialIcons name="group-off" size={40} color="#1e3a5a" />
                    <Text style={styles.emptyText}>No hay usuarios para mostrar</Text>
                  </View>
              ) : (
                  <FlatList
                      data={followList}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                          <TouchableOpacity style={styles.userCardList} onPress={() => handleOpenProfile(item.id)}>
                            <View style={styles.userAvatarSmall}>
                              <Text style={styles.userAvatarTextSmall}>{item.first_name?.[0]}</Text>
                            </View>
                            <Text style={styles.userName}>{item.first_name} {item.last_name}</Text>
                          </TouchableOpacity>
                      )}
                  />
              )}
            </View>
          </View>
        </Modal>

      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#080f1a' },

  toggleRow: {
    flexDirection: 'row', marginBottom: 16, backgroundColor: '#0d1826',
    borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#1a2d42',
  },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: '#111e2e' },
  toggleBtnText: { color: '#3d5a70', fontSize: 14, fontWeight: '600' },
  toggleBtnTextActive: { color: '#e8f4f8' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111e2e',
    borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 16,
    borderWidth: 1, borderColor: '#1a2d42'
  },
  searchInput: { flex: 1, color: '#e8f4f8', marginLeft: 8, fontSize: 15 },

  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111e2e',
    padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1a2d42'
  },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a2d42', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarText: { color: '#00ADD8', fontWeight: 'bold', fontSize: 16 },
  userName: { color: '#e8f4f8', fontSize: 15, fontWeight: '600' },

  socialRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 20 },
  socialItem: { alignItems: 'center', paddingHorizontal: 10 },
  socialCount: { color: '#e8f4f8', fontSize: 20, fontWeight: 'bold' },
  socialLabel: { color: '#7a9ab0', fontSize: 13, marginTop: 2 },
  socialDivider: { width: 1, height: 30, backgroundColor: '#1a2d42' },

  subTabRow: { flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a2d42' },
  subTabBtn: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 8 },
  subTabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#00ADD8' },
  subTabBtnText: { color: '#7a9ab0', fontSize: 14, fontWeight: '600' },
  subTabBtnTextActive: { color: '#e8f4f8' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCardSmall: {
    flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111e2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1a2d42'
  },
  statNumberSmall: { color: '#e8f4f8', fontSize: 18, fontWeight: 'bold' },
  statLabelSmall: { color: '#7a9ab0', fontSize: 12 },

  summaryCard: { backgroundColor: '#111e2e', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1a2d42', marginBottom: 16 },
  summaryLabel: { color: '#7a9ab0', fontSize: 14, marginBottom: 8 },
  summaryValue: { color: '#e8f4f8', fontSize: 32, fontWeight: '700', marginBottom: 12 },
  changePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },

  section: { marginBottom: 24 },
  sectionTitle: { color: '#e8f4f8', fontSize: 18, fontWeight: '700', marginBottom: 12 },

  holdingRow: { backgroundColor: '#111e2e', padding: 16, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1a2d42' },
  holdingSymbol: { color: '#e8f4f8', fontSize: 16, fontWeight: '600' },
  holdingName: { color: '#7a9ab0', fontSize: 13 },
  holdingValue: { color: '#e8f4f8', fontSize: 15, fontWeight: '600' },
  holdingPct: { color: '#00ADD8', fontSize: 13 },
  barContainer: { height: 4, backgroundColor: '#1a2d42', borderRadius: 2, marginTop: 12, width: '100%' },
  bar: { height: '100%', backgroundColor: '#00ADD8', borderRadius: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyBox: { alignItems: 'center', padding: 30, backgroundColor: '#0d1826', borderRadius: 14, borderWidth: 1, borderColor: '#1a2d42', borderStyle: 'dashed' },
  emptyText: { color: '#7a9ab0', fontSize: 15, marginTop: 12, textAlign: 'center' },

  listItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111e2e', padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1a2d42' },
  listItemTitle: { color: '#e8f4f8', fontSize: 16, fontWeight: '600' },
  listItemSub: { color: '#7a9ab0', fontSize: 13, marginTop: 4 },

  postCard: { backgroundColor: '#111e2e', padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1a2d42' },
  postTitle: { color: '#e8f4f8', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  postContent: { color: '#aab8c8', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  postFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postFooterText: { color: '#7a9ab0', fontSize: 12 },
  postDate: { color: '#7a9ab0', fontSize: 12, marginLeft: 'auto' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#080f1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '90%', borderWidth: 1, borderColor: '#1a2d42' },
  modalHeader: { alignItems: 'flex-end', marginBottom: 10 },

  avatarBig: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#0a2a40', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#00ADD8' },
  avatarBigText: { color: '#00ADD8', fontSize: 28, fontWeight: 'bold' },
  profileName: { color: '#e8f4f8', fontSize: 22, fontWeight: '700' },

  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  privateBadgeText: { color: '#7a9ab0', fontSize: 13 },

  followBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginHorizontal: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  followBtnText: { fontSize: 15, fontWeight: 'bold' },

  modalContentList: { backgroundColor: '#111e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '60%', borderWidth: 1, borderColor: '#1a2d42' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a2d42' },
  modalTitleList: { color: '#e8f4f8', fontSize: 18, fontWeight: 'bold' },
  emptyList: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  userCardList: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a2d42' },
  userAvatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0a2a40', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarTextSmall: { color: '#00ADD8', fontWeight: 'bold', fontSize: 14 },

  loadMoreBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: '#1a2d42', borderRadius: 14, backgroundColor: 'rgba(0, 173, 216, 0.05)' },
  loadMoreText: { color: '#00ADD8', fontSize: 14, fontWeight: '600' }
});