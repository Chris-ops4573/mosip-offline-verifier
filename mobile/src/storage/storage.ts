import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TrustBundle, RevocationList } from "../types";

const KEYS = {
  TRUST_BUNDLE: "trust_bundle",
  REVOCATIONS: "revocations",
  REVOKED_ISSUER_KEYS: "revoked_issuer_keys",
  UPLOAD_QUEUE: "upload_queue", // Keep existing
  SCAN_QUEUE: "scan_queue",     // Add new queue for scans
  CREDENTIAL_QUEUE: "credential_queue", // Add new queue for credentials
};

export async function saveTrustBundle(tb: TrustBundle) {
  await AsyncStorage.setItem(KEYS.TRUST_BUNDLE, JSON.stringify(tb));
}
export async function loadTrustBundle(): Promise<TrustBundle | null> {
  const raw = await AsyncStorage.getItem(KEYS.TRUST_BUNDLE);
  return raw ? JSON.parse(raw) : null;
}

export async function saveRevocations(rv: RevocationList) {
  await AsyncStorage.setItem(KEYS.REVOCATIONS, JSON.stringify(rv));
}
export async function loadRevocations(): Promise<RevocationList | null> {
  const raw = await AsyncStorage.getItem(KEYS.REVOCATIONS);
  return raw ? JSON.parse(raw) : null;
}

// Add these two functions for revoked issuer keys
export async function saveRevokedIssuerKeys(revokedKeys: { revokedKids: string[] }) {
  await AsyncStorage.setItem(KEYS.REVOKED_ISSUER_KEYS, JSON.stringify(revokedKeys));
}

export async function loadRevokedIssuerKeys(): Promise<{ revokedKids: string[] } | null> {
  const raw = await AsyncStorage.getItem(KEYS.REVOKED_ISSUER_KEYS);
  return raw ? JSON.parse(raw) : null;
}

export async function enqueueUpload(jws: string) {
  const raw = await AsyncStorage.getItem(KEYS.UPLOAD_QUEUE);
  const arr: { jws: string; createdAt: number }[] = raw ? JSON.parse(raw) : [];
  arr.push({ jws, createdAt: Date.now() });
  await AsyncStorage.setItem(KEYS.UPLOAD_QUEUE, JSON.stringify(arr));
}

export async function dequeueUploads() {
  const raw = await AsyncStorage.getItem(KEYS.UPLOAD_QUEUE);
  const arr: { jws: string; createdAt: number }[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(KEYS.UPLOAD_QUEUE, JSON.stringify([]));
  return arr;
}

// Add scan to local queue (offline)
export async function queueScan(scan: {
  jti: string;
  verified: boolean;
  scanned_at: string;
}) {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_QUEUE);
  const queue: typeof scan[] = raw ? JSON.parse(raw) : [];
  queue.push(scan);
  await AsyncStorage.setItem(KEYS.SCAN_QUEUE, JSON.stringify(queue));
}

// Add credential to local queue (offline)
export async function queueCredential(credential: {
  jws: string;
  scanned_at: string;
}) {
  const raw = await AsyncStorage.getItem(KEYS.CREDENTIAL_QUEUE);
  const queue: typeof credential[] = raw ? JSON.parse(raw) : [];
  queue.push(credential);
  await AsyncStorage.setItem(KEYS.CREDENTIAL_QUEUE, JSON.stringify(queue));
}

// Get and clear scan queue (for sync)
export async function dequeueScans() {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_QUEUE);
  const queue = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(KEYS.SCAN_QUEUE, JSON.stringify([]));
  return queue;
}

// Get and clear credential queue (for sync)
export async function dequeueCredentials() {
  const raw = await AsyncStorage.getItem(KEYS.CREDENTIAL_QUEUE);
  const queue = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(KEYS.CREDENTIAL_QUEUE, JSON.stringify([]));
  return queue;
}

// Get queue sizes (for UI display)
export async function getQueueSizes() {
  const scanQueue = await AsyncStorage.getItem(KEYS.SCAN_QUEUE);
  const credQueue = await AsyncStorage.getItem(KEYS.CREDENTIAL_QUEUE);
  
  return {
    scans: scanQueue ? JSON.parse(scanQueue).length : 0,
    credentials: credQueue ? JSON.parse(credQueue).length : 0,
  };
}

// Get all scans from local storage (for history display)
export async function getAllScans() {
  const raw = await AsyncStorage.getItem(KEYS.SCAN_QUEUE);
  const scans = raw ? JSON.parse(raw) : [];
  
  // Transform to match the expected format with id field
  return scans.map((scan: any, index: number) => ({
    id: `local-${index}-${scan.jti}`, // Generate a local ID
    jti: scan.jti,
    verified: scan.verified,
    scanned_at: scan.scanned_at,
  }));
}
