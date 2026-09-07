import os
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import declarative_base

# pyrefly: ignore [missing-import]
from sqlalchemy.engine import URL

# Cargar variables de entorno desde el archivo .env
load_dotenv()

# Construir la URL de base de datos a partir de variables separadas
DB_USERNAME = os.getenv("DB_USERNAME", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_DATABASE = os.getenv("DB_DATABASE", "db_minichatgpt")

# Usar URL.create para que SQLAlchemy maneje automáticamente 
# los caracteres especiales en la contraseña (como el @)
SQLALCHEMY_DATABASE_URL = URL.create(
    drivername="postgresql",
    username=DB_USERNAME,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_DATABASE
)

# Crear el motor de SQLAlchemy
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependencia para usar en las rutas de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
