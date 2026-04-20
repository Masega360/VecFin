import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, ActivityIndicator, KeyboardAvoidingView,
    Platform, ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

export default function CreatePostScreen() {
    const router = useRouter();
    // Atrapamos el ID de la comunidad que le pasamos desde la pantalla anterior
    const { communityId } = useLocalSearchParams<{ communityId: string }>();

    // Estados del formulario
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [linkUrl, setLinkUrl] = useState(''); // El nuevo campo URL

    // Estados de UI
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreatePost = async () => {
        // 1. Validaciones del frontend
        if (!communityId) {
            setError('Error crítico: No se encontró la comunidad.');
            return;
        }
        if (!title.trim()) {
            setError('El post debe tener un título.');
            return;
        }
        if (!content.trim()) {
            setError('Debes escribir algo en el contenido.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const token = await getValidToken();
            if (!token) {
                setError('No estás autenticado.');
                setLoading(false);
                return;
            }

            // 2. Armamos el payload exacto que pide tu PostHandler en Go
            const payload = {
                community_id: communityId,
                title: title.trim(),
                content: content.trim(),
                url: linkUrl.trim(),
            };

            // 3. Petición al backend
            const res = await fetch(`${API_URL}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                // Éxito: volvemos a la pantalla de la comunidad
                router.back();
            } else {
                const errorText = await res.text();
                setError(`Error al publicar: ${errorText}`);
            }
        } catch (err) {
            setError('Sin conexión al servidor. Revisa tu red.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.root}>
            {/* Cabecera estilo Modal */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={loading}>
                    <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Crear Post</Text>

                {/* Botón de Publicar */}
                <TouchableOpacity
                    onPress={handleCreatePost}
                    disabled={loading || !title.trim() || !content.trim()}
                    style={[
                        styles.publishBtn,
                        (!title.trim() || !content.trim()) && styles.publishBtnDisabled
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.publishBtnText}>Publicar</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.formContainer}
                    keyboardShouldPersistTaps="handled"
                >

                    {error ? (
                        <View style={styles.errorBox}>
                            <MaterialIcons name="error-outline" size={16} color="#ff6666" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Título */}
                    <TextInput
                        style={styles.titleInput}
                        placeholder="Un título interesante..."
                        placeholderTextColor="#4a6a80"
                        value={title}
                        onChangeText={setTitle}
                        maxLength={120}
                        multiline
                    />

                    <View style={styles.divider} />

                    {/* Contenido */}
                    <TextInput
                        style={styles.contentInput}
                        placeholder="Escribe lo que estás pensando..."
                        placeholderTextColor="#4a6a80"
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                    />

                    <View style={styles.divider} />

                    {/* URL Opcional */}
                    <View style={styles.urlContainer}>
                        <MaterialIcons name="link" size={20} color="#4a6a80" />
                        <TextInput
                            style={styles.urlInput}
                            placeholder="Añadir un enlace (opcional)"
                            placeholderTextColor="#4a6a80"
                            value={linkUrl}
                            onChangeText={setLinkUrl}
                            keyboardType="url"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0a1628',
        paddingTop: Platform.OS === 'android' ? 32 : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#132238',
        borderBottomWidth: 1,
        borderBottomColor: '#1e3a5a',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    publishBtn: {
        backgroundColor: '#00ADD8',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    publishBtnDisabled: {
        backgroundColor: '#1e3a5a',
    },
    publishBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    formContainer: {
        padding: 20,
        flexGrow: 1,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 102, 102, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    errorText: {
        color: '#ff6666',
        fontSize: 13,
        flex: 1,
    },
    titleInput: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#1e3a5a',
        marginBottom: 16,
    },
    contentInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        lineHeight: 24,
        minHeight: 150,
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#132238',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#1e3a5a',
        gap: 8,
    },
    urlInput: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
    },
});