# auth.py
import os
import logging  # Import logging module
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import Session, declarative_base

from database import get_db, engine, Base 

# -----------------------
# Config
# -----------------------
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600  # 10 hours (instead of 30 minutes)

# Password hashing - Updated to use Argon2
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------
# User Model
# -----------------------
class User(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True, index=True)
    hashed_password = Column(String, nullable=False)
    user_type = Column(String, default="user")  # 'admin' or 'user'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(bind=engine)

# -----------------------
# Pydantic Schemas
# -----------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None

class UserIn(BaseModel):
    username: str
    password: str
    user_type: Optional[str] = "user"  # Add this line

# -----------------------
# Hashing and JWT Utils
# -----------------------
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        logger.info("Decoding token...")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.info(f"Token payload: {payload}")
        username: str = payload.get("sub")
        if username is None:
            logger.error("Token payload missing 'sub' field.")
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError as e:
        logger.error(f"JWT decoding error: {e}")
        raise credentials_exception
    
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        logger.error(f"User not found for username: {token_data.username}")
        raise credentials_exception
    logger.info(f"Authenticated user: {user.username}")
    return user

# -----------------------
# Auth Router
# -----------------------
router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)

@router.post("/register")
def register_user(body: UserIn, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == body.username).first()
    if existing_user:
        logger.warning(f"Attempt to register already existing username: {body.username}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered"
        )
    
    hashed_password = get_password_hash(body.password)
    # Use the user_type from the request, default to "user" if not provided
    new_user = User(username=body.username, hashed_password=hashed_password, user_type=body.user_type or "user")
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"User registered successfully: {new_user.username}")
    return {"message": "User registered successfully"}

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for username: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_type": user.user_type}, expires_delta=access_token_expires
    )
    logger.info(f"Access token created for user: {user.username}")
    return {"access_token": access_token}

@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    logger.info(f"Fetching details for user: {current_user.username}")
    return {"username": current_user.username, "created_at": current_user.created_at}