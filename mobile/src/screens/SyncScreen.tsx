// src/screens/SyncScreen.tsx
import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSync } from "../hooks/useSync";

const colors = {
  bg: "#0b0d12",
  card: "#12151b",
  border: "#232a35",
  text: "#F2F4F7",
  muted: "#9AA3AD",
  accent: "#0A84FF",     // iOS blue
  success: "#30D158",    // iOS green
  danger: "#FF453A",     // iOS red
};

export default function SyncScreen() {
  const { online, busy, err, trust, revo, revokedKeys, syncNow, queueSizes } = useSync(); // Include revokedKeys and queueSizes from useSync

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* subtle background ornaments */}
      <View style={styles.ornamentTop} />
      <View style={styles.ornamentBottom} />

      <View style={styles.header}>
        <Text style={styles.title}>Sync</Text>
        <Text style={styles.subtitle}>
          Keep your trust bundle and revocation lists up to date for offline verification.
        </Text>
      </View>

      {/* Status & Versions */}
      <View style={styles.card}>
        <View style={styles.accentBar} />
        <View style={styles.pill}>
          <View
            style={[
              styles.pillDot,
              { backgroundColor: online ? colors.success : colors.danger },
            ]}
          />
          <Text style={styles.pillText}>{online ? "Online" : "Offline"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Trust bundle</Text>
          <Text style={styles.value}>{trust?.version ?? "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Credential revocations</Text>
          <Text style={styles.value}>{revo?.version ?? "-"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Issuer key revocations</Text>
          <Text style={styles.value}>{revokedKeys ? revokedKeys.size : "-"}</Text>
        </View>
        {/* Add queue information display */}
        <View style={styles.row}>
          <Text style={styles.label}>Pending uploads</Text>
          <Text style={styles.value}>
            {queueSizes.scans} scans, {queueSizes.credentials} credentials
          </Text>
        </View>

        {err ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Last error: {String(err)}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={busy}
          onPress={syncNow}
          hitSlop={8}
          android_ripple={{ color: "rgba(255,255,255,0.12)" }}
          style={({ pressed }) => [
            styles.button,
            styles.buttonPrimary,
            pressed && styles.pressed,
            busy && styles.buttonDisabled,
          ]}
        >
          {busy ? (
            <View style={styles.inBtnRow}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.buttonText, styles.ml8]}>Syncing…</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Sync</Text>
          )}
        </Pressable>
      </View>

      {/* Scan CTA (optional follow-up) */}
      <View style={[styles.card, styles.section]}>
        <View style={[styles.accentBar, { backgroundColor: colors.success }]} />
        <Text style={styles.cardHeading}>Next: Scan a credential</Text>
        <Text style={[styles.cardTextMuted, styles.mt4]}>
          After syncing, you can scan QR codes without an internet connection.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 28 },

  ornamentTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(10,132,255,0.16)",
  },
  ornamentBottom: {
    position: "absolute",
    bottom: -90,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(48,209,88,0.10)",
  },

  header: { marginBottom: 18 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 16, lineHeight: 22 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 7 },
    }),
  },
  section: { marginTop: 16 },

  accentBar: {
    height: 3, borderRadius: 3, backgroundColor: colors.accent, marginBottom: 12, width: 56,
  },

  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  pillText: { color: colors.text, fontSize: 13, letterSpacing: 0.2 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 15.5 },
  value: { color: colors.text, fontSize: 15.5, fontWeight: "600" },

  errorBox: {
    marginTop: 10,
    backgroundColor: "rgba(255,69,58,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,69,58,0.35)",
    padding: 10,
    borderRadius: 12,
  },
  errorText: { color: colors.text, fontSize: 13.5 },

  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonDisabled: { opacity: 0.9 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },

  inBtnRow: { flexDirection: "row", alignItems: "center" },
  ml8: { marginLeft: 8 },

  cardHeading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardTextMuted: { color: colors.muted, fontSize: 15.5, lineHeight: 21 },
  mt4: { marginTop: 4 },
});
