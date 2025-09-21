// src/api/endpoints.ts
import { api } from "./client";
import type {
  TrustBundle,
  RevocationList,
  CredentialOut,
  HolderOut,
  IssuerOut,
  AddIssuerKeyResponse,
  ScanOut
} from "../types";

/* ─────────── Health ─────────── */

export const getHealth = () => api.get("/health").then((r) => r.data);

/* ─────────── Trust & Revocations ─────────── */

export const fetchTrustBundle = (): Promise<TrustBundle> =>
  api.get("/trust-bundle").then((r) => r.data);

export const fetchRevocations = (): Promise<RevocationList> =>
  api.get("/revocations").then((r) => r.data);

/* ─────────── Credentials & Scans ─────────── */

export const postCredential = (body: {
  jws: string;
  holder_subject?: string;
  issuer_did?: string;
  jti?: string;
}): Promise<CredentialOut> => api.post("/credentials", body).then((r) => r.data);

export const getCredential = (jti: string): Promise<CredentialOut> =>
  api.get(`/credentials/${encodeURIComponent(jti)}`).then((r) => r.data);

export const revokeCredential = (
  jti: string,
  reason?: string
): Promise<{ ok: boolean; already?: boolean }> =>
  api.post(`/credentials/${encodeURIComponent(jti)}/revoke`, { reason }).then((r) => r.data);

export const fetchScanHistory = (): Promise<ScanOut[]> => 
  api.get("/scans").then((r) => r.data);

/* ─────────── Holders ─────────── */

export const createHolder = (body: {
  subject: string;
  display_name?: string;
}): Promise<HolderOut> => api.post("/holders", body).then((r) => r.data);

export const listHolderCredentials = (subject: string): Promise<CredentialOut[]> =>
  api.get(`/holders/${encodeURIComponent(subject)}/credentials`).then((r) => r.data);

/* ─────────── Issuers & Keys ─────────── */

export const addIssuer = (body: {
  issuer_id: string;
  name?: string;
}): Promise<IssuerOut> => api.post("/issuers", body).then((r) => r.data);

export const addIssuerKey = (body: {
  issuer_id: string;
  kid: string;
  alg: string;              // e.g., "RS256", "ES256"
  public_key_pem: string;
  is_active?: boolean;
}): Promise<AddIssuerKeyResponse> =>
  api.post("/issuers/keys", body).then((r) => r.data);
