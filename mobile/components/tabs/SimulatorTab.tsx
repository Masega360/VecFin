import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, Keyboard, ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialPlan {
    id: string;
    financier_name: string;
    name: string;
    type: string;
    tna: number;
    min_days: number;
    min_amount: number;
}

interface SimulationResult {
    plan: FinancialPlan;
    initial_amount: number;
    final_amount: number;
    interest_earned: number;

    // Nuevos campos agregados en el frontend
    actual_tna?: number;
    tea?: number;
    annual_interest?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authFetch(url: string, opts: RequestInit = {}) {
    const token = await getValidToken();
    return fetch(url, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(opts.headers ?? {}),
        },
    });
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultCard({ item }: { item: SimulationResult }) {
    const isFCI = item.plan.type === 'fci';

    return (
        <View style={s.card}>
            <View style={s.cardHeader}>
                <View style={s.avatarBox}>
                    <MaterialIcons
                        name={isFCI ? "account-balance-wallet" : "account-balance"}
                        size={20}
                        color="#00b4d8"
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.financierName}>{item.plan.financier_name}</Text>
                    <Text style={s.planName}>{item.plan.name}</Text>
                </View>

                {/* Mostramos ambas tasas: TNA y TEA */}
                <View style={s.badgesContainer}>
                    <View style={s.tnaBadge}>
                        <Text style={s.tnaText}>TNA {item.actual_tna?.toFixed(2)}%</Text>
                    </View>
                    <View style={[s.tnaBadge, s.teaBadge]}>
                        <Text style={[s.tnaText, s.teaText]}>TEA {item.tea?.toFixed(2)}%</Text>
                    </View>
                </View>
            </View>

            <View style={s.resultsGrid}>
                <View style={s.resultItem}>
                    <Text style={s.resultLabel}>Capital Inicial</Text>
                    <Text style={s.resultValueSmall}>{formatCurrency(item.initial_amount)}</Text>
                </View>
                <View style={s.resultDivider} />
                <View style={s.resultItem}>
                    <Text style={s.resultLabel}>Interés Período</Text>
                    <Text style={s.resultValueSmall}>+{formatCurrency(item.interest_earned)}</Text>
                </View>
                <View style={s.resultDivider} />
                <View style={s.resultItem}>
                    <Text style={s.resultLabel}>Est. Anual</Text>
                    <Text style={[s.resultValueSmall, { color: '#34c78a' }]}>
                        +{formatCurrency(item.annual_interest || 0)}
                    </Text>
                </View>
            </View>

            <View style={s.finalAmountBox}>
                <Text style={s.finalAmountLabel}>Monto Final (al vto.)</Text>
                <Text style={s.finalAmountValue}>{formatCurrency(item.final_amount)}</Text>
            </View>
        </View>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PRESET_DAYS = [30, 60, 90, 180, 270, 365];

export default function SimulatorTab() {
    const [amount, setAmount] = useState('');
    const [days, setDays] = useState('30');
    const [isCustomDay, setIsCustomDay] = useState(false);

    const [results, setResults] = useState<SimulationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const calculate = async () => {
        Keyboard.dismiss();
        setError('');

        const numAmount = parseFloat(amount.replace(/,/g, ''));
        const numDays = parseInt(days, 10);

        if (!numAmount || numAmount <= 0) {
            setError('Ingresá un monto válido mayor a 0');
            return;
        }
        if (!numDays || numDays <= 0) {
            setError('Ingresá una cantidad de días válida');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setResults([]);

        try {
            // Reutilizamos tu endpoint existente para traer los planes
            const res = await authFetch(`${API_URL}/simulator/calculate`, {
                method: 'POST',
                body: JSON.stringify({ amount: numAmount, days: numDays })
            });

            if (res.ok) {
                const data: SimulationResult[] = await res.json();

                // --- LÓGICA FINANCIERA EN FRONTEND ---
                const recalculated = data.map(item => {
                    const plan = item.plan;
                    const isFCI = plan.type === 'fci';

                    // 1. Curva de rendimientos (solo aplica a Plazos Fijos)
                    let actualTNA = plan.tna;
                    if (!isFCI) {
                        if (numDays >= 365) actualTNA += 8;
                        else if (numDays >= 270) actualTNA += 6;
                        else if (numDays >= 180) actualTNA += 4;
                        else if (numDays >= 90) actualTNA += 2;
                        else if (numDays >= 60) actualTNA += 1;
                    }

                    // 2. Cálculos matemáticos
                    const tnaDecimal = actualTNA / 100;
                    const interest = numAmount * tnaDecimal * (numDays / 365);
                    const finalAmount = numAmount + interest;

                    // 3. Tasa Efectiva Anual (TEA) - Fórmula de capitalización compuesta
                    const periodos = 365 / numDays;
                    const teaDecimal = Math.pow(1 + (tnaDecimal / periodos), periodos) - 1;
                    const tea = teaDecimal * 100;

                    // 4. Proyección de interés a 1 año (Capitalización compuesta)
                    const annualInterest = numAmount * teaDecimal;

                    return {
                        ...item,
                        initial_amount: numAmount,
                        final_amount: finalAmount,
                        interest_earned: interest,
                        actual_tna: actualTNA,
                        tea: tea,
                        annual_interest: annualInterest
                    };
                });

                // Ordenamos por la ganancia final
                const sorted = recalculated.sort((a, b) => b.final_amount - a.final_amount);
                setResults(sorted);
            } else {
                setError(await res.text() || 'Error al calcular los rendimientos');
            }
        } catch {
            setError('Sin conexión al servidor');
        } finally {
            setLoading(false);
        }
    };

    const headerComponent = (
        <View style={s.headerContainer}>
            <View style={s.formCard}>
                <View style={s.inputGroup}>
                    <Text style={s.label}>Monto a invertir (ARS)</Text>
                    <View style={s.inputWrapper}>
                        <Text style={s.currencyPrefix}>$</Text>
                        <TextInput
                            style={s.input}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor="#3d5a70"
                            returnKeyType="done"
                        />
                    </View>
                </View>

                <View style={s.inputGroup}>
                    <Text style={s.label}>Plazo (Días)</Text>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={s.daysScroll}
                        contentContainerStyle={s.daysRow}
                    >
                        {PRESET_DAYS.map(d => {
                            const isActive = days === String(d) && !isCustomDay;
                            return (
                                <TouchableOpacity
                                    key={d}
                                    style={[s.dayPill, isActive && s.dayPillActive]}
                                    onPress={() => {
                                        setDays(String(d));
                                        setIsCustomDay(false);
                                    }}
                                >
                                    <Text style={[s.dayPillText, isActive && s.dayPillTextActive]}>{d}</Text>
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity
                            style={[s.dayPill, isCustomDay && s.dayPillActive]}
                            onPress={() => setIsCustomDay(true)}
                        >
                            <Text style={[s.dayPillText, isCustomDay && s.dayPillTextActive]}>Otro</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {isCustomDay && (
                        <View style={[s.inputWrapper, { marginTop: 8 }]}>
                            <MaterialIcons name="date-range" size={18} color="#7a9ab0" style={s.inputIcon} />
                            <TextInput
                                style={s.input}
                                value={days}
                                onChangeText={setDays}
                                keyboardType="number-pad"
                                placeholder="Ej: 45"
                                placeholderTextColor="#3d5a70"
                                returnKeyType="done"
                                autoFocus
                            />
                        </View>
                    )}
                </View>

                {error ? (
                    <View style={s.errorRow}>
                        <MaterialIcons name="error-outline" size={14} color="#e05c5c" />
                        <Text style={s.errorText}>{error}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[s.calcBtn, loading && s.calcBtnDisabled]}
                    onPress={calculate}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={s.calcBtnText}>Simular Rendimientos</Text>
                    )}
                </TouchableOpacity>
            </View>

            {hasSearched && !loading && (
                <Text style={s.resultsTitle}>Mejores opciones para {days} días</Text>
            )}
        </View>
    );

    return (
        <View style={s.root}>
            <FlatList
                data={results}
                keyExtractor={(item) => item.plan.id}
                renderItem={({ item }) => <ResultCard item={item} />}
                contentContainerStyle={s.list}
                ListHeaderComponent={headerComponent}
                ListEmptyComponent={
                    hasSearched && !loading && !error ? (
                        <View style={s.emptyBox}>
                            <MaterialIcons name="money-off" size={48} color="#1e3a5a" />
                            <Text style={s.emptyText}>
                                No hay planes disponibles para este monto o plazo.
                            </Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#080f1a' },
    list: { padding: 16, paddingBottom: 40, gap: 12 },

    headerContainer: {
        marginBottom: 8,
    },
    formCard: {
        backgroundColor: '#0d1826',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1a2d42',
        gap: 16,
        marginBottom: 16,
    },
    inputGroup: {
        gap: 6,
    },
    label: {
        color: '#7a9ab0',
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    daysScroll: {
        marginTop: 4,
        marginHorizontal: -16, // Para que el scroll llegue al borde
        paddingHorizontal: 16,
    },
    daysRow: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 32, // Espacio al final del scroll
    },
    dayPill: {
        backgroundColor: '#111e2e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1a2d42',
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 54,
    },
    dayPillActive: {
        backgroundColor: 'rgba(0,180,216,0.1)',
        borderColor: '#00b4d8',
    },
    dayPillText: {
        color: '#7a9ab0',
        fontSize: 14,
        fontWeight: '600',
    },
    dayPillTextActive: {
        color: '#00b4d8',
    },

    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111e2e',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1a2d42',
        height: 52,
        paddingHorizontal: 14,
    },
    currencyPrefix: {
        color: '#e8f4f8',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: '#e8f4f8',
        fontSize: 18,
        fontWeight: '600',
        height: '100%',
    },
    calcBtn: {
        backgroundColor: '#00b4d8',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        shadowColor: '#00b4d8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
        marginTop: 4,
    },
    calcBtnDisabled: {
        opacity: 0.7,
    },
    calcBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: -4,
    },
    errorText: {
        color: '#e05c5c',
        fontSize: 13,
    },

    resultsTitle: {
        color: '#e8f4f8',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
        marginLeft: 4,
    },

    card: {
        backgroundColor: '#111e2e',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1a2d42',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
    },
    avatarBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#0a2a40',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1a2d42',
    },
    financierName: {
        color: '#e8f4f8',
        fontWeight: '700',
        fontSize: 15,
        marginTop: 2,
    },
    planName: {
        color: '#7a9ab0',
        fontSize: 13,
        marginTop: 2,
    },
    badgesContainer: {
        alignItems: 'flex-end',
        gap: 4,
    },
    tnaBadge: {
        backgroundColor: 'rgba(0,180,216,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(0,180,216,0.3)',
    },
    teaBadge: {
        backgroundColor: 'rgba(52,199,138,0.1)',
        borderColor: 'rgba(52,199,138,0.3)',
    },
    tnaText: {
        color: '#00b4d8',
        fontSize: 11,
        fontWeight: '700',
    },
    teaText: {
        color: '#34c78a',
    },

    resultsGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d1826',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    resultItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    resultDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#1a2d42',
    },
    resultLabel: {
        color: '#7a9ab0',
        fontSize: 10,
        textTransform: 'uppercase',
        fontWeight: '600',
        textAlign: 'center',
    },
    resultValueSmall: {
        color: '#e8f4f8',
        fontSize: 13,
        fontWeight: '700',
    },

    finalAmountBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#1a2d42',
        paddingTop: 12,
    },
    finalAmountLabel: {
        color: '#e8f4f8',
        fontSize: 14,
        fontWeight: '600',
    },
    finalAmountValue: {
        color: '#34c78a',
        fontSize: 18,
        fontWeight: '700',
    },

    emptyBox: {
        alignItems: 'center',
        marginTop: 40,
        gap: 10,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: '#3d5a70',
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
    },
});