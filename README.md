# MOSIP Offline Verifier

A mobile app that verifies digital credentials completely offline, with secure synchronization when online.

## Problem Statement

In remote areas with poor internet connectivity, verifying digital credentials becomes impossible with current online-only systems. This creates barriers to essential services in rural government offices, border checkpoints, and remote locations.

## What This App Does

- **📱 Offline Verification**: Scan and verify digital credentials without internet
- **🔐 Cryptographic Security**: Real JWS signature verification using RSA/ECDSA
- **🔄 Smart Sync**: Queue operations offline, sync when connectivity returns
- **👨‍💼 Admin Console**: Generate credentials, manage trust bundles, handle revocations
- **📊 Batch Operations**: Efficient bulk upload of offline verification data

## Quick Setup

### Backend (FastAPI + PostgreSQL)

1. **Clone and setup environment:**
```bash
git clone https://github.com/Chris-ops4573/mosip-offline-verifier.git
cd mosip-offline-verifier
```

2. **Configure `.env` file:**
```
Backend env:
# Database
POSTGRES_USER=username
POSTGRES_PASSWORD=password
POSTGRES_DB=vcdb
VC_DB_URL=postgresql://username:password@localhost:5432/vcdb

# Security Keys (generate your own!)
VC_STORE_KEY=your-32-byte-fernet-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Database Pool Settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=1800

Frontend env:
# Backend API Configuration
API_BASE_URL=your-ngrok-link-for-port-8000

# Expo Configuration (optional)
EAS_PROJECT_ID=your-eas-project-id
```

3. **Start with Docker:**
```bash
# Start PostgreSQL and backend
docker-compose up --build -d
```

4. **Setup ngrok for mobile access:**
```bash
# Install ngrok if not already installed
# Visit https://ngrok.com/ and sign up for free account

# Expose local backend to internet
ngrok http 8000

# Copy the https URL (e.g., https://abc123.ngrok-free.app)
# Update mobile/.env with this URL:
# API_BASE_URL=https://abc123.ngrok-free.app
```

### Frontend (React Native)

```bash
cd mobile
npm install
# Run on device using android developer mode 
npx expo run:android  
```

## How It Works

1. **Setup Trust**: Add issuers and their public keys via admin console
2. **Generate Credentials**: Create signed verifiable credentials and encode them in QR codes manually 
4. **Scan & Verify**: Camera scans QR codes, cryptographically verifies signatures offline without hitting backend
5. **Sync Later**: When online, all offline operations sync to the backend (scan history, unique credentials, trust bundle and revoked keys/credentials)

## Project Structure

```
├── mobile/          # React Native app
|   ├── src/api/     # Api client for online operations 
|   ├── src/hooks/   # Syncing and online detection logic 
│   ├── src/screens/ # UI screens (Scan, Admin, etc.)
│   ├── src/storage/ # Local queue management
│   ├── src/verify/  # Offline JWS verification
│   ├── src/types    # Strict type checking   
|   └── .env
├── server/          # FastAPI backend
│   ├── main.py      # Core API
│   ├── auth.py      # Authentication
│   ├── database.py  # DB models
|   ├── Dockerfile   # Dockerfile for backend 
├── .env   
└── docker-compose.yml

```

## Tech Stack

- **Mobile**: React Native + Expo + TypeScript
- **Backend**: FastAPI + PostgreSQL + SQLAlchemy
- **Crypto**: jsrsasign (mobile) + cryptography (backend)
- **Deployment**: Docker + Docker Compose

---

Built for **MOSIP Decode 2025** - Solving offline credential verification challenges.
└──