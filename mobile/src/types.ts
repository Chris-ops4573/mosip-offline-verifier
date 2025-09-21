// src/types.ts

/* ─────────── Trust & Revocations ─────────── */

export type TrustBundleItem = {
  issuerId: string;
  kid: string;
  alg: string;           // e.g., "RS256" | "ES256"
  publicKeyPem: string;
};

export type TrustBundle = {
  version: number;
  issuedAt: string;      // ISO string
  issuers: TrustBundleItem[];
};

export type RevocationList = {
  version: number;
  issuedAt: string;      // ISO string
  revokedJti: string[];
};

/* ─────────── Credentials & Holders ─────────── */

export type VCFormat = "jws";
export type CredentialStatus = "ACTIVE" | "REVOKED";

export type CredentialOut = {
  id: string;
  jti: string;
  format: VCFormat;
  issuer_did?: string | null;
  holder_subject?: string | null;
  types?: string[] | null;
  issued_at?: string | null;     // ISO (nullable)
  not_before?: string | null;    // ISO (nullable)
  expires_at?: string | null;    // ISO (nullable)
  status: CredentialStatus;
  revoked_at?: string | null;    // ISO (nullable)
  revoke_reason?: string | null;
  created_at: string;            // ISO
};

export type HolderOut = {
  id: string;
  subject: string;
  display_name?: string | null;
  created_at: string;            // ISO
};

/* ─────────── Issuers ─────────── */

export type IssuerOut = {
  id: string;
  issuer_id: string;
  name?: string | null;
};

export type AddIssuerKeyResponse = {
  ok: boolean;
  id: string;
};

/* ─────────── Local verify result (app-side) ─────────── */

export type VerifyResult =
  | { ok: true; payload: any; header: any; jti?: string; warnings?: string[] }
  | { ok: false; reason: string; header?: any; payload?: any };

export type ScanOut = {
  id: string;
  jti: string;
  verified: boolean;
  scanned_at: string;
}
