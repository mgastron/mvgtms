# TMS Llegue - Sistema de Gestión de Transporte

Sistema completo de gestión de transporte y logística con frontend en Next.js y backend en Java Spring Boot.

## Estructura del Proyecto

```
tms-llegue/
├── app/                    # Frontend Web Next.js (legacy - será movido a web/)
│   ├── globals.css        # Estilos globales
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Página principal (Clientes)
├── components/            # Componentes React (legacy - será movido a web/)
│   ├── ui/               # Componentes UI base
│   ├── sidebar.tsx       # Barra lateral de navegación
│   └── ...
├── lib/                  # Utilidades (legacy - será movido a web/)
│   └── utils.ts          # Funciones auxiliares
├── web/                   # Frontend Web Next.js (futuro)
├── mobile/                # Aplicación móvil React Native/Expo
│   ├── src/
│   │   ├── screens/      # Pantallas de la app
│   │   ├── components/  # Componentes reutilizables
│   │   ├── navigation/   # Configuración de navegación
│   │   ├── services/     # Servicios (API, auth, location)
│   │   └── types/        # Tipos TypeScript
│   └── App.tsx           # Punto de entrada
└── backend/              # Backend Java Spring Boot
    └── src/main/java/com/zetallegue/tms/
        ├── model/        # Entidades JPA
        ├── repository/   # Repositorios
        ├── service/      # Lógica de negocio
        ├── controller/   # Controladores REST
        └── dto/          # Data Transfer Objects
```

## Características Implementadas

### Frontend Web
- ✅ Interfaz de gestión de clientes
- ✅ Filtrado en tiempo real por múltiples campos
- ✅ Paginación funcional
- ✅ Sidebar de navegación
- ✅ Diseño responsive con Tailwind CSS
- ✅ Componentes UI reutilizables
- ✅ Gestión de envíos con filtros avanzados
- ✅ Gestión de usuarios
- ✅ Lista de precios

### Aplicación Móvil
- ✅ Login con validación de usuarios del backend
- ✅ Validación obligatoria de permisos GPS
- ✅ Bloqueo de usuarios tipo "Cliente" (deben usar la web)
- ✅ Pantalla principal con botones Colectar y Asignar
- ✅ Drawer lateral con información del usuario
- ✅ Cerrar sesión

### Backend
- ✅ API REST para gestión de clientes
- ✅ API REST para gestión de envíos
- ✅ API REST para gestión de usuarios
- ✅ Endpoint de autenticación (`/api/usuarios/login`)
- ✅ Filtrado avanzado con JPA Specifications
- ✅ Paginación
- ✅ Validación de datos
- ✅ Base de datos H2 para desarrollo
- ✅ Estructura lista para PostgreSQL en producción
- ✅ Optimizaciones de rendimiento para alta carga

## Instalación y Uso

### Frontend Web

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# El frontend estará disponible en http://localhost:3000
```

### Aplicación Móvil

```bash
# Navegar al directorio mobile
cd mobile

# Instalar dependencias
npm install

# Configurar la URL de la API en src/config/api.ts
# Cambiar la IP por la de tu máquina local

# Ejecutar en desarrollo
npm start
# O directamente en Android
npm run android
```

**Importante**: Para que la app móvil se conecte al backend, necesitas:
1. Asegurarte de que el backend esté corriendo
2. Encontrar tu IP local (macOS/Linux: `ifconfig | grep "inet "`, Windows: `ipconfig`)
3. Actualizar `mobile/src/config/api.ts` con tu IP local
4. Asegurarte de que tu dispositivo/emulador esté en la misma red

### Backend

```bash
# Navegar al directorio backend
cd backend

# Compilar y ejecutar (requiere Maven)
mvn spring-boot:run

# O si tienes Maven Wrapper
./mvnw spring-boot:run

# El backend estará disponible en http://localhost:8080
# La consola H2 estará en http://localhost:8080/h2-console
```

## API Endpoints

### Autenticación

- `POST /api/usuarios/login` - Iniciar sesión
  - Body: `{ "usuario": "string", "contraseña": "string" }`
  - Response: `{ "success": boolean, "message": "string", "usuario": UsuarioDTO, "token": "string" }`

### Usuarios

- `GET /api/usuarios` - Listar usuarios con paginación
- `GET /api/usuarios/{id}` - Obtener un usuario por ID
- `POST /api/usuarios` - Crear un nuevo usuario
- `PUT /api/usuarios/{id}` - Actualizar un usuario
- `DELETE /api/usuarios/{id}` - Eliminar un usuario

### Clientes

- `GET /api/clientes` - Listar clientes con filtros y paginación
- `GET /api/clientes/{id}` - Obtener un cliente por ID
- `POST /api/clientes` - Crear un nuevo cliente
- `PUT /api/clientes/{id}` - Actualizar un cliente
- `DELETE /api/clientes/{id}` - Eliminar un cliente
- `PATCH /api/clientes/{id}/toggle-habilitado` - Cambiar estado habilitado

### Envíos

- `GET /api/envios` - Listar envíos con filtros y paginación
- `GET /api/envios/{id}` - Obtener un envío por ID
- `GET /api/envios/recientes` - Obtener envíos de la última semana
- `POST /api/envios` - Crear un nuevo envío
- `POST /api/envios/masivos` - Crear múltiples envíos
- `PUT /api/envios/{id}` - Actualizar un envío
- `PATCH /api/envios/{id}/estado` - Actualizar estado de un envío
- `PATCH /api/envios/{id}/eliminar` - Marcar envío como eliminado

### Parámetros de Filtrado (GET /api/clientes)

- `codigo` - Filtrar por código
- `nombreFantasia` - Filtrar por nombre fantasía
- `razonSocial` - Filtrar por razón social
- `numeroDocumento` - Filtrar por número de documento
- `habilitado` - Filtrar por estado (todos, habilitado, deshabilitado)
- `integraciones` - Filtrar por integraciones
- `page` - Número de página (default: 0)
- `size` - Tamaño de página (default: 10)

## Próximos Pasos

- [ ] Conectar frontend con backend mediante API calls
- [ ] Implementar autenticación y autorización
- [ ] Agregar más funcionalidades a la tabla (editar, eliminar, ver detalles)
- [ ] Implementar las demás secciones del sistema (Envíos, Informes, etc.)
- [ ] Configurar base de datos PostgreSQL para producción
- [ ] Agregar tests unitarios y de integración

## Tecnologías Utilizadas

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Radix UI
- Lucide React

### Backend
- Java 17
- Spring Boot 3.2
- Spring Data JPA
- H2 Database (desarrollo)
- Lombok
- Maven

