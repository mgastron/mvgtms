# Guía para Registrar la Aplicación en Tienda Nube Developers

Esta guía te ayudará a registrar tu aplicación en Tienda Nube para obtener las credenciales necesarias para la integración.

## Paso 1: Acceder al Portal de Socios de Tienda Nube

1. Ve a [https://partners.tiendanube.com](https://partners.tiendanube.com)
2. Inicia sesión con tu cuenta de Tienda Nube (o créala si no tienes una)
3. Si es tu primera vez, necesitarás crear un **perfil de socio tecnológico**

## Paso 2: Crear el Perfil de Socio Tecnológico

1. En el Portal de Socios, busca la opción para crear un nuevo perfil de socio
2. Completa la información requerida:
   - Nombre de la empresa/organización
   - Descripción de tus servicios
   - Información de contacto

## Paso 3: Crear una Nueva Aplicación

1. Una vez dentro del Portal de Socios, busca la sección **"Aplicaciones"** o **"Mis Aplicaciones"**
2. Haz clic en **"Crear nueva aplicación"** o **"Nueva aplicación"**
3. Completa el formulario con la siguiente información:
   - **Nombre de la aplicación**: `Zeta Llegue TMS` (o el nombre que prefieras)
   - **Tipo de aplicación**: Selecciona **"Aplicación externa"** (ya que no se integra dentro del Admin mediante iframe)
   - **Descripción**: Describe brevemente que es una integración para gestión de envíos y pedidos
   - **URL de la aplicación**: La URL pública donde está alojada tu aplicación (puede ser temporal con túnel)

## Paso 4: Configurar Webhooks (Requisito)

Tienda Nube **requiere** que configures webhooks en tu aplicación. Estos son endpoints HTTPS que recibirán notificaciones cuando ocurran eventos en las tiendas vinculadas.

### ¿Qué son los webhooks?

Los webhooks son notificaciones que Tienda Nube envía a tu aplicación cuando ocurren ciertos eventos:
- **Store Redact**: Cuando una tienda elimina/redacta datos
- **Customers Redact**: Cuando un cliente solicita la eliminación de sus datos personales
- **Customers Data Request**: Cuando un cliente solicita sus datos personales

### Configurar las URLs de Webhooks

Necesitas exponer tu backend con HTTPS. Si ya tienes un túnel de Cloudflare para el backend, úsalo. Si no, crea uno:

```bash
# En una terminal separada, expón el backend (puerto 8080)
cloudflared tunnel --url http://localhost:8080
```

Esto te dará una URL como: `https://tu-backend-url.trycloudflare.com`

Luego, en el Portal de Socios de Tienda Nube, en la sección **"Privacidad"** o **"Webhooks"**, completa los siguientes campos:

1. **URL webhook store redact**:
   ```
   https://tu-backend-url.trycloudflare.com/api/webhooks/tiendanube/store-redact
   ```

2. **URL webhook customers redact**:
   ```
   https://tu-backend-url.trycloudflare.com/api/webhooks/tiendanube/customers-redact
   ```

3. **URL webhook customers data request**:
   ```
   https://tu-backend-url.trycloudflare.com/api/webhooks/tiendanube/customers-data-request
   ```

> **⚠️ IMPORTANTE**: 
> - Reemplaza `tu-backend-url.trycloudflare.com` con la URL real de tu túnel del backend
> - Todas las URLs deben usar HTTPS (no HTTP)
> - Los endpoints ya están implementados en el backend y listos para recibir notificaciones

> **💡 Nota**: Si usas el mismo túnel de Cloudflare que para el frontend, asegúrate de que el backend también esté expuesto. Puedes usar dos túneles diferentes: uno para el frontend (puerto 3000) y otro para el backend (puerto 8080).

## Paso 5: Configurar la URL de Redirección (Redirect URI)

Tienda Nube **requiere HTTPS** para las URLs de redirección, por lo que no puedes usar `http://localhost:3000` directamente. Necesitas usar un túnel para exponer tu localhost con HTTPS.

### Opción A: Usar Cloudflare Tunnel (Recomendado - Gratuito y URL fija)

1. **Instalar cloudflared** (si no lo tienes):
   ```bash
   brew install cloudflared
   ```
   O descarga desde [https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

2. **Iniciar el túnel para el frontend**:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   
   Esto te dará una URL como: `https://floating-off-savings-charging.trycloudflare.com`

3. **En el Portal de Socios de Tienda Nube**, en la sección de configuración de tu aplicación, busca **"Redirect URI"** o **"URL de redirección"** y agrega:
   ```
   https://floating-off-savings-charging.trycloudflare.com/auth/tiendanube/callback
   ```
   > **⚠️ IMPORTANTE**: Reemplaza `floating-off-savings-charging.trycloudflare.com` con la URL que Cloudflare te dio

4. **Guardar los cambios** en el Portal de Socios

> **Nota**: La URL de Cloudflare Tunnel cambia cada vez que reinicias el túnel. Si necesitas una URL fija, considera usar ngrok con plan de pago o configurar un túnel permanente de Cloudflare.

### Opción B: Usar ngrok (Alternativa)

1. **Instalar ngrok**:
   ```bash
   brew install ngrok
   ```
   O descarga desde [https://ngrok.com/download](https://ngrok.com/download)

2. **Iniciar el túnel**:
   ```bash
   ngrok http 3000
   ```
   
   Esto te dará una URL como: `https://abc123.ngrok-free.app`

3. **Usar la URL de ngrok** en el Portal de Socios de Tienda Nube

## Paso 5: Obtener las Credenciales OAuth

Una vez creada la aplicación, necesitarás obtener las credenciales OAuth. El proceso puede variar según la versión del Portal de Socios, pero generalmente:

### Ubicación de las Credenciales:

1. **Ve a la página de detalles de tu aplicación** en el Portal de Socios
2. **Busca en las siguientes secciones** (pueden tener nombres diferentes):
   - **"OAuth"** o **"OAuth 2.0"**
   - **"API"** o **"API Keys"**
   - **"Credenciales"** o **"Credenciales de acceso"**
   - **"Autenticación"** o **"Configuración de autenticación"**
   - **"Integración"** o **"Configuración de integración"**
   - **"Seguridad"** o **"Configuración de seguridad"**

3. **Client ID** (también puede llamarse **App ID**, **Application ID**, o **Client Identifier**):
   - Este es tu identificador público de la aplicación
   - Generalmente se muestra directamente en la página
   - Es un número o string alfanumérico
   - Ejemplo: `123456` o `abc123def456`
   
4. **Client Secret** (también puede llamarse **App Secret**, **Secret Key**, o **Client Secret Key**):
   - Esta es tu clave secreta (¡manténla segura y nunca la compartas!)
   - Puede estar oculta con asteriscos (`****`) o puntos (`....`)
   - Busca un botón **"Mostrar"**, **"Revelar"**, **"Ver"**, o **"Show"** para verla
   - ⚠️ **CRÍTICO**: El Client Secret solo se muestra **una vez** al crear la aplicación
   - Si no lo guardaste, es posible que necesites **regenerarlo** (esto invalidará el anterior y requerirá actualizar todas las configuraciones)

### Si no encuentras las credenciales:

1. **Revisa todas las pestañas/secciones** de la página de tu aplicación:
   - Puede haber pestañas como "General", "Configuración", "API", "OAuth", etc.
   - Haz clic en cada una para buscar las credenciales

2. **Busca en el menú lateral o superior**:
   - Algunos portales tienen menús desplegables con opciones como "Ver credenciales" o "Mostrar API keys"

3. **Revisa la documentación de la aplicación**: 
   - Algunos portales muestran las credenciales en una sección específica de "Documentación" o "Guía de integración"
   - Puede haber un enlace a "Ver credenciales" o "Mostrar secret"

4. **Busca en el email de confirmación**: 
   - Cuando creaste la aplicación, es posible que hayas recibido un email con las credenciales

5. **Contacta soporte**: 
   - Si no encuentras las credenciales después de revisar todo, contacta al soporte de Tienda Nube para desarrolladores
   - Puedes mencionar que necesitas las credenciales OAuth (Client ID y Client Secret) para tu aplicación

### Notas Importantes:

- **El Client Secret es SENSIBLE**: Debe mantenerse **privado** y **nunca** compartirse
- **Nunca lo commitees al repositorio**: Usa variables de entorno o asegúrate de que `application.properties` esté en `.gitignore`
- **Si sospechas que fue comprometido**: Regéneralo inmediatamente desde el Portal de Socios
- **Guarda una copia segura**: Una vez que lo veas, guárdalo en un lugar seguro (gestor de contraseñas, etc.)

## Paso 7: Configurar las Credenciales en el Backend

Una vez que tengas el **Client ID** y **Client Secret**, configúralos en el backend:

### Opción 1: Variables de Entorno (Recomendado)

Agrega estas variables antes de iniciar el backend:

```bash
export TIENDANUBE_CLIENT_ID="tu_client_id_aqui"
export TIENDANUBE_CLIENT_SECRET="tu_client_secret_aqui"
export TIENDANUBE_REDIRECT_URI="https://floating-off-savings-charging.trycloudflare.com/auth/tiendanube/callback"
```

### Opción 2: application.properties

Agrega estas líneas a `backend/src/main/resources/application.properties`:

```properties
# Tienda Nube OAuth Configuration
tiendanube.client.id=tu_client_id_aqui
tiendanube.client.secret=tu_client_secret_aqui
tiendanube.redirect.uri=https://floating-off-savings-charging.trycloudflare.com/auth/tiendanube/callback
```

> **Nota**: El código del backend ya está configurado para leer desde `application.properties` como fallback si las variables de entorno no están configuradas. Solo necesitas descomentar y completar las líneas en `application.properties`.

## Paso 8: Verificar la Configuración

1. **Reinicia el backend** después de configurar las credenciales
2. **Prueba el flujo de vinculación**:
   - Ve a la página de clientes
   - Edita un cliente
   - Ve a la pestaña "CUENTAS"
   - Completa la URL de Tienda Nube
   - Guarda el cliente
   - Haz clic en "SYNC"
   - Deberías ver la página de autorización
   - Al hacer clic en "CONTINUAR A TIENDA NUBE", deberías ser redirigido a Tienda Nube para autorizar

## Recursos Útiles

- **Documentación oficial de Tienda Nube**: [https://dev.tiendanube.com/docs/getting-started](https://dev.tiendanube.com/docs/getting-started)
- **Portal de Socios**: [https://partners.tiendanube.com](https://partners.tiendanube.com)
- **Documentación de API**: [https://dev.tiendanube.com/docs](https://dev.tiendanube.com/docs)
- **Guía de autenticación**: Busca en la documentación la sección sobre OAuth y autenticación

## Troubleshooting

### Error: "TIENDANUBE_CLIENT_ID no configurado"
- Verifica que hayas configurado las variables de entorno o `application.properties`
- Asegúrate de haber reiniciado el backend después de configurar las credenciales

### Error: "Redirect URI mismatch"
- Verifica que la URL en el Portal de Socios coincida exactamente con la que configuraste en el backend
- Asegúrate de que ambas URLs usen HTTPS (no HTTP)
- Verifica que no haya espacios o caracteres extra en la URL

### Error: "Invalid client credentials"
- Verifica que el Client ID y Client Secret sean correctos
- Asegúrate de haber copiado el Client Secret completo (puede ser largo)
- Verifica que no haya espacios al inicio o final de las credenciales

## Notas Importantes

1. **URLs de Túnel**: Si usas Cloudflare Tunnel o ngrok, la URL cambia cada vez que reinicias el túnel. Necesitarás actualizar:
   - La Redirect URI en el Portal de Socios de Tienda Nube
   - La variable de entorno `TIENDANUBE_REDIRECT_URI` en el backend

2. **Seguridad**: Nunca commitees el Client Secret al repositorio. Usa variables de entorno o asegúrate de que `application.properties` esté en `.gitignore`.

3. **Scopes**: Puede que necesites solicitar permisos específicos (scopes) en el Portal de Socios. Los scopes comunes para gestión de envíos son:
   - `read_orders` - Leer pedidos
   - `write_orders` - Escribir/actualizar pedidos
   - `read_products` - Leer productos
   - `read_customers` - Leer clientes

## Próximos Pasos

Una vez que tengas la aplicación creada y las credenciales configuradas:

1. Prueba el flujo completo de vinculación
2. Verifica que los tokens se guarden correctamente
3. Implementa la sincronización de pedidos/envíos desde Tienda Nube
4. Configura webhooks (si están disponibles) para recibir notificaciones en tiempo real

