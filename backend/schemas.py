# pyrefly: ignore [missing-import]
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# ========================
# Modelos para Usuarios
# ========================
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    creado_en: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# ========================
# Modelos para Mensajes
# ========================

class MessageBase(BaseModel):
    role: str
    content: str

class MessageCreate(MessageBase):
    chat_id: int

class MessageResponse(MessageBase):
    id: int
    chat_id: int
    creado_en: datetime

    class Config:
        from_attributes = True

# ========================
# Modelos para Chats
# ========================

class ChatBase(BaseModel):
    titulo: str

class ChatCreate(ChatBase):
    pass

class ChatResponse(ChatBase):
    id: int
    creado_en: datetime

    class Config:
        from_attributes = True

# ========================
# Modelos para Requests API
# ========================

class ChatRequest(BaseModel):
    chat_id: int
    mensaje: str
    contexto: Optional[str] = None
    web_search: bool = False

class ChatEndpointResponse(BaseModel):
    respuesta: str
    titulo: str
