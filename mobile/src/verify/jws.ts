// Offline VC (JWS/JWT) verification using jsrsasign
import { KJUR, KEYUTIL, b64utohex, hextoutf8 } from "jsrsasign";
import type { TrustBundle, TrustBundleItem, VerifyResult, CredentialOut } from "../types";

// The user-provided types for schema validation
type JWSHeader = {
  alg: string;
  kid?: string;
  typ?: string;
  [k: string]: any;
};
type JWSPayload = {
  iss?: string;
  sub?: string;
  jti?: string;
  nbf?: number;
  iat?: number;
  exp?: number;
  vc?: CredentialOut;
  [k: string]: any;
};

// Minimal JWS parser
export function decodeJwsUnverified(token: string): { header: JWSHeader; payload: JWSPayload } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Not a JWS compact token");
  const [h, p] = parts;
  const header = JSON.parse(hextoutf8(b64utohex(h)));
  const payload = JSON.parse(hextoutf8(b64utohex(p)));
  return { header, payload };
}

function findKey(tb: TrustBundle, issuerId: string | undefined, kid: string | undefined): TrustBundleItem | undefined {
  if (!issuerId || !kid) return undefined;
  return tb.issuers.find((it) => it.issuerId === issuerId && it.kid === kid);
}

export function verifyJwsOffline(token: string, tb: TrustBundle, revoked: Set<string>): VerifyResult {
  try {
    const { header, payload } = decodeJwsUnverified(token);
    const nowSec = Math.floor(Date.now() / 1000);

    // Enforce required claims.
    if (!payload.iss) {
      return { ok: false, reason: "Invalid token: 'iss' claim is missing.", header, payload };
    }
    if (!header.kid) {
      return { ok: false, reason: "Invalid token: 'kid' claim is missing.", header, payload };
    }
    if (!payload.jti) {
      return { ok: false, reason: "Invalid token: 'jti' claim is missing.", header, payload };
    }
    if (typeof payload.nbf !== "number") {
      return { ok: false, reason: "Invalid token: 'nbf' claim is missing.", header, payload };
    }
    if (typeof payload.exp !== "number") {
      return { ok: false, reason: "Invalid token: 'exp' claim is missing.", header, payload };
    }

    // Time checks
    if (nowSec < payload.nbf) {
      return { ok: false, reason: "Credential not yet valid (nbf).", header, payload };
    }
    if (nowSec > payload.exp) {
      return { ok: false, reason: "Credential is expired (exp).", header, payload };
    }

    // Find issuer key by iss + kid
    const keyItem = findKey(tb, payload.iss, header.kid);
    if (!keyItem) {
      return { ok: false, reason: "Issuer key not found in trust bundle", header, payload };
    }

    // Revocation check for credentials
    const jti = payload.jti;
    if (jti && revoked.has(jti)) {
      return { ok: false, reason: "Credential is revoked", header, payload };
    }

    // Revocation check for issuer keys
    const kid = header.kid;
    if (kid && revoked.has(kid)) {
      return { ok: false, reason: "Issuer key is revoked", header, payload };
    }

    // Verify signature (RS256 or ES256)
    const pub = KEYUTIL.getKey(keyItem.publicKeyPem);
    const isValid = KJUR.jws.JWS.verifyJWT(token, pub, { alg: [keyItem.alg] });
    if (!isValid) return { ok: false, reason: "Signature verification failed", header, payload };

    return { ok: true, payload, header, jti, warnings: [] };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "Invalid token" };
  }
}