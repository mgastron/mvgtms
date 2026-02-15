# Actualizar Redirect URI de MercadoLibre

## ⚠️ IMPORTANTE: Actualizar Túnel en MercadoLibre Developers

Tu app de MercadoLibre tiene configurado el túnel **viejo**:
- ❌ Túnel viejo: `https://floating-off-savings-charging.trycloudflare.com`

Pero el túnel **actual** es:
- ✅ Túnel nuevo: `https://watching-songs-hydraulic-situations.trycloudflare.com`

## Pasos para Actualizar:

1. Ve a [MercadoLibre Developers](https://developers.mercadolibre.com.ar/)
2. Inicia sesión con tu cuenta
3. Ve a **"My Applications"** o **"Mis Aplicaciones"**
4. Selecciona tu app **"Zeta Llegue TMS"** (o el nombre que le diste)
5. Busca la sección **"Redirect URI"** o **"URI de Redirección"**
6. **Elimina** la URL vieja:
   ```
   https://floating-off-savings-charging.trycloudflare.com/auth/mercadolibre/callback
   ```
7. **Agrega** la URL nueva:
   ```
   https://watching-songs-hydraulic-situations.trycloudflare.com/auth/mercadolibre/callback
   ```
8. Haz clic en **"Guardar"** o **"Save"**

## Verificar:

- El backend ya está configurado con el túnel nuevo en `application.properties`
- Solo falta actualizar la app en MercadoLibre Developers
- Después de actualizar, la integración de Flex debería funcionar correctamente

