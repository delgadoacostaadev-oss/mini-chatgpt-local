# pyrefly: ignore [missing-import]
# Force reload
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse
import json
import pandas as pd
import io
import asyncio
import requests
import pypdf
import re
# pyrefly: ignore [missing-import]
from duckduckgo_search import DDGS
# pyrefly: ignore [missing-import]
from youtube_transcript_api import YouTubeTranscriptApi
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.security import OAuth2PasswordRequestForm
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import List

import models
import crud
import schemas
import auth
from database import engine, get_db

# Crear tablas en la base de datos si no existen
models.Base.metadata.create_all(bind=engine)

# Semáforo para evitar saturar la IA local. 
# Solo permite 2 peticiones a la IA al mismo tiempo.
ollama_semaphore = asyncio.Semaphore(2)

app = FastAPI(title="Mini ChatGPT Pro API")

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Root"])
def inicio():
    return {"mensaje": "Mini ChatGPT API (Arquitectura Limpia) funcionando"}

@app.post("/register", response_model=schemas.UserResponse, tags=["Auth"])
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    return crud.create_user(db=db, user=user)

@app.post("/token", response_model=schemas.Token, tags=["Auth"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/chats", response_model=schemas.ChatResponse, tags=["Chats"])
def crear_chat(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Crea una nueva conversación en la base de datos."""
    return crud.create_chat(db=db, user_id=current_user.id)

@app.get("/chats", response_model=List[schemas.ChatResponse], tags=["Chats"])
def listar_chats(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Obtiene la lista de todas las conversaciones ordenadas por fecha."""
    return crud.get_chats(db=db, user_id=current_user.id)

@app.delete("/chats/{chat_id}", tags=["Chats"])
def eliminar_chat(chat_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Elimina una conversación y sus mensajes."""
    chat = crud.get_chat_by_id(db, chat_id=chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat no encontrado")
    crud.delete_chat(db, chat_id=chat_id)
    return {"message": "Chat eliminado correctamente"}

@app.get("/chats/{chat_id}/mensajes", response_model=List[schemas.MessageResponse], tags=["Mensajes"])
def obtener_mensajes(chat_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Obtiene todos los mensajes de una conversación específica."""
    chat = crud.get_chat_by_id(db, chat_id=chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat no encontrado")
    return crud.get_messages_by_chat_id(db=db, chat_id=chat_id)

@app.post("/chat", response_model=schemas.ChatEndpointResponse, tags=["Chat IA"])
def chat(request: schemas.ChatRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Recibe un mensaje del usuario, lo guarda, consulta a Ollama con el contexto completo,
    guarda la respuesta de la IA y actualiza el título del chat si es el primer mensaje.
    """
    # Validar que el chat exista
    chat_db = crud.get_chat_by_id(db, chat_id=request.chat_id)
    if not chat_db or chat_db.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat no encontrado")

    # 1. Guardar mensaje del usuario
    msg_usuario = schemas.MessageCreate(chat_id=request.chat_id, role="user", content=request.mensaje)
    crud.create_message(db=db, message=msg_usuario)

    # 2. Recuperar historial para contexto
    historial = crud.get_messages_by_chat_id(db=db, chat_id=request.chat_id)
    mensajes_openai = [{"role": "system", "content": "Eres Mini ChatGPT Pro, un asistente avanzado. Tu código backend está hecho en Python (FastAPI) y guardas todas las conversaciones en una base de datos PostgreSQL. Tienes la habilidad de leer archivos Excel, CSV y PDF si el usuario te los adjunta, y puedes buscar en la web o leer videos de YouTube si se te proporciona el contexto."}]
    
    # Manejar contexto de archivos
    if request.contexto:
        mensajes_openai.append({"role": "system", "content": f"El usuario ha adjuntado el siguiente documento. Usa esta información para responder a su pregunta:\n\n{request.contexto}"})
        
    # Manejar contexto de YouTube o Búsqueda Web
    yt_match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", request.mensaje)
    if yt_match:
        try:
            video_id = yt_match.group(1)
            transcript = YouTubeTranscriptApi().fetch(video_id, languages=['es', 'en'])
            texto_yt = " ".join([t.text for t in transcript])[:4000]
            mensajes_openai.append({"role": "system", "content": f"Transcripción del video de YouTube proporcionado por el usuario:\n\n{texto_yt}"})
        except Exception:
            mensajes_openai.append({"role": "system", "content": "El usuario proporcionó un link de YouTube pero no se pudieron extraer los subtítulos."})
    else:
        try:
            resultados = DDGS().text(request.mensaje, max_results=3)
            texto_web = "\n\n".join([f"Fuente: {r['title']}\nResumen: {r['body']}" for r in resultados])
            mensajes_openai.append({"role": "system", "content": f"Resultados de búsqueda web en tiempo real para la consulta del usuario:\n\n{texto_web}"})
        except Exception:
            pass
            
    mensajes_openai.extend([{"role": m.role, "content": m.content} for m in historial])
    
    # 3. Pedir respuesta a Ollama
    try:
        payload = {
            "model": "qwen2.5:0.5b",
            "messages": mensajes_openai,
            "stream": False
        }
        respuesta = requests.post("http://localhost:11434/api/chat", json=payload)
        respuesta.raise_for_status()
        texto_respuesta = respuesta.json().get("message", {}).get("content", "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al conectar con la IA: {str(e)}")

    # 4. Generar título automáticamente si es el primer par de mensajes (user + ia)
    if len(historial) <= 1:
        nuevo_titulo = request.mensaje[:30] + "..." if len(request.mensaje) > 30 else request.mensaje
        chat_db = crud.update_chat_title(db=db, chat_id=request.chat_id, new_title=nuevo_titulo)

    # 5. Guardar respuesta de la IA
    msg_ia = schemas.MessageCreate(chat_id=request.chat_id, role="assistant", content=texto_respuesta)
    crud.create_message(db=db, message=msg_ia)

    return schemas.ChatEndpointResponse(
        respuesta=texto_respuesta,
        titulo=chat_db.titulo
    )

@app.post("/chat/stream", tags=["Chat IA"])
def chat_stream(request: schemas.ChatRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    chat_db = crud.get_chat_by_id(db, chat_id=request.chat_id)
    if not chat_db or chat_db.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat no encontrado")

    # Guardar mensaje del usuario
    msg_usuario = schemas.MessageCreate(chat_id=request.chat_id, role="user", content=request.mensaje)
    crud.create_message(db=db, message=msg_usuario)

    historial = crud.get_messages_by_chat_id(db=db, chat_id=request.chat_id)
    mensajes_openai = [{"role": "system", "content": "Eres Mini ChatGPT Pro, un asistente avanzado. Tu código backend está hecho en Python (FastAPI) y guardas todas las conversaciones en una base de datos PostgreSQL. Tienes la habilidad de leer archivos Excel, CSV y PDF si el usuario te los adjunta, y puedes buscar en la web o leer videos de YouTube si se te proporciona el contexto."}]
    
    # Manejar contexto de archivos
    if request.contexto:
        mensajes_openai.append({"role": "system", "content": f"El usuario ha adjuntado el siguiente documento. Usa esta información para responder a su pregunta:\n\n{request.contexto}"})
        
    # Manejar contexto de YouTube o Búsqueda Web
    yt_match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", request.mensaje)
    if yt_match:
        try:
            video_id = yt_match.group(1)
            transcript = YouTubeTranscriptApi().fetch(video_id, languages=['es', 'en'])
            texto_yt = " ".join([t.text for t in transcript])[:4000]
            mensajes_openai.append({"role": "system", "content": f"Transcripción del video de YouTube proporcionado por el usuario:\n\n{texto_yt}"})
        except Exception:
            mensajes_openai.append({"role": "system", "content": "El usuario proporcionó un link de YouTube pero no se pudieron extraer los subtítulos."})
    else:
        try:
            resultados = DDGS().text(request.mensaje, max_results=3)
            texto_web = "\n\n".join([f"Fuente: {r['title']}\nResumen: {r['body']}" for r in resultados])
            mensajes_openai.append({"role": "system", "content": f"Resultados de búsqueda web en tiempo real para la consulta del usuario:\n\n{texto_web}"})
        except Exception:
            pass
            
    mensajes_openai.extend([{"role": m.role, "content": m.content} for m in historial])
    
    if len(historial) <= 1:
        nuevo_titulo = request.mensaje[:30] + "..." if len(request.mensaje) > 30 else request.mensaje
        crud.update_chat_title(db=db, chat_id=request.chat_id, new_title=nuevo_titulo)

    async def event_generator():
        async with ollama_semaphore:
            payload = {
                "model": "qwen2.5:0.5b",
                "messages": mensajes_openai,
                "stream": True
            }
            respuesta = requests.post("http://localhost:11434/api/chat", json=payload, stream=True)
            texto_completo = ""
            for line in respuesta.iter_lines():
                if line:
                    data = json.loads(line.decode('utf-8'))
                    token = data.get("message", {}).get("content", "")
                    if token:
                        texto_completo += token
                        yield f"data: {json.dumps({'token': token})}\n\n"
                        await asyncio.sleep(0) # Permite el cambio de contexto asíncrono
            
            # Al finalizar el stream, guardamos la respuesta completa
            msg_ia = schemas.MessageCreate(chat_id=request.chat_id, role="assistant", content=texto_completo)
            crud.create_message(db=db, message=msg_ia)
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/upload", tags=["Archivos"])
async def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    """Sube un archivo CSV, Excel o PDF y devuelve su contenido procesado como texto."""
    if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls', '.pdf')):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos CSV, Excel o PDF")
    
    try:
        contents = await file.read()
        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
            texto_resumen = df.to_markdown(index=False)
        elif file.filename.lower().endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
            texto_resumen = df.to_markdown(index=False)
        elif file.filename.lower().endswith('.pdf'):
            reader = pypdf.PdfReader(io.BytesIO(contents))
            text_pages = []
            for i in range(len(reader.pages)):
                text_pages.append(reader.pages[i].extract_text() or "")
            texto_resumen = "\n".join(text_pages)[:4000] # Limitar a 4000 caracteres para no saturar al modelo 0.5b
            
        return {"filename": file.filename, "content": texto_resumen}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")