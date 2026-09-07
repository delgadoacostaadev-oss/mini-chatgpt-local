# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
import models
import schemas
from typing import List, Optional
import auth

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_chats(db: Session, user_id: int) -> List[models.Chat]:
    return db.query(models.Chat).filter(models.Chat.user_id == user_id).order_by(models.Chat.creado_en.desc()).all()

def create_chat(db: Session, user_id: int, titulo: str = "Nuevo Chat") -> models.Chat:
    db_chat = models.Chat(titulo=titulo, user_id=user_id)
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    return db_chat

def get_chat_by_id(db: Session, chat_id: int) -> Optional[models.Chat]:
    return db.query(models.Chat).filter(models.Chat.id == chat_id).first()

def update_chat_title(db: Session, chat_id: int, new_title: str) -> Optional[models.Chat]:
    db_chat = get_chat_by_id(db, chat_id)
    if db_chat:
        db_chat.titulo = new_title
        db.commit()
        db.refresh(db_chat)
    return db_chat

def get_messages_by_chat_id(db: Session, chat_id: int) -> List[models.Message]:
    return db.query(models.Message).filter(models.Message.chat_id == chat_id).order_by(models.Message.id.asc()).all()

def create_message(db: Session, message: schemas.MessageCreate) -> models.Message:
    db_message = models.Message(
        chat_id=message.chat_id,
        role=message.role,
        content=message.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def delete_chat(db: Session, chat_id: int):
    # Eliminar mensajes asociados primero para evitar problemas de Foreign Key
    db.query(models.Message).filter(models.Message.chat_id == chat_id).delete()
    db.query(models.Chat).filter(models.Chat.id == chat_id).delete()
    db.commit()
