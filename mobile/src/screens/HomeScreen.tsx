// src/screens/HomeScreen.tsx
import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<any>;

const colors = {
  bg: "#0b0d12",
  card: "#12151b",
  subtle: "#171b22",
  border: "#232a35",
  text: "#F2F4F7",
  muted: "#9AA3AD",
  accent: "#0A84FF",     // iOS blue
  accentAlt: "#30D158",  // iOS green for subtle highlights
};

export default function HomeScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* soft background accents */}
      <View style={styles.ornamentTop} />
      <View style={styles.ornamentBottom} />

      <View style={styles.header}>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Offline • Private</Text>
        </View>

        <Text style={styles.title}>MOSIP Offline Verifier</Text>
        <Text style={styles.subtitle}>
          Scan and verify Verifiable Credentials entirely offline using cached
          issuer keys and revocation lists.
        </Text>
      </View>

      {/* Step 1 */}
      <View style={styles.card}>
        <View style={styles.accentBar} />
        <Text style={styles.cardHeading}>Step 1: Sync trust bundle & revocations</Text>
        <Text style={[styles.cardTextMuted, styles.mt4]}>
          Needed only once or whenever keys/revocations change.
        </Text>

        <Pressable
          onPress={() => navigation.navigate("Sync")}
          hitSlop={8}
          android_ripple={{ color: "rgba(255,255,255,0.12)" }}
          style={({ pressed }) => [
            styles.button,
            styles.buttonPrimary,
            pressed && styles.pressed,
            styles.mt14,
          ]}
        >
          <Text style={styles.buttonText}>Sync now  →</Text>
        </Pressable>
      </View>

      {/* Step 2 */}
      <View style={[styles.card, styles.section]}>
        <View style={[styles.accentBar, { backgroundColor: colors.accentAlt }]} />
        <Text style={styles.cardHeading}>Step 2: Scan QR</Text>
        <Text style={[styles.cardTextMuted, styles.mt4]}>
          Use your camera to scan the credential QR code.
        </Text>

        <Pressable
          onPress={() => navigation.navigate("Scan")}
          hitSlop={8}
          android_ripple={{ color: "rgba(255,255,255,0.10)" }}
          style={({ pressed }) => [
            styles.button,
            styles.buttonOutline,
            pressed && styles.pressed,
            styles.mt14,
          ]}
        >
          <Text style={styles.buttonOutlineText}>📷  Scan QR</Text>
        </Pressable>
      </View>

      {/* Admin entry */}
      <View style={[styles.card, styles.section]}>
        <View style={[styles.accentBar, { backgroundColor: colors.subtle }]} />
        <Text style={styles.cardHeading}>Admin Console</Text>
        <Text style={[styles.cardTextMuted, styles.mt4]}>Manage issuers, keys, holders & credentials.</Text>
        <Pressable
          onPress={() => navigation.navigate("Admin")}
          hitSlop={8}
          android_ripple={{ color: "rgba(255,255,255,0.10)" }}
          style={({ pressed }) => [
            styles.button,
            styles.buttonPrimary,
            pressed && styles.pressed,
            styles.mt14,
          ]}
        >
          <Text style={styles.buttonText}>Open Admin →</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },

  // Decorative background blobs (subtle, no perf heavy blur/gradients)
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

  header: {
    marginBottom: 18,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10,132,255,0.12)",
    borderColor: "rgba(10,132,255,0.35)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },

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
  section: {
    marginTop: 16,
  },

  accentBar: {
    height: 3,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginBottom: 10,
    width: 56,
  },

  cardHeading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  cardTextMuted: {
    color: colors.muted,
    fontSize: 15.5,
    lineHeight: 21,
  },
  mt4: { marginTop: 4 },
  mt14: { marginTop: 14 },

  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  buttonOutlineText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
});
