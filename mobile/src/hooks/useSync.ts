import { useCallback, useEffect, useState } from "react";
import * as Network from "expo-network";
import { fetchRevocations, fetchTrustBundle, postCredential } from "../api/endpoints";
import { loadRevocations, loadTrustBundle, saveRevocations, saveTrustBundle, dequeueUploads } from "../storage/storage";
import type { TrustBundle, RevocationList } from "../types";

export function useSync() {
  const [trust, setTrust] = useState<TrustBundle | null>(null);
  const [revo, setRevo] = useState<RevocationList | null>(null);
  const [online, setOnline] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reloadLocal = useCallback(async () => {
    setTrust(await loadTrustBundle());
    setRevo(await loadRevocations());
  }, []);

  const detectOnline = useCallback(async () => {
    const st = await Network.getNetworkStateAsync();
    setOnline(!!st.isConnected && !!st.isInternetReachable);
  }, []);

  const syncNow = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      await detectOnline();
      if (!online) throw new Error("Offline");

      const [tb, rv] = await Promise.all([fetchTrustBundle(), fetchRevocations()]);
      await saveTrustBundle(tb);
      await saveRevocations(rv);
      setTrust(tb);
      setRevo(rv);

      // flush queued credentials (if any)
      const queued = await dequeueUploads();
      for (const item of queued) {
        try { await postCredential({ jws: item.jws }); } catch { /* keep going */ }
      }
    } catch (e: any) {
      setErr(e?.message || "Sync failed");
    } finally {
      setBusy(false);
    }
  }, [online, detectOnline]);

  useEffect(() => { reloadLocal(); detectOnline(); }, [reloadLocal, detectOnline]);

  return {
    online, busy, err, trust, revo,
    syncNow,
    revokedSet: new Set(revo?.revokedJti ?? [])
  };
}
