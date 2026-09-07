# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    creado_en = Column(DateTime, default=datetime.utcnow)

    chats = relationship("Chat", back_populates="user")

class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    creado_en = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="chats")
    mensajes = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"))
    role = Column(String) # "user" o "assistant"
    content = Column(Text)
    creado_en = Column(DateTime, default=datetime.utcnow)

    chat = relationship("Chat", back_populates="mensajes")
