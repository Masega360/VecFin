import React, { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, RefreshControl,
    LayoutAnimation, Platform, UIManager
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// Habilitar animaciones en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface InAppNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export default function NotificationsTab() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Estado para guardar qué notificaciones están desplegadas
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const fetchNotifications = async () => {
        try {
            const token = await getValidToken();
            if (!token) return;

            const res = await fetch(`${API_URL}/notifications/inapp`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setNotifications(await res.json());
            }
        } catch (e) {
            console.error('Error fetching notifications:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    const handleToggleExpand = async (notif: InAppNotification) => {
        // Configurar una animación suave para el despliegue
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        // Toggle: Si está abierta la cerramos, si está cerrada la abrimos
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(notif.id)) {
            newExpanded.delete(notif.id);
        } else {
            newExpanded.add(notif.id);
        }
        setExpandedIds(newExpanded);

        // Marcar como leído en background si no lo estaba
        if (!notif.is_read) {
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            try {
                const token = await getValidToken();
                fetch(`${API_URL}/notifications/inapp/${notif.id}/read`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch (e) {
                console.error('Error marking as read:', e);
            }
        }
    };

    const handleNavigate = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('comunidad') || t.includes('solicitud en')) {
            router.setParams({ tab: 'community' });
        } else if (t.includes('seguimiento')) {
            router.setParams({ tab: 'profile' });
        } else if (t.includes('alerta de')) {
            router.setParams({ tab: 'dashboard' });
        } else if (t.includes('post') || t.includes('publicación')) {
            router.setParams({ tab: 'community' });
        }
    };

    const getActionText = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('seguimiento')) return 'Revisar solicitudes';
        if (t.includes('alerta de')) return 'Ver en Dashboard';
        if (t.includes('comunidad') || t.includes('solicitud en')) return 'Ir a la comunidad';
        return 'Ver detalles';
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#00ADD8" />
            </View>
        );
    }

    return (
        <View style={s.root}>
            <FlatList
                data={notifications}
                keyExtractor={item => item.id}
                contentContainerStyle={s.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00ADD8" />
                }
                ListEmptyComponent={
                    <View style={s.emptyBox}>
                        <MaterialIcons name="notifications-none" size={56} color="#1e3a5a" />
                        <Text style={s.emptyTitle}>Estás al día</Text>
                        <Text style={s.emptyText}>No tienes notificaciones nuevas por ahora.</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const isExpanded = expandedIds.has(item.id);

                    return (
                        <TouchableOpacity
                            style={[s.card, !item.is_read && s.cardUnread]}
                            onPress={() => handleToggleExpand(item)}
                            activeOpacity={0.8}
                        >
                            <View style={s.iconBox}>
                                <MaterialIcons
                                    name={item.title.toLowerCase().includes('alerta') ? "trending-up" : "notifications"}
                                    size={22}
                                    color={!item.is_read ? "#00ADD8" : "#4a6a80"}
                                />
                            </View>

                            <View style={s.cardBody}>
                                <View style={s.headerRow}>
                                    <Text style={[s.title, !item.is_read && s.titleUnread]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={s.time}>{formatDate(item.created_at)}</Text>
                                </View>

                                {/* Si está expandido mostramos todo el texto, si no, solo 2 líneas */}
                                <Text style={s.message} numberOfLines={isExpanded ? undefined : 2}>
                                    {item.message}
                                </Text>

                                {/* Botón de acción que solo aparece cuando la tarjeta se despliega */}
                                {isExpanded && (
                                    <TouchableOpacity
                                        style={s.actionBtn}
                                        onPress={() => handleNavigate(item.title)}
                                    >
                                        <Text style={s.actionBtnText}>{getActionText(item.title)}</Text>
                                        <MaterialIcons name="arrow-forward" size={16} color="#00ADD8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {!item.is_read && <View style={s.unreadDot} />}
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#080f1a' },
    list: { padding: 16, gap: 12 },
    card: {
        flexDirection: 'row',
        backgroundColor: '#111e2e',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#1a2d42',
        alignItems: 'flex-start',
        gap: 12,
    },
    cardUnread: {
        backgroundColor: '#0c1a29',
        borderColor: 'rgba(0,173,216,0.3)',
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0a1628',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1a2d42',
    },
    cardBody: { flex: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { color: '#aab8c8', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
    titleUnread: { color: '#e8f4f8', fontWeight: '700' },
    time: { color: '#4a6a80', fontSize: 12 },
    message: { color: '#7a9ab0', fontSize: 13, lineHeight: 18 },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00ADD8',
        marginTop: 6,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(0,173,216,0.1)',
        borderRadius: 8,
        gap: 4,
    },
    actionBtnText: {
        color: '#00ADD8',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyBox: { alignItems: 'center', marginTop: 80, gap: 10, paddingHorizontal: 40 },
    emptyTitle: { color: '#4a6a80', fontSize: 18, fontWeight: '700' },
    emptyText: { color: '#3d5a70', textAlign: 'center', fontSize: 14, lineHeight: 20 },
});