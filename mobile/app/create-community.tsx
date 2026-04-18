import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, ActivityIndicator, Switch, ScrollView,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

export default function CreateCommunityScreen() {
    const router = useRouter();

    // Estados del formulario
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [rules, setRules] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);

    // Estados de la UI
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        // 1. Validaciones básicas
        if (!name.trim()) {
            setError('El nombre de la comunidad es obligatorio.');
            return;
        }
        if (!description.trim()) {
            setError('Añade una breve descripción para tu comunidad.');
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

            // 2. Enviar petición al backend
            const res = await fetch(`${API_URL}/communities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                    rules: rules.trim(),
                    logo_url: logoUrl.trim(),
                    is_private: isPrivate,
                }),
            });

            if (res.ok) {
                // ¡Éxito! Volvemos a la pantalla anterior
                router.back();
            } else {
                const errorText = await res.text();
                setError(`Error al crear: ${errorText}`);
            }
        } catch (err) {
            setError('Sin conexión al servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nueva Comunidad</Text>
                <View style={{ width: 24 }} />
            </View>


            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                    <Text style={styles.infoText}>
                        Crea un espacio para debatir y compartir sobre tus temas financieros favoritos.
                    </Text>

                    {/* Nombre */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre de la Comunidad <Text style={styles.required}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Inversores Argentina"
                            placeholderTextColor="#4a6a80"
                            value={name}
                            onChangeText={setName}
                            maxLength={64}
                        />
                    </View>

                    {/* Descripción */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Descripción <Text style={styles.required}>*</Text></Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="¿De qué trata esta comunidad?"
                            placeholderTextColor="#4a6a80"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Reglas */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Reglas (Opcional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="1. Respeto ante todo..."
                            placeholderTextColor="#4a6a80"
                            value={rules}
                            onChangeText={setRules}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Logo URL */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>URL del Logo (Opcional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://ejemplo.com/logo.png"
                            placeholderTextColor="#4a6a80"
                            value={logoUrl}
                            onChangeText={setLogoUrl}
                            keyboardType="url"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Switch de Privacidad */}
                    <View style={styles.switchGroup}>
                        <View style={styles.switchTextContainer}>
                            <Text style={styles.labelSwitch}>Comunidad Privada</Text>
                            <Text style={styles.subLabelSwitch}>
                                {isPrivate
                                    ? "Solo los miembros aprobados podrán ver y crear posts."
                                    : "Cualquiera podrá ver los posts y unirse libremente."}
                            </Text>
                        </View>
                        <Switch
                            trackColor={{ false: '#132238', true: '#00ADD8' }}
                            thumbColor={'#fff'}
                            ios_backgroundColor="#132238"
                            onValueChange={setIsPrivate}
                            value={isPrivate}
                        />
                    </View>

                    {/* Mensaje de Error */}
                    {error ? (
                        <View style={styles.errorBox}>
                            <MaterialIcons name="error-outline" size={16} color="#ff6666" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Botón de Submit */}
                    <TouchableOpacity
                        style={styles.createBtn}
                        onPress={handleCreate}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.createBtnText}>Crear Comunidad</Text>
                        )}
                    </TouchableOpacity>

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
        borderBottomWidth: 1,
        borderBottomColor: '#132238',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    infoText: {
        color: '#8aaabf',
        fontSize: 14,
        marginBottom: 24,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#8aaabf',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    required: {
        color: '#ff6666',
    },
    input: {
        backgroundColor: '#132238',
        borderWidth: 1,
        borderColor: '#1e3a5a',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#fff',
        fontSize: 15,
    },
    textArea: {
        minHeight: 100,
        paddingTop: 14, // Para que el texto no se pegue arriba en multiline
    },
    switchGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#132238',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1e3a5a',
        marginBottom: 24,
    },
    switchTextContainer: {
        flex: 1,
        paddingRight: 16,
    },
    labelSwitch: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    subLabelSwitch: {
        color: '#8aaabf',
        fontSize: 12,
        lineHeight: 16,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 102, 102, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        gap: 8,
    },
    errorText: {
        color: '#ff6666',
        fontSize: 13,
        flex: 1,
    },
    createBtn: {
        backgroundColor: '#00ADD8',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#00ADD8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    createBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});