import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getAllScans } from '../storage/storage'; // Replace fetchScanHistory import
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<any>;

// Local scan type (matches what we store locally)
type LocalScan = {
    id: string;
    jti: string;
    verified: boolean;
    scanned_at: string;
};

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
    const [scans, setScans] = useState<LocalScan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const localScans = await getAllScans();
            // Sort by scan time, most recent first
            const sortedScans = localScans.sort((a, b) => 
                new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
            );
            setScans(sortedScans);
        } catch (e: any) {
            console.error("Failed to load local scan history:", e);
            setError(e?.message || "Failed to load scan history from local storage.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Reload history when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [loadHistory])
    );

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            {/* Ornaments */}
            <View style={styles.ornamentTop} />
            <View style={styles.ornamentBottom} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Scan History</Text>
                <Text style={styles.subtitle}>
                    Your offline scan history. Scans are uploaded when you sync.
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

                {/* Refresh Button */}
                <Pressable
                    onPress={loadHistory}
                    hitSlop={8}
                    android_ripple={{ color: "rgba(255,255,255,0.10)" }}
                    style={({ pressed }) => [
                        styles.button,
                        styles.buttonPrimary,
                        pressed && styles.pressed,
                        { alignSelf: "flex-start", marginTop: 8 }
                    ]}
                >
                    <Text style={styles.buttonText}>🔄 Refresh</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.fullCenter}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={[styles.mutedText, styles.mt8]}>Loading local history...</Text>
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
                    <Text style={[styles.subtle, { marginBottom: 12 }]}>
                        {scans.length} scan{scans.length === 1 ? '' : 's'} stored locally
                    </Text>
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
                                <View style={styles.statusRow}>
                                    <Text style={[styles.scanStatusText, { color: scan.verified ? colors.success : colors.danger }]}>
                                        {scan.verified ? "✓ Verified" : "✗ Not Verified"}
                                    </Text>
                                    <View style={styles.localBadge}>
                                        <Text style={styles.localBadgeText}>Local</Text>
                                    </View>
                                </View>
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
    scanJti: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
    scanDate: { color: colors.muted, fontSize: 13 },
    scanItemStatus: { marginTop: 8 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    scanStatusText: { fontWeight: '600', fontSize: 14 },
    localBadge: {
        backgroundColor: "rgba(10,132,255,0.15)",
        borderColor: "rgba(10,132,255,0.3)",
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    localBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
});
