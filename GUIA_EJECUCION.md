# 🚀 Guía Rápida de Ejecución - TMS Llegue

## Opción 1: Solo Frontend (Más Rápido)

Si solo quieres ver la interfaz sin el backend:

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar el servidor de desarrollo
npm run dev
```

Luego abre tu navegador en: **http://localhost:3000**

> ⚠️ Nota: El filtrado funcionará con datos de prueba (mock data) que están en el componente.

---

## Opción 2: Frontend + Backend (Completo)

### Requisitos Previos

- **Node.js** (v18 o superior) - [Descargar](https://nodejs.org/)
- **Java 17** o superior - [Descargar](https://adoptium.net/)
- **Maven** - [Descargar](https://maven.apache.org/download.cgi)

### Verificar Instalaciones

```bash
# Verificar Node.js
node --version

# Verificar Java
java -version

# Verificar Maven
mvn --version
```

### Paso 1: Ejecutar el Backend

```bash
# Navegar al directorio backend
cd backend

# Compilar y ejecutar (primera vez puede tardar descargando dependencias)
mvn spring-boot:run

# O si tienes Maven Wrapper:
# ./mvnw spring-boot:run
```

El backend estará disponible en: **http://localhost:8080**

Puedes probar la API en: **http://localhost:8080/api/clientes**

Consola H2 (base de datos): **http://localhost:8080/h2-console**
- JDBC URL: `jdbc:h2:mem:testdb`
- Usuario: `sa`
- Contraseña: (dejar vacío)

### Paso 2: Ejecutar el Frontend

En una **nueva terminal** (deja el backend corriendo):

```bash
# Volver a la raíz del proyecto (si estás en backend/)
cd ..

# Instalar dependencias (solo la primera vez)
npm install

# Ejecutar el servidor de desarrollo
npm run dev
```

El frontend estará disponible en: **http://localhost:3000**

---

## 🎯 Qué Verás

1. **Sidebar izquierdo**: Menú de navegación con "Clientes" activo
2. **Header**: Título "CLIENTES" y botón "NUEVO"
3. **Filtros**: Formulario con campos para filtrar clientes
4. **Tabla**: Lista de clientes con paginación
5. **Acciones**: Botones para ver, editar y eliminar (aún no conectados al backend)

---

## 🔧 Solución de Problemas

### Error: "Cannot find module"
```bash
# Eliminar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Error: "Port 3000 already in use"
```bash
# Usar otro puerto
PORT=3001 npm run dev
```

### Error: "Port 8080 already in use"
Edita `backend/src/main/resources/application.properties` y cambia:
```properties
server.port=8081
```

### Error con Maven/Java
- Asegúrate de tener Java 17+ instalado
- Verifica que Maven esté en tu PATH
- En macOS: `brew install maven`

---

## 📝 Notas Importantes

- El frontend actualmente usa **datos mock** (simulados)
- El filtrado funciona en tiempo real con los datos mock
- El backend está listo pero **no está conectado** al frontend aún
- La base de datos H2 es en memoria, se reinicia cada vez que reinicias el backend

---

## ✅ Próximos Pasos

Una vez que veas que todo funciona:
1. Conectar el frontend con el backend (hacer llamadas API)
2. Implementar crear/editar/eliminar clientes
3. Agregar más funcionalidades

