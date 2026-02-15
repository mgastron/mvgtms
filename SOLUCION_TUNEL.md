# Solución para Compartir Links de Vinculación con Clientes

## Problema
El link de vinculación se generaba con `localhost:3000`, que no es accesible desde fuera de tu máquina. Necesitas compartir el link con clientes que deben loguearse en MercadoLibre.

## Solución Implementada

### Opción 1: Automática (Recomendada) ✅
El frontend ahora envía automáticamente su URL actual (`window.location.origin`) al backend cuando genera el link. Esto significa:

- Si estás en `localhost:3000` → el link será `localhost:3000/...`
- Si estás en `https://tu-tunel.trycloudflare.com` → el link será `https://tu-tunel.trycloudflare.com/...`

**No necesitas hacer nada adicional**, solo asegúrate de acceder a la aplicación a través del túnel Cloudflare.

### Opción 2: Variable de Entorno
Puedes configurar una variable de entorno en el backend:

```bash
export FRONTEND_BASE_URL="https://tu-tunel.trycloudflare.com"
```

### Opción 3: Parámetro en la URL
El endpoint también acepta un parámetro opcional:

```
GET /api/clientes/{id}/flex/link-vinculacion?baseUrl=https://tu-tunel.trycloudflare.com
```

## Pasos para Compartir el Link

1. **Inicia el túnel Cloudflare**:
   ```bash
   ./scripts/start-tunnel.sh cloudflare 3000
   # O manualmente:
   cloudflared tunnel --url http://localhost:3000
   ```

2. **Copia la URL HTTPS** que te da Cloudflare (ej: `https://abc123.trycloudflare.com`)

3. **Accede a la aplicación usando esa URL**:
   - Abre tu navegador
   - Ve a: `https://abc123.trycloudflare.com`
   - Inicia sesión normalmente

4. **Genera el link de vinculación**:
   - Ve a Clientes → Edita un cliente
   - Pestaña "CUENTAS" → Clic en "Link vinculación"
   - El link generado usará automáticamente la URL del túnel

5. **Comparte el link**:
   - El link ya está copiado al portapapeles
   - Compártelo por WhatsApp o el medio que prefieras
   - El cliente puede abrirlo desde cualquier dispositivo

## Importante

⚠️ **Si reinicias el túnel Cloudflare, la URL cambia**:
- Actualiza la Redirect URI en MercadoLibre Developers
- Actualiza `mercadolibre.redirect.uri` en `application.properties`
- Reinicia el backend
- Regenera el link de vinculación

## Alternativa: ngrok con URL Fija

Si necesitas una URL fija, puedes usar ngrok con cuenta (plan de pago) o considerar otras opciones como:
- Cloudflare Tunnel con dominio personalizado
- Servicios como localtunnel con subdominio fijo

