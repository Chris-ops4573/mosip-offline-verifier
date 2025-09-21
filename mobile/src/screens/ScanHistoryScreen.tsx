import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchScanHistory } from '../api/endpoints';
import { ScanOut } from '../types';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<any>;

const colors = {
    bg: "#0b0d12",
    card: "#12151b",
    border: "#232a35",
    text: "#F2F4F7",
    muted: "#9AA3AD",
    accent: "#0A84FF",
    success: "#30D158",
    danger: "#FF453A",
};

export default function ScanHistoryScreen({ navigation }: Props) {
    const [scans, setScans] = useState<ScanOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadHistory() {
            try {
                setLoading(true);
                const history = await fetchScanHistory();
                setScans(history);
            } catch (e: any) {
                setError(e?.message || "Failed to fetch scan history.");
            } finally {
                setLoading(false);
            }
        }
        loadHistory();
    }, []);

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            {/* Ornaments */}
            <View style={styles.ornamentTop} />
            <View style={styles.ornamentBottom} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Scan History</Text>
                <Text style={styles.subtitle}>
                    A log of all credentials scanned by this app.
                </Text>

                {/* Back to Scan */}
                <Pressable
                    onPress={() => navigation.navigate("Scan")}
                    hitSlop={8}
                    android_ripple={{ color: "rgba(255,255,255,0.10)" }}
                    style={({ pressed }) => [
                        styles.button,
                        styles.buttonOutline,
                        pressed && styles.pressed,
                        { alignSelf: "flex-start", marginTop: 12 }
                    ]}
                >
                    <Text style={styles.buttonOutlineText}>← Back to Scan</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.fullCenter}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={[styles.mutedText, styles.mt8]}>Loading history...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={[styles.strongText, {color: colors.danger}]}>Error</Text>
                    <Text style={[styles.subtle, styles.mt4]}>Reason: {error}</Text>
                </View>
            ) : scans.length === 0 ? (
                <View style={styles.card}>
                    <Text style={styles.strongText}>No scans yet.</Text>
                    <Text style={[styles.subtle, styles.mt4]}>Scan a QR code to see it here.</Text>
                </View>
            ) : (
                <View style={{ marginTop: 16 }}>
                    {scans.map((scan) => (
                        <View key={scan.id} style={styles.scanItemCard}>
                            <View style={[styles.accentBar, { backgroundColor: scan.verified ? colors.success : colors.danger }]} />
                            <View style={styles.scanItemHeader}>
                                <Text style={styles.scanJti}>{scan.jti}</Text>
                                <Text style={styles.scanDate}>
                                    {format(new Date(scan.scanned_at), 'MMM d, yyyy HH:mm')}
                                </Text>
                            </View>
                            <View style={styles.scanItemStatus}>
                                <Text style={[styles.scanStatusText, { color: scan.verified ? colors.success : colors.danger }]}>
                                    {scan.verified ? "Verified" : "Not Verified"}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 28 },
    ornamentTop: {
        position: "absolute", top: -80, right: -60, width: 220, height: 220, borderRadius: 999,
        backgroundColor: "rgba(10,132,255,0.16)",
    },
    ornamentBottom: {
        position: "absolute", bottom: -90, left: -70, width: 260, height: 260, borderRadius: 999,
        backgroundColor: "rgba(48,209,88,0.10)",
    },
    header: { marginBottom: 18 },
    title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: 0.2 },
    subtitle: { marginTop: 8, color: colors.muted, fontSize: 16, lineHeight: 22 },
    button: {
        borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
        alignItems: "center", justifyContent: "center",
    },
    buttonPrimary: { backgroundColor: colors.accent },
    buttonOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
    buttonOutlineText: { color: colors.text, fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
    pressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },
    card: {
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: 16,
        ...Platform.select({
            ios: { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
            android: { elevation: 7 },
        }),
    },
    strongText: { color: colors.text, fontSize: 18, fontWeight: "700" },
    subtle: { color: colors.muted, fontSize: 16, lineHeight: 22 },
    mt4: { marginTop: 4 },
    fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    mutedText: { color: colors.muted },
    mt8: { marginTop: 8 },
    scanItemCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 3 },
        }),
    },
    accentBar: { height: 2, borderRadius: 1, backgroundColor: colors.accent, marginBottom: 8, width: 40 },
    scanItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    scanJti: { color: colors.text, fontSize: 15, fontWeight: '700' },
    scanDate: { color: colors.muted, fontSize: 13 },
    scanItemStatus: { marginTop: 8 },
    scanStatusText: { fontWeight: '600', fontSize: 14 },
});
