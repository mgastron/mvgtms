# Guía de Integración con Shopify - 2026

## ⚠️ CAMBIO IMPORTANTE

A partir del **1 de enero de 2026**, Shopify **eliminó completamente** la opción de crear Custom Apps desde el admin de la tienda. 

**Ya NO existe:**
- ❌ Settings > Apps and sales channel settings > Develop apps
- ❌ La opción de crear apps personalizadas desde el admin
- ❌ Access tokens directos sin OAuth

**Ahora TODO debe hacerse a través del Dev Dashboard**, pero hay una forma de obtener un access token después de instalar la app.

## Solución: Usar Dev Dashboard (Única opción disponible)

**IMPORTANTE**: Ya no hay forma de evitar el Dev Dashboard. Esta es la única forma de obtener un access token en 2026.

### Paso 1: Acceder al Dev Dashboard

1. Ve a [partners.shopify.com](https://partners.shopify.com)
2. Inicia sesión con tu cuenta de Shopify (o créala si no tienes una)
3. Si no tienes una cuenta de Partner, créala (es gratuita)

### Paso 2: Crear una App

1. En el Dev Dashboard, haz clic en **"Apps"** en el menú lateral
2. Haz clic en **"Create app"**
3. Selecciona **"Create app manually"** (no usar plantillas)
4. Ingresa un nombre para tu app (ej: "Zeta Llegué TMS Integration")
5. Haz clic en **"Create app"**

### Paso 3: Guardar Credenciales

1. En la página de tu app en el Dev Dashboard, ve a **"Settings"** (en el menú lateral)
2. En la sección **"Credentials"**, verás:
   - **Client ID**: copialo y configuralo en `application.properties` o en variables de entorno (SHOPIFY_CLIENT_ID)
   - **Secret**: copialo y configuralo en `application.properties` o en variables de entorno (SHOPIFY_CLIENT_SECRET). **No subas este valor a Git.**
3. **Guarda estos valores en un lugar seguro** — los necesitarás para OAuth y para producción (variables de entorno en AWS).

### Paso 4: Crear una Versión de la App

1. Ve a **"Versions"** en el menú lateral de tu app en el Dev Dashboard
2. Haz clic en **"New version"** o **"Create version"**
3. Se abrirá la página "Create a version"

#### Configuración Básica:

**App name:**
- Deja el nombre por defecto: "Zeta Llegué TMS Integration" (o el que prefieras, máximo 30 caracteres)

**URLs:**
- **App URL**: ⚠️ **IMPORTANTE**: Esta URL es para cuando la app está embebida en Shopify admin.
  - Puedes usar la URL del frontend: `https://watching-songs-hydraulic-situations.trycloudflare.com`
  - O dejarla vacía si no vas a usar la app embebida
  - **NO uses la URL del backend aquí** - el callback de OAuth se configura en "Redirect URLs" más abajo
- **Embed app in Shopify admin**: ✅ Marca esta casilla (aunque no vayas a usar la app embebida, ayuda con la instalación)
- **Preferences URL (optional)**: Déjalo vacío

**Webhooks API Version:**
- Selecciona la versión más reciente disponible (ej: "2026-01")

#### Configuración de Acceso (Sección "Access"):

**Scopes (Required):**
1. Haz clic en **"Select scopes"** junto a "Scopes"
2. Se abrirá un modal con todos los scopes disponibles
3. **Busca y marca EXACTAMENTE estos scopes** (en orden de importancia):

   **SCOPES ESENCIALES (Mínimos requeridos):**
   
   En la sección **"Admin API"**, busca y marca:
   
   - ✅ **"All orders"** → Marca SOLO `read_all_orders` 
     - *Esto te da acceso a TODOS los pedidos (abiertos, cerrados, cancelados, etc.)*
     - *NO marques `write_all_orders`*
   
   - ✅ **"Orders"** → Marca SOLO `read_orders`
     - *Complementa el scope anterior para acceso completo a pedidos*
     - *NO marques `write_orders`*
   
   - ✅ **"Customer"** → Marca SOLO `read_customers`
     - *Necesario para obtener información del cliente/destinatario del pedido*
     - *NO marques `write_customers`*
   
   - ✅ **"Shipping rates"** → Marca SOLO `read_shipping`
     - *Necesario para obtener el método de envío del pedido*
     - *NO marques `write_shipping`*
   
   **SCOPES RECOMENDADOS (Para información completa):**
   
   - ✅ **"Fulfillments"** → Marca SOLO `read_fulfillments`
     - *Para obtener información de cumplimiento/envío de los pedidos*
     - *NO marques `write_fulfillments`*

4. **INSTRUCCIONES ESPECÍFICAS PARA EL MODAL:**
   - El modal tiene un **buscador** en la parte superior - úsalo para encontrar rápidamente cada scope
   - Asegúrate de que el dropdown diga **"All APIs"** o **"Admin API"** (no Customer Account API ni Storefront API)
   - **Solo marca checkboxes de "read"**, nunca de "write"
   - Verifica que hayas marcado exactamente estos 5 scopes:
     1. `read_all_orders`
     2. `read_orders`
     3. `read_customers`
     4. `read_shipping`
     5. `read_fulfillments`

5. Una vez marcados todos, haz clic en **"Done"** (botón azul en la esquina inferior derecha)

**Optional scopes:**
- Déjalo vacío (no es necesario para esta integración)
- Si en el futuro necesitas permisos adicionales, puedes agregarlos aquí

**Use legacy install flow:**
- ✅ **Marca esta casilla** - Esto es importante para obtener el access token directamente sin OAuth complejo

**Redirect URLs:**
- ⚠️ **CRÍTICO**: Debe ser la URL de tu backend donde manejaremos el callback de OAuth
- Formato: `https://tu-backend-url.com/api/clientes/shopify/callback`
- Ejemplo con Cloudflare tunnel: `https://location-specifications-champions-television.trycloudflare.com/api/clientes/shopify/callback`
- **Esta URL debe coincidir EXACTAMENTE** con la que configuramos en el backend
- **NO puede ser** `https://example.com` - debe ser una URL real y accesible

#### Secciones que NO necesitas configurar:

- **POS**: No marques "Embed app in Shopify POS" (no lo necesitas)
- **App proxy**: No es necesario para esta integración

#### Finalizar:

1. Haz clic en **"Release"** en la esquina inferior derecha
2. Esto creará y activará la nueva versión de tu app

### Paso 5: Configurar URLs Correctas en la Versión (IMPORTANTE)

**⚠️ ANTES de instalar la app, debes corregir las URLs en la versión:**

1. Ve a **"Versions"** en el menú lateral
2. Haz clic en la versión activa (ej: "zeta-llegue-tms-integration-2")
3. O crea una nueva versión si ya instalaste con URLs incorrectas

**En la sección "URLs":**
- **App URL**: ⚠️ **IMPORTANTE**: Esta URL es para cuando la app está embebida en Shopify admin. 
  - Puedes usar la URL del frontend: `https://watching-songs-hydraulic-situations.trycloudflare.com`
  - O dejarla vacía si no vas a usar la app embebida
  - **NO uses la URL del backend aquí** porque Shopify podría usarla como redirect
- **Embed app in Shopify admin**: ✅ Mantén marcado
- **Preferences URL**: Déjalo vacío

**En la sección "Access" > "Redirect URLs":**
- ⚠️ **CRÍTICO**: Esta es la URL que Shopify usará para el callback de OAuth
- Agrega EXACTAMENTE esta URL (una por línea):
  ```
  https://location-specifications-champions-television.trycloudflare.com/api/clientes/shopify/callback
  ```
- **IMPORTANTE**: 
  - Esta URL debe coincidir EXACTAMENTE con la configurada en el backend
  - Debe ser la URL del BACKEND, no del frontend
  - Shopify redirigirá aquí después de la autorización

4. Haz clic en **"Release"** para guardar los cambios

### Paso 6: Vincular la App desde el TMS (NO usar "Install app" del Dev Dashboard)

**⚠️ IMPORTANTE**: NO uses el botón "Install app" del Dev Dashboard. Ese botón es para apps embebidas y no inicia el flujo OAuth correctamente.

**En su lugar, sigue estos pasos:**

1. Ve a tu **TMS** (sistema interno)
2. Ve a **Clientes > Editar Cliente** (el cliente que quieres vincular con Shopify)
3. En la sección de **Shopify**:
   - Ingresa la **SHOPIFY URL** (ej: `https://mvgtms.myshopify.com`)
   - Haz clic en **"Guardar"** para guardar el cliente
4. Después de guardar, aparecerá el botón **"SYNC"** junto a la URL
5. Haz clic en **"SYNC"** - esto generará un link de vinculación
6. Se abrirá un modal con el link - cópialo o ábrelo directamente
7. El link te llevará a una página de autorización donde verás qué permisos se solicitarán
8. Haz clic en **"CONTINUAR A SHOPIFY"**
9. Shopify te redirigirá a la página de autorización oficial
10. Autoriza los permisos solicitados
11. Shopify redirigirá al callback del backend (`/api/clientes/shopify/callback`)
12. El backend procesará el callback y guardará el access token automáticamente
13. La **CLAVE UNICA** se completará automáticamente en el modal del cliente

**Si ves un error:**
- Verifica que la "App URL" NO sea la URL del backend (debe ser del frontend o vacía)
- Verifica que las "Redirect URLs" tengan EXACTAMENTE: `https://location-specifications-champions-television.trycloudflare.com/api/clientes/shopify/callback`
- Asegúrate de haber hecho "Release" después de cambiar las URLs
- Verifica que el backend esté accesible públicamente (Cloudflare tunnel funcionando)

### Paso 7: Verificar que el Access Token se Guardó Correctamente

**✅ IMPORTANTE**: Con el flujo OAuth implementado, el access token se guarda **automáticamente** en el backend después de que autorices la app.

**Proceso automático:**
1. Cuando haces clic en "SYNC" y autorizas, Shopify redirige al callback del backend
2. El backend (`/api/clientes/shopify/callback`) procesa el código de autorización
3. El backend intercambia el código por el access token usando el Client ID y Secret
4. El access token se guarda automáticamente en la base de datos del cliente

**Para verificar que funcionó:**

1. Ve a tu **TMS** (sistema interno)
2. Ve a **Clientes > Editar Cliente** (el cliente que vinculaste)
3. En la sección de Shopify, deberías ver que el campo **"CLAVE UNICA"** está lleno
4. El token debería tener formato: `shpat_...` (ejemplo genérico: `shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

**⚠️ Nota importante:**
- **NO busques el access token en Shopify Admin** - las apps del Dev Dashboard no muestran el token directamente
- El token **ya está guardado automáticamente** en tu base de datos después de la autorización
- Puedes verificar el token en los logs del backend si necesitas confirmarlo (busca "Respuesta de Shopify (token exchange)")

### Paso 8: Probar la Integración

**Para verificar que todo funciona correctamente:**

1. **Haz una compra de prueba en tu tienda de Shopify**
   - Crea un pedido de prueba con un producto
   - Completa el checkout con datos reales (dirección, teléfono, email)
   - Asegúrate de que el método de envío coincida con el configurado en el cliente (si aplica)

2. **Verifica que el pedido aparezca en el TMS:**
   - Ve a **Sistema > Estado Órdenes**
   - Deberías ver el pedido de Shopify en la lista
   - Si el método de envío coincide con el configurado, debería aparecer en verde (procesado automáticamente)
   - Si no coincide, aparecerá en rojo y podrás procesarlo manualmente con "REPROCESAR"

3. **Verifica que el envío se creó:**
   - Ve a **Envíos > Envíos**
   - Filtra por origen "Shopify"
   - Deberías ver el envío creado desde el pedido de prueba

4. **Verifica los datos del envío:**
   - Haz clic en el envío para ver los detalles
   - Verifica que todos los datos estén correctos (destinatario, dirección, teléfono, email, etc.)
   - Verifica que la zona de entrega y el costo de envío se hayan calculado correctamente

**Si algo no funciona:**
- Revisa los logs del backend para ver errores
- Verifica que el método de envío en Shopify coincida con el configurado en el cliente
- Verifica que el cliente tenga una lista de precios asignada para calcular el costo de envío

## Troubleshooting

### Error: "El cliente no tiene Access Token de Shopify configurado"
- Verifica que el access token esté correctamente copiado (sin espacios al inicio/final)
- Asegúrate de que el token tenga el formato `shpat_...`

### Error: "El cliente no tiene Shop Name de Shopify configurado"
- Verifica que la URL esté en el formato correcto
- Puede ser `https://tu-tienda.myshopify.com` o solo `tu-tienda.myshopify.com`

### Error: "Error al obtener pedidos de Shopify"
- Verifica que el access token tenga los permisos correctos (`read_orders`)
- Verifica que la app esté instalada en la tienda
- Verifica que la versión de la API sea compatible (el sistema usa `2024-01`)

## Notas Importantes

- El access token es **sensible** - no lo compartas públicamente
- Si regeneras el token, deberás actualizarlo en el TMS
- Los permisos de la app determinan qué datos puedes acceder
- La app debe estar **instalada** en la tienda para que funcione

