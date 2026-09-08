# Mini ChatGPT Pro 🚀

Un clon avanzado de ChatGPT de manera local, privado y súper inteligente. 
Esta aplicación usa un modelo local de IA (Ollama) junto con conexión a internet en tiempo real y lectura de documentos.

## Características Principales 🌟
- **Interacción de Chat Inteligente:** Respuestas instantáneas y memoria de conversación.
- **RAG con Documentos:** Adjunta archivos **PDF, Excel (.xlsx) y CSV** y la IA los leerá y responderá preguntas sobre ellos.
- **Búsqueda Web en Tiempo Real:** La IA busca en internet (DuckDuckGo) por debajo para darte información de noticias actualizadas o respuestas a preguntas recientes.
- **Análisis de YouTube:** Pega un enlace de YouTube en el chat y la IA extraerá automáticamente los subtítulos y resumirá el video.
- **Historial Persistente:** Todo se guarda en una base de datos PostgreSQL, con la posibilidad de borrar los historiales.
- **Autenticación JWT:** Sistema de login y registro.

---

## 🛠️ Instrucciones de Instalación (Para correr en otro PC)

Si acabas de descargar este código en una computadora nueva, sigue estos pasos al pie de la letra para que vuelva a funcionar:

### 1. Requisitos Previos
Antes de empezar, debes instalar en la nueva computadora:
1. **[Python 3.10+](https://www.python.org/downloads/)** (Asegúrate de marcar "Add Python to PATH" en la instalación).
2. **[Node.js (v18+)](https://nodejs.org/)**.
3. **[PostgreSQL](https://www.postgresql.org/download/)**. (Crea una base de datos y asegúrate de actualizar tus credenciales en `backend/database.py`).
4. **[Ollama](https://ollama.com/)** (Para correr la Inteligencia Artificial de forma local).

### 2. Configurar la IA (Ollama)
Una vez que instales Ollama, abre tu consola de comandos (Terminal/PowerShell) y descarga el cerebro de la IA escribiendo esto:
```bash
ollama run qwen2.5:0.5b
```
*(Espera a que descargue. Puedes cerrar esa ventana una vez termine).*

### 3. Configurar el Backend (Python / FastAPI)
Abre una terminal nueva, entra a la carpeta de tu proyecto y ve a la carpeta `backend`:
```bash
cd backend
```
Crea un "entorno virtual" para guardar las librerías:
```bash
python -m venv venv
```
Actívalo:
```bash
# En Windows:
.\venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate
```
Instala todas las librerías necesarias:
```bash
pip install -r requirements.txt
```

**¡Importante! (Configuración de Base de Datos):**
Como los archivos `.env` (donde están tus contraseñas) no se suben a GitHub por seguridad, debes crear uno nuevo. En la carpeta `backend`, crea un archivo llamado `.env` y ponle tus credenciales de PostgreSQL. Por ejemplo:
```env
DB_USERNAME=postgres
DB_PASSWORD=tu_contraseña_aqui
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=db_minichatgpt
```

### 4. Configurar el Frontend (React / Next.js)
Abre OTRA terminal nueva, ve a la carpeta de tu proyecto y entra a `frontend`:
```bash
cd frontend
```
Instala los paquetes de diseño:
```bash
npm install
```

### 5. ¡Ejecutar el Proyecto!
Ahora tienes que prender ambos "motores" (el backend y el frontend).
- **Para prender el Backend:** En la terminal de la carpeta `backend` (con tu entorno activado), escribe: 
  `uvicorn main:app --reload`
- **Para prender el Frontend:** En la terminal de la carpeta `frontend`, escribe:
  `npm run dev`

¡Listo! Abre tu navegador en `http://localhost:3000` y disfruta de tu asistente.
