import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, ActivityIndicator, ScrollView,
    KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Limits (espejados del domain Go) ────────────────────────────────────────
const NAME_MAX = 64;
const DESC_MAX = 512;
const RULES_MAX = 512;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function charCounter(value: string, max: number) {
    const left = max - value.length;
    const isNear = left <= max * 0.15; // últimos 15%
    return { left, isNear };
}

// ─── Field Component ──────────────────────────────────────────────────────────

function Field({
                   label,
                   required,
                   hint,
                   value,
                   onChangeText,
                   placeholder,
                   multiline,
                   max,
                   keyboardType,
                   autoCapitalize,
                   error,
               }: {
    label: string;
    required?: boolean;
    hint?: string;
    value: string;
    onChangeText: (t: string) => void;
    placeholder: string;
    multiline?: boolean;
    max?: number;
    keyboardType?: any;
    autoCapitalize?: any;
    error?: string;
}) {
    const counter = max ? charCounter(value, max) : null;

    return (
        <View style={f.group}>
            <View style={f.labelRow}>
                <Text style={f.label}>
                    {label}
                    {required && <Text style={f.required}> *</Text>}
                </Text>
                {counter && (
                    <Text style={[f.counter, counter.isNear && f.counterNear]}>
                        {counter.left}
                    </Text>
                )}
            </View>
            {hint && <Text style={f.hint}>{hint}</Text>}
            <TextInput
                style={[
                    f.input,
                    multiline && f.textarea,
                    !!error && f.inputError,
                ]}
                placeholder={placeholder}
                placeholderTextColor="#3d5a70"
                value={value}
                onChangeText={onChangeText}
                multiline={multiline}
                numberOfLines={multiline ? 4 : 1}
                textAlignVertical={multiline ? 'top' : 'center'}
                maxLength={max}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize ?? 'sentences'}
            />
            {error ? (
                <View style={f.errorRow}>
                    <MaterialIcons name="error-outline" size={13} color="#e05c5c" />
                    <Text style={f.errorText}>{error}</Text>
                </View>
            ) : null}
        </View>
    );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleRow({
                       label,
                       sub,
                       value,
                       onChange,
                   }: {
    label: string;
    sub: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <TouchableOpacity style={t.row} onPress={() => onChange(!value)} activeOpacity={0.8}>
            <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={t.label}>{label}</Text>
                <Text style={t.sub}>{sub}</Text>
            </View>
            <View style={[t.track, value && t.trackOn]}>
                <View style={[t.knob, value && t.knobOn]} />
            </View>
        </TouchableOpacity>
    );
}

// ─── Topic Input ──────────────────────────────────────────────────────────────

function TopicsInput({
                         topics,
                         onChange,
                     }: {
    topics: string[];
    onChange: (ts: string[]) => void;
}) {
    const [input, setInput] = useState('');

    const add = () => {
        const trimmed = input.trim().toLowerCase().replace(/\s+/g, '-');
        if (!trimmed || topics.includes(trimmed) || topics.length >= 5) return;
        onChange([...topics, trimmed]);
        setInput('');
    };

    const remove = (topic: string) => onChange(topics.filter(t => t !== topic));

    return (
        <View style={tp.group}>
            <View style={tp.labelRow}>
                <Text style={tp.label}>Temas</Text>
                <Text style={tp.counter}>{topics.length}/5</Text>
            </View>
            <Text style={tp.hint}>Etiquetas para que otros encuentren tu comunidad</Text>

            <View style={tp.inputRow}>
                <TextInput
                    style={tp.input}
                    placeholder="crypto, acciones, noticias..."
                    placeholderTextColor="#3d5a70"
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={add}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={topics.length < 5}
                />
                <TouchableOpacity
                    style={[tp.addBtn, (!input.trim() || topics.length >= 5) && tp.addBtnDisabled]}
                    onPress={add}
                    disabled={!input.trim() || topics.length >= 5}
                >
                    <MaterialIcons name="add" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {topics.length > 0 && (
                <View style={tp.pills}>
                    {topics.map(topic => (
                        <TouchableOpacity
                            key={topic}
                            style={tp.pill}
                            onPress={() => remove(topic)}
                        >
                            <Text style={tp.pillText}>#{topic}</Text>
                            <MaterialIcons name="close" size={13} color="#7a9ab0" />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateCommunityScreen() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [rules, setRules] = useState('');
    const [topics, setTopics] = useState<string[]>([]);
    const [logoUrl, setLogoUrl] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Validaciones espejadas del usecase Go
    const validate = (): boolean => {
        const errs: Record<string, string> = {};

        if (!name.trim()) errs.name = 'El nombre es obligatorio';
        else if (name.length >= NAME_MAX) errs.name = `Máximo ${NAME_MAX - 1} caracteres`;

        if (!description.trim()) errs.description = 'La descripción es obligatoria';
        else if (description.length >= DESC_MAX) errs.description = `Máximo ${DESC_MAX - 1} caracteres`;

        if (!rules.trim()) errs.rules = 'Las reglas son obligatorias';
        else if (rules.length >= RULES_MAX) errs.rules = `Máximo ${RULES_MAX - 1} caracteres`;

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreate = async () => {
        if (!validate()) return;

        setLoading(true);
        try {
            const token = await getValidToken();
            if (!token) {
                Alert.alert('Error', 'No estás autenticado.');
                return;
            }

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
                    topics,
                    logo_url: logoUrl.trim(),
                    is_private: isPrivate,
                }),
            });

            if (res.ok) {
                router.back();
            } else {
                const errorText = await res.text();
                Alert.alert('Error', errorText || 'No se pudo crear la comunidad.');
            }
        } catch {
            Alert.alert('Error', 'Sin conexión al servidor.');
        } finally {
            setLoading(false);
        }
    };

    const clearError = (field: string) =>
        setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });

    return (
        <SafeAreaView style={s.root}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <MaterialIcons name="close" size={24} color="#e8f4f8" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Nueva Comunidad</Text>
                <TouchableOpacity
                    style={[s.headerBtn, loading && { opacity: 0.5 }]}
                    onPress={handleCreate}
                    disabled={loading}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.headerBtnText}>Crear</Text>
                    }
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={s.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={s.intro}>
                        Creá un espacio para debatir y compartir sobre tus temas financieros favoritos.
                    </Text>

                    <Field
                        label="Nombre"
                        required
                        placeholder="Ej: Inversores Argentina"
                        value={name}
                        onChangeText={t => { setName(t); clearError('name'); }}
                        max={NAME_MAX}
                        error={errors.name}
                    />

                    <Field
                        label="Descripción"
                        required
                        hint="Contá de qué trata tu comunidad"
                        placeholder="Una comunidad para debatir..."
                        value={description}
                        onChangeText={t => { setDescription(t); clearError('description'); }}
                        multiline
                        max={DESC_MAX}
                        error={errors.description}
                    />

                    <Field
                        label="Reglas"
                        required
                        hint="Definí las normas de convivencia"
                        placeholder="1. Respeto ante todo&#10;2. No spam&#10;3. Contenido relevante"
                        value={rules}
                        onChangeText={t => { setRules(t); clearError('rules'); }}
                        multiline
                        max={RULES_MAX}
                        error={errors.rules}
                    />

                    <TopicsInput topics={topics} onChange={setTopics} />

                    <Field
                        label="URL del logo"
                        hint="Opcional · Link directo a una imagen"
                        placeholder="https://ejemplo.com/logo.png"
                        value={logoUrl}
                        onChangeText={setLogoUrl}
                        keyboardType="url"
                        autoCapitalize="none"
                    />

                    <View style={s.section}>
                        <ToggleRow
                            label="Comunidad privada"
                            sub={
                                isPrivate
                                    ? 'Los nuevos miembros necesitan aprobación'
                                    : 'Cualquiera puede unirse libremente'
                            }
                            value={isPrivate}
                            onChange={setIsPrivate}
                        />
                    </View>

                    {isPrivate && (
                        <View style={s.infoBox}>
                            <MaterialIcons name="info-outline" size={16} color="#00b4d8" />
                            <Text style={s.infoText}>
                                Como líder podrás aprobar o rechazar cada solicitud de ingreso desde la sección de Gestión.
                            </Text>
                        </View>
                    )}

                    {/* Bottom spacer para que el scroll no quede cortado */}
                    <View style={{ height: 20 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ─── Field Styles ─────────────────────────────────────────────────────────────

const f = StyleSheet.create({
    group: { gap: 6 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: '#7a9ab0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    required: { color: '#e05c5c' },
    hint: { color: '#3d5a70', fontSize: 12, marginTop: -2 },
    counter: { color: '#3d5a70', fontSize: 12 },
    counterNear: { color: '#f5a623' },
    input: {
        backgroundColor: '#111e2e',
        borderWidth: 1,
        borderColor: '#1a2d42',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        color: '#e8f4f8',
        fontSize: 15,
    },
    textarea: { minHeight: 100, paddingTop: 13 },
    inputError: { borderColor: '#e05c5c' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    errorText: { color: '#e05c5c', fontSize: 12 },
});

// ─── Toggle Styles ────────────────────────────────────────────────────────────

const t = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111e2e',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1a2d42',
    },
    label: { color: '#e8f4f8', fontSize: 15, fontWeight: '600', marginBottom: 3 },
    sub: { color: '#7a9ab0', fontSize: 12, lineHeight: 16 },
    track: {
        width: 48,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#1a2d42',
        padding: 3,
        justifyContent: 'center',
    },
    trackOn: { backgroundColor: '#00b4d8' },
    knob: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#3d5a70',
    },
    knobOn: { backgroundColor: '#fff', marginLeft: 20 },
});

// ─── Topics Styles ────────────────────────────────────────────────────────────

const tp = StyleSheet.create({
    group: { gap: 6 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: '#7a9ab0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    counter: { color: '#3d5a70', fontSize: 12 },
    hint: { color: '#3d5a70', fontSize: 12, marginTop: -2 },
    inputRow: { flexDirection: 'row', gap: 8 },
    input: {
        flex: 1,
        backgroundColor: '#111e2e',
        borderWidth: 1,
        borderColor: '#1a2d42',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        color: '#e8f4f8',
        fontSize: 15,
    },
    addBtn: {
        backgroundColor: '#00b4d8',
        width: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtnDisabled: { backgroundColor: '#1a2d42' },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0a2030',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a2d42',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    pillText: { color: '#7a9ab0', fontSize: 13, fontWeight: '500' },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#080f1a',
        paddingTop: Platform.OS === 'android' ? 32 : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1a2d42',
        backgroundColor: '#0d1826',
    },
    headerTitle: { color: '#e8f4f8', fontSize: 17, fontWeight: '700' },
    headerBtn: {
        backgroundColor: '#00b4d8',
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 10,
        minWidth: 64,
        alignItems: 'center',
    },
    headerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    content: { padding: 20, gap: 20 },
    intro: { color: '#7a9ab0', fontSize: 14, lineHeight: 21 },

    section: { gap: 0 },

    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: 'rgba(0,180,216,0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,180,216,0.2)',
        padding: 14,
    },
    infoText: { flex: 1, color: '#7a9ab0', fontSize: 13, lineHeight: 19 },
});
