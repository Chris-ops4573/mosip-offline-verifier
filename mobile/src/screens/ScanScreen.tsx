// src/screens/ScanScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { useSync } from "../hooks/useSync";
import { verifyJwsOffline } from "../verify/jws";
import { queueScan, queueCredential } from "../storage/storage"; // Remove enqueueUpload and postCredential imports
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

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

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [asking, setAsking] = useState(false);
  const [scanned, setScanned] = useState(false);
  const { trust, revokedSet, updateQueueSizes } = useSync(); // Remove 'online' dependency, add updateQueueSizes
  const [lastResult, setLastResult] = useState<any>(null);
  
  const scaleAnim = useSharedValue(0);

  useEffect(() => {
    (async () => {
      if (permission && !permission.granted && permission.canAskAgain && !asking) {
        setAsking(true);
        await requestPermission();
        setAsking(false);
      }
    })();
  }, [permission, requestPermission, asking]);

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);

      try {
        if (!trust) {
          Alert.alert("No trust bundle", "Please sync issuer keys first.");
          setScanned(false);
          return;
        }

        const token = (result?.data || "").trim();
        const verification = verifyJwsOffline(token, trust, revokedSet);
        setLastResult({ result: verification, token });
        
        scaleAnim.value = withTiming(1, { duration: 300 });

        // OFFLINE-FIRST APPROACH - Always queue locally, sync will upload when online
        const scanTime = new Date().toISOString();

        // Queue scan event locally (always offline)
        await queueScan({
          jti: verification.payload.jti || "unknown",
          verified: verification.ok,
          scanned_at: scanTime,
        });

        // Queue credential locally if verification succeeded (always offline)
        if (verification.ok) {
          await queueCredential({
            jws: token,
            scanned_at: scanTime,
          });
        }

        // Update queue sizes in sync screen
        if (updateQueueSizes) {
          await updateQueueSizes();
        }

        // Show result to user
        if (verification.ok) {
          Alert.alert("✅ Valid", "Credential verified successfully!\n(Queued for sync)");
        } else {
          Alert.alert("❌ Invalid", `Verification failed: ${verification.reason}`);
        }

      } catch (e: any) {
        Alert.alert("Scan error", e?.message || "Invalid QR");
      } finally {
        setTimeout(() => setScanned(false), 800);
      }
    },
    [scanned, trust, revokedSet, updateQueueSizes, scaleAnim] // Remove 'online' dependency
  );
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleAnim.value }],
    };
  });

  if (!permission) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator color="#fff" />
        <Text style={[styles.mutedText, styles.mt8]}>Preparing camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fullCenter, styles.pad24]}>
        <Text style={[styles.text, styles.center, styles.mb12]}>
          Camera permission is required to scan QR codes.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [
            styles.button,
            styles.buttonOutline,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonOutlineText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const header = lastResult?.result?.header;
  const payload = lastResult?.result?.payload;
  const verified = !!lastResult?.result?.ok;

  return (
    <View style={styles.screen}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        />

        <View style={styles.overlay}>
          <View style={styles.maskTop} />
          <View style={styles.maskCenterRow}>
            <View style={styles.maskSide} />
            <View style={styles.reticle}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.maskSide} />
          </View>
          <View style={styles.maskBottom} />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Scan</Text>
        {!lastResult ? (
          <>
            <Text style={[styles.subtle, styles.mt6]}>
              Point the camera at a credential QR.
            </Text>
            {/* View scans button */}
            <Pressable
                onPress={() => navigation.navigate("ScanHistory")}
                hitSlop={8}
                android_ripple={{ color: "rgba(255,255,255,0.12)" }}
                style={({ pressed }) => [
                    styles.button,
                    styles.buttonPrimary,
                    pressed && styles.pressed,
                    styles.mt14,
                ]}
            >
                <Text style={styles.buttonText}>View Previous Scans →</Text>
            </Pressable>
            {/* Back to Home button */}
            <Pressable
                onPress={() => navigation.navigate("Home")}
                hitSlop={8}
                android_ripple={{ color: "rgba(255,255,255,0.12)" }}
                style={({ pressed }) => [
                    styles.button,
                    styles.buttonBlack, // Use the new black button style
                    pressed && styles.pressed,
                    styles.mt14,
                ]}
            >
                <Text style={styles.buttonText}>← Back to Home</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.card}>
            <View
              style={[
                styles.accentBar,
                { backgroundColor: verified ? colors.success : colors.danger },
              ]}
            />
            {verified ? (
              <>
                <Animated.View style={animatedStyle}>
                  <Text style={styles.strongText}>✅ Verified</Text>
                </Animated.View>
                {!!lastResult.result.warnings?.length && (
                  <Text style={[styles.subtle, styles.mt4]}>
                    Warnings: {lastResult.result.warnings.join("; ")}
                  </Text>
                )}

                <View style={styles.kv}>
                  <Text style={styles.k}>Issuer (iss)</Text>
                  <Text style={styles.v}>{payload?.iss ?? "-"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Subject (sub)</Text>
                  <Text style={styles.v}>{payload?.sub ?? "-"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>JTI</Text>
                  <Text style={styles.v}>{payload?.jti ?? "-"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Alg</Text>
                  <Text style={styles.v}>{header?.alg ?? "-"}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Key ID (kid)</Text>
                  <Text style={styles.v}>{header?.kid ?? "-"}</Text>
                </View>

                <Pressable
                  onPress={() => {
                    setLastResult(null);
                    scaleAnim.value = 0; // Reset animation
                  }}
                  style={({ pressed }) => [
                    styles.button,
                    styles.buttonOutline,
                    pressed && styles.pressed,
                    styles.mt14,
                  ]}
                >
                  <Text style={styles.buttonOutlineText}>Scan again</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Animated.View style={animatedStyle}>
                  <Text style={styles.strongText}>❌ Not verified</Text>
                </Animated.View>
                <Text style={[styles.subtle, styles.mt4]}>
                  Reason: {lastResult.result.reason}
                </Text>

                <Pressable
                  onPress={() => {
                    setLastResult(null);
                    scaleAnim.value = 0; // Reset animation
                  }}
                  style={({ pressed }) => [
                    styles.button,
                    styles.buttonPrimary,
                    pressed && styles.pressed,
                    styles.mt14,
                  ]}
                >
                  <Text style={styles.buttonText}>Scan again →</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const CARD_RADIUS = 18;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Camera
  cameraWrap: {
    height: 320,
    overflow: "hidden",
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
    backgroundColor: "#000",
  },
  overlay: { flex: 1 },
  maskTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  maskBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  maskCenterRow: { height: 200, flexDirection: "row" },
  maskSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  reticle: {
    width: 220,
    height: 220,
    borderRadius: 16,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "rgba(255,255,255,0.9)",
  },
  cornerTL: { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 10, left: 10, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 10, right: 10, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },

  // Panel below camera
  panel: { padding: 16 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: 0.2 },
  subtle: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  mt6: { marginTop: 6 },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 16,
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
  accentBar: {
    height: 3,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginBottom: 10,
    width: 56,
  },
  strongText: { color: colors.text, fontSize: 18, fontWeight: "700" },

  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  k: { color: colors.muted, fontSize: 15.5 },
  v: { color: colors.text, fontSize: 15.5, fontWeight: "600", marginLeft: 12 },

  // Buttons
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonBlack: { backgroundColor: colors.card }, // New style for the black button
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  buttonOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  buttonOutlineText: { color: colors.text, fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },

  // Generic
  fullCenter: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  pad24: { padding: 24 },
  text: { color: colors.text, fontSize: 16 },
  center: { textAlign: "center" },
  mb12: { marginBottom: 12 },
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
});