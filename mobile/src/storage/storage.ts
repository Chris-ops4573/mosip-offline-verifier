import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TrustBundle, RevocationList } from "../types";

const KEYS = {
  TRUST_BUNDLE: "trust_bundle",
  REVOCATIONS: "revocations",
  UPLOAD_QUEUE: "upload_queue", // [{jws:string, createdAt:number}]
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
