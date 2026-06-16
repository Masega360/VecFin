// src/components/AppTextInput.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface AppTextInputProps extends TextInputProps {
    label?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    maxLength: number; // Ahora es obligatorio en todos lados
}

export default function AppTextInput({
                                         label, required, hint, error, value = '', maxLength, multiline, ...props
                                     }: AppTextInputProps) {

    // Lógica del contador
    const left = maxLength - value.length;
    const isNear = left <= maxLength * 0.15; // Se pone naranja al 15% restante

    return (
        <View style={styles.group}>
            {(label || maxLength) && (
                <View style={styles.labelRow}>
                    {label && (
                        <Text style={styles.label}>
                            {label}{required && <Text style={styles.required}> *</Text>}
                        </Text>
                    )}
                    <Text style={[styles.counter, isNear && styles.counterNear, left < 0 && styles.counterError]}>
                        {left >= 0 ? left : 0}
                    </Text>
                </View>
            )}

            {hint && <Text style={styles.hint}>{hint}</Text>}

            <TextInput
                style={[
                    styles.input,
                    multiline && styles.textarea,
                    !!error && styles.inputError,
                ]}
                value={value}
                maxLength={maxLength}
                multiline={multiline}
                numberOfLines={multiline ? 4 : 1}
                textAlignVertical={multiline ? 'top' : 'center'}
                placeholderTextColor="#3d5a70"
                {...props}
            />

            {error ? (
                <View style={styles.errorRow}>
                    <MaterialIcons name="error-outline" size={13} color="#e05c5c" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    group: { gap: 6, marginBottom: 15 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: '#7a9ab0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    required: { color: '#e05c5c' },
    hint: { color: '#3d5a70', fontSize: 12, marginTop: -2 },
    counter: { color: '#3d5a70', fontSize: 12 },
    counterNear: { color: '#f5a623' },
    counterError: { color: '#e05c5c' },
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