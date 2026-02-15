# Guía para Registrar la Aplicación en MercadoLibre Developers

Esta guía te ayudará a registrar tu aplicación en MercadoLibre Developers para obtener las credenciales necesarias para la integración con Flex.

## Paso 1: Acceder a MercadoLibre Developers

1. Ve a [https://developers.mercadolibre.com.ar/](https://developers.mercadolibre.com.ar/)
2. Inicia sesión con tu cuenta de MercadoLibre (o créala si no tienes una)

## Paso 2: Crear una Nueva Aplicación

1. Una vez dentro del panel de desarrolladores, haz clic en **"Crear nueva aplicación"** o **"My Applications"**
2. Completa el formulario con la siguiente información:
   - **Nombre de la aplicación**: `Zeta Llegue TMS` (o el nombre que prefieras)
   - **Tipo de aplicación**: Selecciona **"Integración"**
   - **Descripción**: Describe brevemente que es una integración para gestión de envíos Flex

## Paso 3: Configurar la URL de Redirección

MercadoLibre **requiere HTTPS** para las URLs de redirección, por lo que no puedes usar `http://localhost:3000` directamente. Necesitas usar un túnel para exponer tu localhost con HTTPS.

### Opción A: Usar ngrok (Recomendado para desarrollo rápido)

1. **Instalar ngrok**:
   - Descarga desde [https://ngrok.com/download](https://ngrok.com/download)
   - O instala con Homebrew: `brew install ngrok`
   - O con npm: `npm install -g ngrok`

2. **Crear cuenta gratuita en ngrok** (opcional pero recomendado):
   - Ve a [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
   - Crea una cuenta y obtén tu authtoken

3. **Configurar ngrok** (si creaste cuenta):
   ```bash
   ngrok config add-authtoken TU_AUTH_TOKEN
   ```

4. **Iniciar el túnel**:
   ```bash
   ngrok http 3000
   ```
   
   Esto te dará una URL como: `https://abc123.ngrok-free.app`

5. **Copiar la URL HTTPS** que ngrok te proporciona (ejemplo: `https://abc123.ngrok-free.app`)

6. **En MercadoLibre Developers**, en la sección **"Redirect URI"**, agrega:
   ```
   https://abc123.ngrok-free.app/auth/mercadolibre/callback
   ```
   
   **⚠️ IMPORTANTE**: Si ya tienes una app configurada con un túnel viejo (ej: `floating-off-savings-charging.trycloudflare.com`), debes actualizarla con el túnel nuevo:
   - Túnel actual (2026): `https://watching-songs-hydraulic-situations.trycloudflare.com/auth/mercadolibre/callback`
   - Actualiza la "Redirect URI" en tu app de MercadoLibre Developers con esta URL
   > **⚠️ IMPORTANTE**: Reemplaza `abc123.ngrok-free.app` con la URL que ngrok te dio

7. **Actualizar la configuración del backend**:
   - Actualiza la variable de entorno `MERCADOLIBRE_REDIRECT_URI` con la URL de ngrok:
   ```bash
   export MERCADOLIBRE_REDIRECT_URI="https://abc123.ngrok-free.app/auth/mercadolibre/callback"
   ```

8. **Guardar los cambios** en MercadoLibre Developers

> **Nota**: La URL de ngrok cambia cada vez que reinicias ngrok (en el plan gratuito). Si quieres una URL fija, necesitas el plan de pago de ngrok o usar Cloudflare Tunnel.

### Opción B: Usar Cloudflare Tunnel (URL fija y gratuita)

1. **Instalar cloudflared**:
   ```bash
   brew install cloudflared
   ```
   O descarga desde [https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

2. **Iniciar el túnel**:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   
   Esto te dará una URL como: `https://abc123.trycloudflare.com`

3. **Usar la URL de Cloudflare** en MercadoLibre Developers (igual que con ngrok)

> **Ventaja**: Cloudflare Tunnel es completamente gratuito y no requiere cuenta para uso básico.

### Opción C: Usar localtunnel (Alternativa gratuita)

1. **Instalar localtunnel**:
   ```bash
   npm install -g localtunnel
   ```

2. **Iniciar el túnel**:
   ```bash
   lt --port 3000
   ```
   
   Esto te dará una URL como: `https://abc123.loca.lt`

3. **Usar la URL de localtunnel** en MercadoLibre Developers

> **Nota**: localtunnel puede ser más lento y menos estable que ngrok o Cloudflare Tunnel.

## Paso 4: Obtener las Credenciales

Una vez creada la aplicación, verás:
- **Client ID** (App ID) - Se muestra en la tarjeta de la aplicación
- **Client Secret** (Secret Key) - **Solo se muestra una vez al crear la aplicación**

### Cómo obtener el Client Secret:

**Opción 1: Si lo viste al crear la aplicación**
- Deberías haberlo guardado en ese momento
- Si no lo guardaste, ve a la Opción 2

**Opción 2: Regenerar el Client Secret**
1. Haz clic en la aplicación "MVG TMS" (o el nombre que le pusiste)
2. Ve a la sección **"Credenciales"** o **"Seguridad"**
3. Busca la opción **"Regenerar Secret Key"** o **"Regenerar Client Secret"**
4. ⚠️ **ATENCIÓN**: Al regenerarlo, el secret anterior dejará de funcionar
5. Copia el nuevo secret inmediatamente (solo se muestra una vez)

**Opción 3: Buscar en la configuración**
1. Dentro de la aplicación, busca la pestaña **"Credenciales"** o **"Configuración"**
2. El Client Secret puede estar oculto con asteriscos o puntos
3. Si está oculto, busca un botón **"Mostrar"** o **"Revelar"**

**¡IMPORTANTE!** Guarda estas credenciales de forma segura. El Client Secret solo se muestra una vez.

## Paso 5: Configurar las Variables de Entorno

Agrega las siguientes variables de entorno en tu sistema o en el archivo de configuración del backend:

### Opción A: Variables de entorno del sistema

```bash
# Si usas ngrok o Cloudflare Tunnel, usa la URL HTTPS que te proporcionan
export MERCADOLIBRE_CLIENT_ID="tu_client_id_aqui"
export MERCADOLIBRE_CLIENT_SECRET="tu_client_secret_aqui"
export MERCADOLIBRE_REDIRECT_URI="https://tu-tunel-url.com/auth/mercadolibre/callback"
# Ejemplo con ngrok: https://abc123.ngrok-free.app/auth/mercadolibre/callback
# Ejemplo con Cloudflare: https://abc123.trycloudflare.com/auth/mercadolibre/callback
```

### Opción B: Archivo `application.properties` (solo para desarrollo)

Agrega al archivo `backend/src/main/resources/application.properties`:

```properties
# MercadoLibre OAuth Configuration
mercadolibre.client.id=tu_client_id_aqui
mercadolibre.client.secret=tu_client_secret_aqui
# Usa la URL HTTPS de tu túnel (ngrok, Cloudflare, etc.)
mercadolibre.redirect.uri=https://tu-tunel-url.com/auth/mercadolibre/callback
```

Luego, actualiza `ClienteService.java` para leer desde `application.properties`:

```java
@Value("${mercadolibre.client.id}")
private String defaultClientId;

@Value("${mercadolibre.client.secret}")
private String defaultClientSecret;

@Value("${mercadolibre.redirect.uri}")
private String defaultRedirectUri;
```

## Paso 6: Configurar los Scopes (Permisos)

En la página de tu aplicación en MercadoLibre Developers, configura lo siguiente:

### Flujos OAuth:
- ✅ **Authorization Code** - Debe estar tildado (ya lo tienes)
- ✅ **Refresh Token** - **DEBES TILDARLO** (necesario para renovar tokens automáticamente)
- ❌ **Client Credentials** - Puedes dejarlo sin tildar (solo si no necesitas autenticación de aplicación)
- ❌ **pkce** - Puedes dejarlo sin tildar

### Negocios:
- ✅ **Mercado Libre** - **DEBES TILDARLO** (necesario para Flex)
- ❌ **VIS** - Déjalo sin tildar (solo si no trabajas con VIS)

### Permisos:
- ✅ **Usuarios** - "Lectura y escritura" (ya lo tienes configurado) ✓
- Los demás permisos pueden quedar en "Sin acceso" por ahora

### Tópicos (Topics) - **MUY IMPORTANTE PARA FLEX**:

En la sección **"Shipments"**, debes tildar:
- ✅ **Shipments** - Para recibir notificaciones de envíos
- ✅ **Flex-Handshakes** - **CRÍTICO** para la integración con Flex
- ❌ **Fbm Stock Operations** - Opcional, solo si necesitas gestión de stock FBM

**NO necesitas tildar nada en:**
- Orders
- Messages
- Prices
- Items
- Catalog
- Promotions
- VIS Leads
- Post Purchase
- Others

### Configuración de Notificaciones (Callbacks):
- **DEBES completar el campo "Notificaciones callbacks URL"**
- Usa la misma URL HTTPS de tu túnel, pero apuntando al endpoint de webhooks:
  ```
  https://tu-tunel-url.com/api/webhooks/mercadolibre
  ```
- Ejemplo con Cloudflare Tunnel:
  ```
  https://shake-blake-calgary-generates.trycloudflare.com/api/webhooks/mercadolibre
  ```
- **IMPORTANTE**: Debe empezar con `https://` (MercadoLibre lo exige)
- Este endpoint lo implementaremos después para recibir notificaciones automáticas de pedidos

## Paso 6.5: Iniciar el Túnel HTTPS

Antes de probar la integración, necesitas tener el túnel HTTPS corriendo:

### Usando el script incluido:
```bash
# Desde la raíz del proyecto
./scripts/start-tunnel.sh ngrok 3000
# O con Cloudflare:
./scripts/start-tunnel.sh cloudflare 3000
```

### Manualmente:
```bash
# ngrok
ngrok http 3000

# Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000

# localtunnel
lt --port 3000
```

**⚠️ IMPORTANTE**: 
- Mantén el túnel corriendo mientras pruebas la integración
- Si la URL del túnel cambia, actualiza la Redirect URI en MercadoLibre Developers
- Actualiza la variable de entorno `MERCADOLIBRE_REDIRECT_URI` con la nueva URL

## Paso 7: Probar la Integración

1. Reinicia el backend para que cargue las nuevas variables de entorno
2. Abre un cliente en la aplicación web
3. Ve a la pestaña "CUENTAS"
4. Haz clic en "Link vinculación" en la sección Flex
5. El link se copiará al portapapeles
6. Abre el link en el navegador
7. Marca o desmarca el checkbox de "FulFillment (WMS)" según necesites
8. Haz clic en "CONTINUAR A MERCADOLIBRE"
9. Inicia sesión en MercadoLibre y autoriza la aplicación
10. Serás redirigido de vuelta a la aplicación y la cuenta quedará vinculada

## Solución de Problemas

### Error: "MERCADOLIBRE_CLIENT_ID no configurado"
- Verifica que hayas configurado las variables de entorno correctamente
- Reinicia el backend después de configurar las variables

### Error: "redirect_uri_mismatch"
- Verifica que la URL de redirección en MercadoLibre Developers coincida exactamente con la configurada
- Asegúrate de que no haya espacios o caracteres especiales

### Error: "invalid_client"
- Verifica que el Client ID y Client Secret sean correctos
- Asegúrate de que no hayas copiado espacios adicionales

## Próximos Pasos

Una vez que la integración OAuth esté funcionando, podrás:
1. Recibir pedidos automáticamente desde MercadoLibre Flex
2. Sincronizar estados de envíos
3. Obtener información de los pedidos en tiempo real

Para implementar la recepción automática de pedidos, necesitarás configurar webhooks o implementar polling periódico.

