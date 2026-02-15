# Solución: Exponer Backend para Acceso Remoto

## Problema
El frontend hace llamadas a `localhost:8080` que no es accesible desde fuera. Cuando un cliente externo intenta usar el link de vinculación, falla porque no puede acceder al backend.

## Solución: Exponer el Backend con Cloudflare Tunnel

Necesitas exponer **ambos servicios**:
- Frontend (puerto 3000) → Ya expuesto ✅
- Backend (puerto 8080) → **Necesitas exponerlo también**

## Pasos Rápidos

### 1. Inicia dos túneles Cloudflare

**Terminal 1 - Frontend:**
```bash
cloudflared tunnel --url http://localhost:3000
```
Anota la URL: `https://frontend-abc123.trycloudflare.com`

**Terminal 2 - Backend:**
```bash
cloudflared tunnel --url http://localhost:8080
```
Anota la URL: `https://backend-xyz789.trycloudflare.com`

### 2. Configura la URL del Backend

Crea un archivo `.env.local` en la raíz del proyecto (al mismo nivel que `package.json`):

```bash
NEXT_PUBLIC_BACKEND_TUNNEL_URL=https://backend-xyz789.trycloudflare.com
```

⚠️ **Reemplaza `backend-xyz789.trycloudflare.com` con la URL real que te dio Cloudflare para el backend.**

### 3. Actualiza la Redirect URI en MercadoLibre

En MercadoLibre Developers, actualiza la Redirect URI a:
```
https://frontend-abc123.trycloudflare.com/auth/mercadolibre/callback
```

### 4. Actualiza application.properties

En `backend/src/main/resources/application.properties`:
```properties
mercadolibre.redirect.uri=https://frontend-abc123.trycloudflare.com/auth/mercadolibre/callback
```

### 5. Reinicia el Frontend

```bash
# Detén el servidor Next.js (Ctrl+C)
# Reinicia
npm run dev
```

### 6. Prueba

1. Accede al frontend usando la URL del túnel: `https://frontend-abc123.trycloudflare.com`
2. Genera un link de vinculación
3. Compártelo con el cliente
4. El cliente debería poder usarlo desde cualquier lugar

## Alternativa: Usar ngrok para el Backend

Si prefieres ngrok:

```bash
# Terminal separada
ngrok http 8080
# Obtendrás: https://backend-abc123.ngrok-free.app
```

Luego en `.env.local`:
```bash
NEXT_PUBLIC_BACKEND_TUNNEL_URL=https://backend-abc123.ngrok-free.app
```

## Notas Importantes

⚠️ **Cada vez que reinicies los túneles, las URLs cambian**:
- Actualiza `.env.local` con la nueva URL del backend
- Actualiza la Redirect URI en MercadoLibre Developers
- Actualiza `application.properties`
- Reinicia el frontend

💡 **Tip**: Puedes usar el script `./scripts/start-tunnel.sh` para facilitar el proceso, pero necesitarás ejecutarlo dos veces (una para cada puerto).

## Verificación

Para verificar que todo funciona:
1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Network"
3. Intenta generar un link de vinculación
4. Deberías ver que las llamadas van a `https://backend-xyz789.trycloudflare.com/api/...` en lugar de `localhost:8080`
