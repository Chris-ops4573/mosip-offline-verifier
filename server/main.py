# FastAPI backend for storing Verifiable Credentials (VCs)
# Postgres version (JSONB, connection pooling, prod-friendly defaults)

from __future__ import annotations

import os
import json
import hashlib
import enum
from datetime import datetime, timezone
from typing import Any, List, Optional, Dict

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sqlalchemy import (
    create_engine, Column, String, DateTime, Enum as SAEnum, Text,
    Boolean, ForeignKey, Integer, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from sqlalchemy.future import select

import jwt
from cryptography.fernet import Fernet
import uuid
from dotenv import load_dotenv

from database import Base, engine, get_db 
from auth import router as auth_router, get_current_user, User 

load_dotenv()

# -----------------------
# Config / Secrets
# -----------------------
# Example: postgresql://<user>:<pass>@<host>:<port>/<db>
DB_URL = os.getenv("VC_DB_URL")

FERNET_KEY = os.getenv("VC_STORE_KEY")
fernet = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)

# Connection pool tuning (override via env if needed)
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))

# -----------------------
# Database setup (Postgres)
# -----------------------
engine = create_engine(
    DB_URL,
    pool_pre_ping=True,
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_recycle=POOL_RECYCLE,
    future=True,
    echo=False
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

# -----------------------
# Models
# -----------------------
class VCFormat(str, enum.Enum):
    jws = "jws"

class Holder(Base):
    __tablename__ = "holders"
    id = Column(String, primary_key=True)
    subject = Column(String, unique=True, index=True)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Issuer(Base):
    __tablename__ = "issuers"
    id = Column(String, primary_key=True)
    issuer_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    keys = relationship("IssuerKey", back_populates="issuer", cascade="all, delete-orphan", lazy="selectin")

class IssuerKey(Base):
    __tablename__ = "issuer_keys"
    id = Column(String, primary_key=True)
    issuer_id_fk = Column(String, ForeignKey("issuers.id", ondelete="CASCADE"))
    kid = Column(String, index=True)
    alg = Column(String)
    public_key_pem = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    issuer = relationship("Issuer", back_populates="keys")

    __table_args__ = (UniqueConstraint("issuer_id_fk", "kid", name="uq_issuer_kid"),)

class CredentialStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"

class Credential(Base):
    __tablename__ = "credentials"
    id = Column(String, primary_key=True)
    jti = Column(String, unique=True, index=True)
    format = Column(SAEnum(VCFormat, name="vc_format"))
    issuer_did = Column(String, index=True)
    holder_subject = Column(String, index=True)
    types = Column(JSONB, nullable=True)
    issued_at = Column(DateTime, nullable=True)
    not_before = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    status = Column(SAEnum(CredentialStatus, name="cred_status"), default=CredentialStatus.ACTIVE)
    revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(String, nullable=True)

    raw_encrypted = Column(Text, nullable=False)
    raw_sha256 = Column(String, index=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class RevokedCredential(Base):
    __tablename__ = "revoked_credentials"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    jti = Column(String, unique=True, index=True)
    revoked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reason = Column(String, nullable=True)

# New table to log every scan event
class Scan(Base):
    __tablename__ = "scans"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    jti = Column(String, ForeignKey("credentials.jti", ondelete="CASCADE"), nullable=False)
    verified = Column(Boolean, nullable=False)
    scanned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(bind=engine)

# -----------------------
# Schemas (Pydantic)
# -----------------------
class HolderIn(BaseModel):
    subject: str = Field(..., description="DID/subject identifier of the holder")
    display_name: Optional[str] = None

class HolderOut(BaseModel):
    id: str
    subject: str
    display_name: Optional[str]
    created_at: datetime

class IssuerIn(BaseModel):
    issuer_id: str
    name: Optional[str] = None

class IssuerKeyIn(BaseModel):
    issuer_id: str
    kid: str
    alg: str
    public_key_pem: str
    is_active: bool = True

class CredentialIn(BaseModel):
    jws: str = Field(..., description="Compact JWS/JWT form of the credential")

    holder_subject: Optional[str] = None
    issuer_did: Optional[str] = None
    jti: Optional[str] = None
    format: Optional[VCFormat] = None

class CredentialOut(BaseModel):
    id: str
    jti: str
    format: VCFormat
    issuer_did: Optional[str]
    holder_subject: Optional[str]
    types: Optional[List[str]]
    issued_at: Optional[datetime]
    not_before: Optional[datetime]
    expires_at: Optional[datetime]
    status: CredentialStatus
    revoked_at: Optional[datetime]
    revoke_reason: Optional[str]
    created_at: datetime

class RevokeIn(BaseModel):
    reason: Optional[str] = None

class TrustBundleOut(BaseModel):
    version: int
    issuedAt: datetime
    issuers: List[Dict[str, Any]]

class RevocationListOut(BaseModel):
    version: int
    issuedAt: datetime
    revokedJti: List[str]

class ScanOut(BaseModel):
    id: str
    jti: str
    verified: bool
    scanned_at: datetime
    # Optional: could add location, device_id, etc.

# -----------------------
# App / DI helpers
# -----------------------
app = FastAPI(title="VC Storage Backend (Postgres)", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -----------------------
# Utils
# -----------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def enc(s: str) -> str:
    return fernet.encrypt(s.encode()).decode()

def dec(s: str) -> str:
    return fernet.decrypt(s.encode()).decode()

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()

def _parse_jws_unverified(token: str) -> Dict[str, Any]:
    """Parse JWT/JWS header & payload WITHOUT verifying signature."""
    try:
        header = jwt.get_unverified_header(token)
        payload = jwt.decode(token, options={"verify_signature": False, "verify_aud": False})
        return {"header": header, "payload": payload}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JWS: {e}")

# -----------------------
# Routes
# -----------------------
@app.get("/health")
def health():
    return {"ok": True, "time": now_utc().isoformat()}

# Holders
@app.post("/holders", response_model=HolderOut)
def create_holder(body: HolderIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Holder).filter_by(subject=body.subject).first()
    if existing:
        return HolderOut(
            id=existing.id,
            subject=existing.subject,
            display_name=existing.display_name,
            created_at=existing.created_at,
        )
    h = Holder(id=str(uuid.uuid4()), subject=body.subject, display_name=body.display_name)
    db.add(h); db.commit(); db.refresh(h)
    return HolderOut(id=h.id, subject=h.subject, display_name=h.display_name, created_at=h.created_at)

# Issuers & keys
@app.post("/issuers")
def add_issuer(body: IssuerIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ex = db.query(Issuer).filter_by(issuer_id=body.issuer_id).first()
    if ex:
        return {"id": ex.id, "issuer_id": ex.issuer_id, "name": ex.name}
    iss = Issuer(id=str(uuid.uuid4()), issuer_id=body.issuer_id, name=body.name)
    db.add(iss); db.commit(); db.refresh(iss)
    return {"id": iss.id, "issuer_id": iss.issuer_id, "name": iss.name}

@app.post("/issuers/keys")
def add_issuer_key(body: IssuerKeyIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    iss = db.query(Issuer).filter_by(issuer_id=body.issuer_id).first()
    if not iss:
        raise HTTPException(404, detail="Issuer not found")
    k = IssuerKey(
        id=str(uuid.uuid4()), issuer_id_fk=iss.id,
        kid=body.kid, alg=body.alg, public_key_pem=body.public_key_pem, is_active=body.is_active
    )
    db.add(k); db.commit(); db.refresh(k)
    return {"ok": True, "id": k.id}

# Trust bundle (for offline verifiers to prefetch)
@app.get("/trust-bundle", response_model=TrustBundleOut)
def trust_bundle(db: Session = Depends(get_db)):
    active_keys = db.query(IssuerKey).join(Issuer, IssuerKey.issuer_id_fk == Issuer.id).filter(IssuerKey.is_active == True).all()
    items = []
    for k in active_keys:
        items.append({
            "issuerId": k.issuer.issuer_id,
            "kid": k.kid,
            "alg": k.alg,
            "publicKeyPem": k.public_key_pem,
        })
    version = len(items)
    print(TrustBundleOut(version=version, issuedAt=now_utc(), issuers=items))
    return TrustBundleOut(version=version, issuedAt=now_utc(), issuers=items)

# Credentials
@app.post("/credentials", response_model=CredentialOut)
def store_credential(body: CredentialIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not body.jws:
        raise HTTPException(400, detail="Provide 'jws' for JWT format")

    fmt: VCFormat = body.format or VCFormat.jws
    raw_str = body.jws.strip()
    meta = _parse_jws_unverified(raw_str)
    payload = meta["payload"]
    
    issuer_did: Optional[str] = body.issuer_did or payload.get("iss")
    holder_subject: Optional[str] = body.holder_subject or payload.get("sub")
    jti: Optional[str] = body.jti or payload.get("jti") or str(uuid.uuid4())
    
    iat = payload.get("iat"); nbf = payload.get("nbf"); exp = payload.get("exp")
    vc = payload.get("vc") or {}
    t = vc.get("type") if isinstance(vc, dict) else None
    if isinstance(t, list): types = t
    elif isinstance(t, str): types = [t]
    else: types = None

    def to_dt(x):
        if x is None: return None
        if isinstance(x, (int, float)):
            return datetime.fromtimestamp(int(x), tz=timezone.utc)
        return None

    issued_at = to_dt(iat); not_before = to_dt(nbf); expires_at = to_dt(exp)
    raw_enc = enc(raw_str); fingerprint = sha256(raw_str)

    # Check if a credential with this JTI already exists
    stmt = select(Credential).where(Credential.jti == jti)
    existing_cred = db.execute(stmt).scalars().first()

    if not existing_cred:
        cred = Credential(
            id=str(uuid.uuid4()),
            jti=jti,
            format=fmt,
            issuer_did=issuer_did,
            holder_subject=holder_subject,
            types=types,
            issued_at=issued_at,
            not_before=not_before,
            expires_at=expires_at,
            raw_encrypted=raw_enc,
            raw_sha256=fingerprint,
            status=CredentialStatus.ACTIVE,
        )
        db.add(cred)
        return_cred = cred
    else:
        return_cred = existing_cred

    # Log a scan event, linking it to the credential
    scan_event = Scan(jti=jti, verified=True) # Assume for this endpoint it's verified
    db.add(scan_event)

    try:
        db.commit()
    except Exception as e:
        print("Error: ", e)
        db.rollback()
        raise HTTPException(400, detail=f"Could not store credential: {e}")
    db.refresh(return_cred)

    return CredentialOut(
        id=return_cred.id,
        jti=return_cred.jti,
        format=return_cred.format,
        issuer_did=return_cred.issuer_did,
        holder_subject=return_cred.holder_subject,
        types=return_cred.types,
        issued_at=return_cred.issued_at,
        not_before=return_cred.not_before,
        expires_at=return_cred.expires_at,
        status=return_cred.status,
        revoked_at=return_cred.revoked_at,
        revoke_reason=return_cred.revoke_reason,
        created_at=return_cred.created_at,
    )

@app.get("/credentials/{jti}", response_model=CredentialOut)
def get_credential(jti: str, db: Session = Depends(get_db)):
    stmt = select(Credential).where(Credential.jti == jti)
    cred = db.execute(stmt).scalars().first()
    if not cred:
        raise HTTPException(404, detail="Credential not found")
    return CredentialOut(
        id=cred.id,
        jti=cred.jti,
        format=cred.format,
        issuer_did=cred.issuer_did,
        holder_subject=cred.holder_subject,
        types=cred.types,
        issued_at=cred.issued_at,
        not_before=cred.not_before,
        expires_at=cred.expires_at,
        status=cred.status,
        revoked_at=cred.revoked_at,
        revoke_reason=cred.revoke_reason,
        created_at=cred.created_at,
    )

@app.post("/credentials/{jti}/revoke")
def revoke_credential(jti: str, body: RevokeIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cred = db.query(Credential).filter_by(jti=jti).first()
    if not cred:
        raise HTTPException(404, detail="Credential not found")
    
    revoked_entry = db.query(RevokedCredential).filter_by(jti=jti).first()
    if revoked_entry:
        return {"ok": True, "already": True}

    cred.status = CredentialStatus.REVOKED
    cred.revoked_at = now_utc()
    cred.revoke_reason = body.reason
    db.add(cred)

    revoked_cred = RevokedCredential(jti=jti, reason=body.reason)
    db.add(revoked_cred)
    
    db.commit()
    return {"ok": True}

# Revocation list for offline verifiers
@app.get("/revocations", response_model=RevocationListOut)
def revocations(db: Session = Depends(get_db)):
    revoked_entries = db.query(RevokedCredential.jti).all()
    out = [r[0] for r in revoked_entries]
    version = len(out)
    return RevocationListOut(version=version, issuedAt=now_utc(), revokedJti=out)

@app.get("/scans", response_model=List[ScanOut])
def get_scans(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(Scan).order_by(Scan.scanned_at.desc())
    scans = db.execute(stmt).scalars().all()
    return [ScanOut(id=s.id, jti=s.jti, verified=s.verified, scanned_at=s.scanned_at) for s in scans]

# Minimal search/list helpers
@app.get("/holders/{subject}/credentials", response_model=List[CredentialOut])
def list_holder_creds(subject: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    creds = db.query(Credential).filter_by(holder_subject=subject).order_by(Credential.created_at.desc()).all()
    return [
        CredentialOut(
            id=c.id, jti=c.jti, format=c.format, issuer_did=c.issuer_did,
            holder_subject=c.holder_subject, types=c.types,
            issued_at=c.issued_at, not_before=c.not_before, expires_at=c.expires_at,
            status=c.status, revoked_at=c.revoked_at, revoke_reason=c.revoke_reason,
            created_at=c.created_at
        ) for c in creds
    ]
