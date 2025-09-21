// src/screens/AdminConsoleScreen.tsx
import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  addIssuer,
  addIssuerKey,
  createHolder,
  postCredential,
  revokeCredential,
} from "../api/endpoints";

const colors = {
  bg: "#0b0d12",
  card: "#12151b",
  subtle: "#171b22",
  border: "#232a35",
  text: "#F2F4F7",
  muted: "#9AA3AD",
  accent: "#0A84FF",     // iOS blue
  accentAlt: "#30D158",  // iOS green
  danger: "#FF453A",
  success: "#30D158",
};

export default function AdminConsoleScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* ornaments */}
      <View style={styles.ornamentTop} />
      <View style={styles.ornamentBottom} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <View style={[styles.badgeDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.badgeText}>Admin • Manage data</Text>
        </View>
        <Text style={styles.title}>Admin Console</Text>
        <Text style={styles.subtitle}>Create issuers, keys, holders, credentials, and revoke by JTI.</Text>

        {/* Back to Home */}
        <Pressable
          onPress={() => navigation.navigate("Home")}
          hitSlop={8}
          android_ripple={{ color: "rgba(255,255,255,0.10)" }}
          style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.pressed, { alignSelf: "flex-start", marginTop: 12 }]}
        >
          <Text style={styles.buttonOutlineText}>← Back to Home</Text>
        </Pressable>
      </View>

      <AddIssuerCard />
      <AddIssuerKeyCard />
      <AddHolderCard />
      <StoreCredentialCard />
      <RevokeCard />
    </ScrollView>
  );
}

/* ─────────────────────── Cards ─────────────────────── */

function AddIssuerCard() {
  const [issuerId, setIssuerId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit() {
    if (!issuerId.trim()) return Alert.alert("Missing", "Enter issuer_id (DID or URI).");
    setBusy(true); setMsg(null);
    try {
      const res = await addIssuer({ issuer_id: issuerId.trim(), name: name.trim() || undefined });
      setMsg(`OK • Issuer row id: ${res.id}`);
      setIssuerId(""); setName("");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not add issuer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <Text style={styles.cardHeading}>Add Issuer</Text>
      <Text style={[styles.cardTextMuted, styles.mt4]}>Register an issuer by DID/URI.</Text>

      <Text style={styles.label}>issuer_id</Text>
      <TextInput
        value={issuerId}
        onChangeText={setIssuerId}
        placeholder="did:example:ministry-trade"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />
      <Text style={[styles.label, styles.mt12]}>name (optional)</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Ministry of Trade"
        placeholderTextColor="rgba(242,244,247,0.45)"
        style={styles.input}
      />

      <PrimaryButton title={busy ? "Creating…" : "Create issuer →"} onPress={onSubmit} disabled={busy || !issuerId.trim()} busy={busy} />
      {msg && <SuccessPill text={msg} />}
    </View>
  );
}

function AddIssuerKeyCard() {
  const [issuerId, setIssuerId] = useState("");
  const [kid, setKid] = useState("");
  const [alg, setAlg] = useState("RS256");
  const [pem, setPem] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit() {
    if (!issuerId.trim() || !kid.trim() || !alg.trim() || !pem.trim()) {
      return Alert.alert("Missing", "issuer_id, kid, alg and public_key_pem are required.");
    }
    setBusy(true); setMsg(null);
    try {
      const res = await addIssuerKey({
        issuer_id: issuerId.trim(),
        kid: kid.trim(),
        alg: alg.trim(),
        public_key_pem: pem.trim(),
        is_active: isActive,
      });
      setMsg(`OK • Key id: ${res.id}`);
      setIssuerId(""); setKid(""); setAlg("RS256"); setPem(""); setIsActive(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not add issuer key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: colors.accentAlt }]} />
      <Text style={styles.cardHeading}>Add Issuer Key</Text>
      <Text style={[styles.cardTextMuted, styles.mt4]}>Attach a public key (PEM) to an issuer.</Text>

      <Text style={styles.label}>issuer_id</Text>
      <TextInput
        value={issuerId}
        onChangeText={setIssuerId}
        placeholder="did:example:ministry-trade"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />
      <Text style={[styles.label, styles.mt12]}>kid</Text>
      <TextInput
        value={kid}
        onChangeText={setKid}
        placeholder="key-2025-01"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />
      <Text style={[styles.label, styles.mt12]}>alg</Text>
      <TextInput
        value={alg}
        onChangeText={setAlg}
        placeholder="RS256"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="characters"
        style={styles.input}
      />
      <Text style={[styles.label, styles.mt12]}>public_key_pem</Text>
      <TextInput
        value={pem}
        onChangeText={setPem}
        placeholder="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w...\n-----END PUBLIC KEY-----"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        multiline
        style={[styles.input, { minHeight: 104, textAlignVertical: "top" }]}
      />
      <View style={[styles.switchRow, styles.mt12]}>
        <Text style={styles.label}>is_active</Text>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>

      <PrimaryButton title={busy ? "Adding…" : "Add key →"} onPress={onSubmit} disabled={busy || !issuerId.trim() || !kid.trim() || !alg.trim() || !pem.trim()} busy={busy} />
      {msg && <SuccessPill text={msg} />}
    </View>
  );
}

function AddHolderCard() {
  const [subject, setSubject] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit() {
    if (!subject.trim()) return Alert.alert("Missing", "Enter holder subject (DID or ID).");
    setBusy(true); setMsg(null);
    try {
      const res = await createHolder({ subject: subject.trim(), display_name: displayName.trim() || undefined });
      setMsg(`OK • Holder row id: ${res.id}`);
      setSubject(""); setDisplayName("");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not create holder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <Text style={styles.cardHeading}>Add Holder</Text>
      <Text style={[styles.cardTextMuted, styles.mt4]}>Register a subject (company/person).</Text>

      <Text style={styles.label}>subject</Text>
      <TextInput
        value={subject}
        onChangeText={setSubject}
        placeholder="did:example:acme-exports"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />
      <Text style={[styles.label, styles.mt12]}>display_name (optional)</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Acme Export Company"
        placeholderTextColor="rgba(242,244,247,0.45)"
        style={styles.input}
      />

      <PrimaryButton title={busy ? "Creating…" : "Create holder →"} onPress={onSubmit} disabled={busy || !subject.trim()} busy={busy} />
      {msg && <SuccessPill text={msg} />}
    </View>
  );
}

function StoreCredentialCard() {
  const [raw, setRaw] = useState(""); // JWS or JSON-LD string
  const [holderSubject, setHolderSubject] = useState("");
  const [issuerDid, setIssuerDid] = useState("");
  const [jti, setJti] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit() {
    if (!raw.trim()) return Alert.alert("Missing", "Paste a compact JWS.");
    const body: any = {};
    body.jws = raw.trim();

    if (holderSubject.trim()) body.holder_subject = holderSubject.trim();
    if (issuerDid.trim()) body.issuer_did = issuerDid.trim();
    if (jti.trim()) body.jti = jti.trim();

    setBusy(true); setMsg(null);
    try {
      const res = await postCredential(body);
      setMsg(`OK • Stored credential jti: ${res.jti}`);
      setRaw(""); setHolderSubject(""); setIssuerDid(""); setJti("");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not store credential.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />
      <Text style={styles.cardHeading}>Store Credential</Text>
      <Text style={[styles.cardTextMuted, styles.mt4]}>Accepts compact JWS.</Text>

      <Text style={styles.label}>credential (JWS)</Text>
      <TextInput
        value={raw}
        onChangeText={setRaw}
        placeholder={'eyJhbGciOiJSUzI1NiIsImtpZCI6I...'}
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
    />


      <Text style={[styles.label, styles.mt12]}>holder_subject (override, optional)</Text>
      <TextInput
        value={holderSubject}
        onChangeText={setHolderSubject}
        placeholder="did:example:acme-exports"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />

      <Text style={[styles.label, styles.mt12]}>issuer_did (override, optional)</Text>
      <TextInput
        value={issuerDid}
        onChangeText={setIssuerDid}
        placeholder="did:example:ministry-trade"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />

      <Text style={[styles.label, styles.mt12]}>jti (override, optional)</Text>
      <TextInput
        value={jti}
        onChangeText={setJti}
        placeholder="cred-123"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />

      <PrimaryButton title={busy ? "Storing…" : "Store credential →"} onPress={onSubmit} disabled={busy || !raw.trim()} busy={busy} />
      {msg && <SuccessPill text={msg} />}
    </View>
  );
}

function RevokeCard() {
  const [jti, setJti] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit() {
    if (!jti.trim()) return Alert.alert("Missing", "Enter the credential jti.");
    setBusy(true); setMsg(null);
    try {
      const res = await revokeCredential(jti.trim(), reason.trim() || undefined);
      setMsg(res.already ? "Already revoked" : "Revoked");
      setJti(""); setReason("");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not revoke credential.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: colors.danger }]} />
      <Text style={styles.cardHeading}>Revoke Credential</Text>
      <Text style={[styles.cardTextMuted, styles.mt4]}>Marks credential status as REVOKED by JTI.</Text>

      <Text style={styles.label}>jti</Text>
      <TextInput
        value={jti}
        onChangeText={setJti}
        placeholder="cred-123"
        placeholderTextColor="rgba(242,244,247,0.45)"
        autoCapitalize="none"
        style={styles.input}
      />
      <Text style={[styles.label, styles.mt12]}>reason (optional)</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Expired / revoked by authority / etc."
        placeholderTextColor="rgba(242,244,247,0.45)"
        style={styles.input}
      />

      <DangerButton title={busy ? "Revoking…" : "Revoke →"} onPress={onSubmit} disabled={busy || !jti.trim()} busy={busy} />
      {msg && <SuccessPill text={msg} />}
    </View>
  );
}

/* ─────────────────────── Small UI bits ─────────────────────── */

function PrimaryButton({
  title,
  onPress,
  disabled,
  busy,
}: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles.buttonPrimary,
        (pressed || busy) && styles.pressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

function DangerButton({
  title,
  onPress,
  disabled,
  busy,
}: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles.buttonDanger,
        (pressed || busy) && styles.pressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

function SuccessPill({ text }: { text: string }) {
  return (
    <View style={[styles.notice, styles.mt16]}>
      <View style={styles.dot} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

/* ─────────────────────── Styles ─────────────────────── */

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
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginRight: 8 },
  badgeText: { color: colors.text, fontSize: 12.5, letterSpacing: 0.3 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 16, lineHeight: 22 },

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

  accentBar: { height: 3, borderRadius: 3, backgroundColor: colors.accent, marginBottom: 10, width: 56 },
  cardHeading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardTextMuted: { color: colors.muted, fontSize: 15.5, lineHeight: 21 },

  label: { color: colors.muted, fontSize: 14, marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: colors.text,
    fontSize: 16,
  },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  buttonOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  buttonOutlineText: { color: colors.text, fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  buttonDisabled: { opacity: 0.6 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },

  mt4: { marginTop: 4 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },

  notice: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(48,209,88,0.10)",
    borderColor: "rgba(48,209,88,0.35)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 8 },
  noticeText: { color: colors.text, fontSize: 13.5 },
});
