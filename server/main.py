# FastAPI backend for storing Verifiable Credentials (VCs)
# Postgres version (JSONB, connection pooling, prod-friendly defaults)

from __future__ import annotations

import os
import json
import hashlib
import enum
from datetime import datetime, timezone
from typing import Any, List, Optional, Dict
from contextlib import asynccontextmanager  # Add this import

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sqlalchemy import (
    create_engine, Column, String, DateTime, Enum as SAEnum, Text,
    Boolean, ForeignKey, Integer, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship, selectinload  # Add selectinload here
from sqlalchemy.future import select

from jose import jwt 
from cryptography.fernet import Fernet
import uuid
from dotenv import load_dotenv

from database import Base, engine, get_db 
from auth import router as auth_router, get_current_user, User, get_password_hash

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
    kid = Column(String, unique=True, index=True)  # Changed: Now globally unique
    alg = Column(String)
    public_key_pem = Column(Text)
    is_active = Column(Boolean, default=True)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    issuer = relationship("Issuer", back_populates="keys")

    # Remove the composite constraint since kid is now globally unique
    # __table_args__ = (UniqueConstraint("issuer_id_fk", "kid", name="uq_issuer_kid"),)

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
    jti = Column(String, nullable=False)
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

# Add batch upload schemas
class ScanBatch(BaseModel):
    scans: List[Dict[str, Any]]

class CredentialBatch(BaseModel):
    credentials: List[Dict[str, Any]]

# -----------------------
# App / DI helpers
# -----------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create default admin user
    db = SessionLocal()
    try:
        # Check if admin user already exists
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            # Get admin password from environment or use default
            admin_password = os.getenv("ADMIN_PASSWORD")
            hashed_password = get_password_hash(admin_password)
            
            admin_user = User(
                username="admin",
                hashed_password=hashed_password,
                user_type="admin"
            )
            db.add(admin_user)
            db.commit()
            print("✅ Default admin user created: admin")
        else:
            print("ℹ️ Admin user already exists")
    except Exception as e:
        print(f"❌ Failed to create admin user: {e}")
    finally:
        db.close()
    
    yield
    
    # Shutdown: cleanup if needed
    print("Application shutting down...")

app = FastAPI(
    title="VC Storage Backend (Postgres)", 
    version="0.2.0",
    lifespan=lifespan  # Add this line
)

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
        import base64
        import json
        
        # Split the token into parts
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid JWT format - expected 3 parts")
        
        # Decode header
        header_b64 = parts[0]
        # Add padding if needed
        missing_padding = len(header_b64) % 4
        if missing_padding:
            header_b64 += '=' * (4 - missing_padding)
        header_bytes = base64.urlsafe_b64decode(header_b64)
        header = json.loads(header_bytes.decode('utf-8'))
        
        # Decode payload
        payload_b64 = parts[1]
        # Add padding if needed
        missing_padding = len(payload_b64) % 4
        if missing_padding:
            payload_b64 += '=' * (4 - missing_padding)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        return {"header": header, "payload": payload}
        
    except Exception as e:
        print(f"❌ JWT parse error: {e}")
        print(f"❌ Token preview: {token[:50]}..." if len(token) > 50 else f"❌ Token: {token}")
        raise ValueError(f"Invalid JWS: {e}")

# -----------------------
# Routes
# -----------------------
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
    
    # Check if kid already exists globally
    existing_key = db.query(IssuerKey).filter_by(kid=body.kid).first()
    if existing_key:
        # Get the issuer info for better error message
        existing_issuer = db.query(Issuer).filter_by(id=existing_key.issuer_id_fk).first()
        raise HTTPException(
            409, 
            detail=f"Key ID '{body.kid}' already exists for issuer '{existing_issuer.issuer_id}'. Key IDs must be globally unique."
        )
    
    k = IssuerKey(
        id=str(uuid.uuid4()), 
        issuer_id_fk=iss.id,
        kid=body.kid, 
        alg=body.alg, 
        public_key_pem=body.public_key_pem, 
        is_active=body.is_active
    )
    db.add(k)
    db.commit()
    db.refresh(k)
    return {"ok": True, "id": k.id}

# Trust bundle (for offline verifiers to prefetch)
@app.get("/trust-bundle", response_model=TrustBundleOut)
def get_trust_bundle(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Query issuer_keys directly with a join to get issuer information
    active_keys = db.query(IssuerKey, Issuer).join(
        Issuer, IssuerKey.issuer_id_fk == Issuer.id
    ).filter(
        IssuerKey.is_active == True,
        IssuerKey.revoked == False
    ).all()
    
    # Build the trust bundle items
    trust_bundle_items = []
    for key, issuer in active_keys:
        trust_bundle_items.append({
            "issuerId": issuer.issuer_id,
            "kid": key.kid,
            "alg": key.alg,
            "publicKeyPem": key.public_key_pem,
        })
    
    print(f"Found {len(trust_bundle_items)} active keys")
    for item in trust_bundle_items:
        print(f"  - Issuer: {item['issuerId']}, Kid: {item['kid']}")
    
    return TrustBundleOut(
        version=len(trust_bundle_items),
        issuedAt=now_utc(),
        issuers=trust_bundle_items
    )

# Revocation list for offline verifiers
@app.get("/revocations", response_model=RevocationListOut)
def revocations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    revoked_entries = db.query(RevokedCredential.jti).all()
    out = [r[0] for r in revoked_entries]
    version = len(out)
    return RevocationListOut(version=version, issuedAt=now_utc(), revokedJti=out)

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

# Add a new endpoint to revoke issuer keys
@app.post("/issuers/keys/{kid}/revoke")
def revoke_issuer_key(
    kid: str, 
    reason: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # Add authentication
):
    key = db.query(IssuerKey).filter(IssuerKey.kid == kid).first()
    if not key:
        raise HTTPException(status_code=404, detail="Issuer key not found")

    if key.revoked:
        return {"message": "Issuer key is already revoked", "kid": kid, "already": True}

    key.revoked = True
    db.commit()
    return {"message": "Issuer key revoked successfully", "kid": kid, "reason": reason}

@app.get("/issuers/keys/revoked")
def get_revoked_issuer_keys(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get a list of all revoked issuer key IDs (kids)"""
    revoked_keys = db.query(IssuerKey.kid).filter(IssuerKey.revoked == True).all()
    revoked_kids = [key[0] for key in revoked_keys]  # Extract the kid values
    
    return {
        "revokedKids": revoked_kids,
        "count": len(revoked_kids)
    }

# Batch upload scans
@app.post("/scans/batch")
def upload_scan_batch(
    body: ScanBatch, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Upload a batch of scan events from offline queue"""
    uploaded = 0
    for scan_data in body.scans:
        try:
            scan_event = Scan(
                jti=scan_data.get("jti", "unknown"),
                verified=scan_data.get("verified", False)
            )
            # Parse scanned_at if provided
            if "scanned_at" in scan_data:
                scan_event.scanned_at = datetime.fromisoformat(scan_data["scanned_at"].replace('Z', '+00:00'))
            
            db.add(scan_event)
            uploaded += 1
        except Exception as e:
            print(f"Failed to upload scan: {e}")
    
    try:
        db.commit()
        return {"uploaded": uploaded, "total": len(body.scans)}
    except Exception as e:
        db.rollback()
        print(e)
        raise HTTPException(400, detail=f"Batch upload failed: {e}")

# Batch upload credentials
@app.post("/credentials/batch")
def upload_credential_batch(
    body: CredentialBatch, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Upload a batch of credentials from offline queue"""
    uploaded = 0
    for cred_data in body.credentials:
        try:
            jws = cred_data.get("jws", "")
            if not jws:
                continue
                
            # Parse and store credential (reuse existing logic)
            meta = _parse_jws_unverified(jws)
            payload = meta["payload"]
            
            jti = payload.get("jti") or str(uuid.uuid4())
            
            # Check if already exists
            existing = db.query(Credential).filter_by(jti=jti).first()
            if existing:
                continue  # Skip duplicates
                
            # Create credential (simplified version)
            cred = Credential(
                id=str(uuid.uuid4()),
                jti=jti,
                format=VCFormat.jws,
                issuer_did=payload.get("iss"),
                holder_subject=payload.get("sub"),
                raw_encrypted=enc(jws),
                raw_sha256=sha256(jws),
                status=CredentialStatus.ACTIVE,
            )
            db.add(cred)
            uploaded += 1
            
        except Exception as e:
            print(f"Failed to upload credential: {e}")
    
    try:
        db.commit()
        return {"uploaded": uploaded, "total": len(body.credentials)}
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Batch upload failed: {e}")