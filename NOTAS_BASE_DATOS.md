# Notas sobre la Base de Datos y Carga de Datos

## Comportamiento Actual

### Carga de Clientes

**IMPORTANTE**: El sistema actualmente **solo carga los clientes que se crean dinámicamente** a través de la interfaz, **NO carga los clientes hardcodeados** del archivo `data.sql`.

### Razón Técnica

Spring Boot con `spring.jpa.hibernate.ddl-auto=update` **NO ejecuta automáticamente** el archivo `data.sql` porque:

1. `ddl-auto=update` solo actualiza el esquema de la base de datos, no inserta datos
2. `data.sql` se ejecuta solo cuando:
   - `ddl-auto` está en `create` o `create-drop` (pero esto borra todos los datos existentes)
   - O se configura `spring.sql.init.mode=always` (pero puede causar errores de duplicados)

### Solución Actual

Los clientes hardcodeados en `backend/src/main/resources/data.sql` **NO se cargan automáticamente**. 

**Para cargar los datos iniciales**, hay dos opciones:

#### Opción 1: Cargar manualmente (Recomendado)
1. Reiniciar el backend con `ddl-auto=create` (solo la primera vez)
2. O insertar los datos manualmente a través de la interfaz
3. O usar la consola H2 en `http://localhost:8080/h2-console` para ejecutar los INSERTs

#### Opción 2: Cambiar configuración (Cuidado: borra datos existentes)
Cambiar en `application.properties`:
```properties
spring.jpa.hibernate.ddl-auto=create
spring.sql.init.mode=always
```
**ADVERTENCIA**: Esto borrará todos los datos existentes cada vez que se reinicie el backend.

### Base de Datos Persistente

- **H2 en archivo**: Los datos se guardan en `backend/data/tmsdb.mv.db`
- Los datos **persisten** entre reinicios del backend
- Los nuevos clientes creados **sí se guardan** y están disponibles

### Recomendación

Para producción con 1000+ pedidos diarios, se recomienda:
1. Usar **PostgreSQL** en lugar de H2
2. Cargar los datos iniciales mediante un script de migración (Flyway/Liquibase)
3. O cargar los datos iniciales manualmente una sola vez

## Estado Actual

✅ **Funciona**: Crear nuevos clientes desde la interfaz  
❌ **No funciona automáticamente**: Cargar clientes hardcodeados de `data.sql`  
✅ **Persistencia**: Los datos se guardan en archivo H2 y no se pierden al reiniciar

