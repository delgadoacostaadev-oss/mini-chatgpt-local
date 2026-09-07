from database import engine
import models

print("Borrando tablas antiguas...")
models.Base.metadata.drop_all(bind=engine)
print("Creando tablas nuevas con Usuarios...")
models.Base.metadata.create_all(bind=engine)
print("¡Listo!")
