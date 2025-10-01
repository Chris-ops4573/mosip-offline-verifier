import { useCallback, useEffect, useState } from "react";
import * as Network from "expo-network";
import { fetchRevocations, fetchTrustBundle, fetchRevokedIssuerKeys, uploadScanBatch, uploadCredentialBatch } from "../api/endpoints";
import { loadRevocations, loadTrustBundle, saveRevocations, saveTrustBundle, saveRevokedIssuerKeys, loadRevokedIssuerKeys, dequeueScans, dequeueCredentials, getQueueSizes } from "../storage/storage";
import type { TrustBundle, RevocationList } from "../types";

export function useSync() {
  const [trust, setTrust] = useState<TrustBundle | null>(null);
  const [revo, setRevo] = useState<RevocationList | null>(null);
  const [revokedKeys, setRevokedKeys] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [queueSizes, setQueueSizes] = useState({ scans: 0, credentials: 0 });

  const reloadLocal = useCallback(async () => {
    setTrust(await loadTrustBundle());
    setRevo(await loadRevocations());
    const revokedKeysData = await loadRevokedIssuerKeys();
    setRevokedKeys(new Set(revokedKeysData?.revokedKids || []));
  }, []);

  const detectOnline = useCallback(async () => {
    const st = await Network.getNetworkStateAsync();
    const isOnline = !!st.isConnected && !!st.isInternetReachable;
    setOnline(isOnline);
    return isOnline;
  }, []);

  const updateQueueSizes = useCallback(async () => {
    const sizes = await getQueueSizes();
    setQueueSizes(sizes);
  }, []);

  const syncNow = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      // Check if we're online first
      const isOnline = await detectOnline();
      if (!isOnline) {
        throw new Error("No internet connection available");
      }

      // 1. Download updates (trust bundle, revocations)
      const [tb, rv, revokedKeysData] = await Promise.all([
        fetchTrustBundle(),
        fetchRevocations(),
        fetchRevokedIssuerKeys(),
      ]);

      // Save data locally
      await Promise.all([
        saveTrustBundle(tb),
        saveRevocations(rv),
        saveRevokedIssuerKeys(revokedKeysData),
      ]);

      // 2. Get queued data for upload
      const [scanQueue, credentialQueue] = await Promise.all([
        dequeueScans(),
        dequeueCredentials(),
      ]);

      console.log(`Found ${scanQueue.length} scans and ${credentialQueue.length} credentials to upload`);

      // 3. Upload credentials FIRST (so scans can reference them via FK)
      if (credentialQueue.length > 0) {
        console.log(`📤 Uploading ${credentialQueue.length} credentials first...`);
        try {
          const credentialResult = await uploadCredentialBatch(credentialQueue);
          console.log("✅ Credential batch upload result:", credentialResult);
        } catch (credentialError) {
          console.error("❌ Credential batch upload failed:", credentialError);
          throw credentialError;
        }
      }

      // 4. Upload scans AFTER credentials exist (FK constraint satisfied)
      if (scanQueue.length > 0) {
        console.log(`📤 Uploading ${scanQueue.length} scans after credentials...`);
        try {
          const scanResult = await uploadScanBatch(scanQueue);
          console.log("✅ Scan batch upload result:", scanResult);
        } catch (scanError) {
          console.error("❌ Scan batch upload failed:", scanError);
          throw scanError;
        }
      }

      // Update state
      setTrust(tb);
      setRevo(rv);
      setRevokedKeys(new Set(revokedKeysData.revokedKids));

      await updateQueueSizes();
      console.log("Sync completed successfully");
    } catch (e: any) {
      console.error("Sync error:", e);
      setErr(e?.message || "Sync failed");
    } finally {
      setBusy(false);
    }
  }, [detectOnline, updateQueueSizes]);

  useEffect(() => {
    reloadLocal();
    detectOnline();
    updateQueueSizes();
  }, [reloadLocal, detectOnline, updateQueueSizes]);

  return {
    online,
    busy,
    err,
    trust,
    revo,
    revokedKeys,
    syncNow,
    queueSizes,
    updateQueueSizes,
    revokedSet: new Set([
      ...(revo?.revokedJti ?? []),
      ...revokedKeys,
    ]),
  };
}
