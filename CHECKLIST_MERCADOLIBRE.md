# Checklist de Configuración - MercadoLibre Developers

Usa este checklist para verificar que todo esté configurado correctamente antes de guardar.

## ✅ Redirect URIs
- [ ] URL configurada: `https://tu-tunel-url.com/auth/mercadolibre/callback`
- [ ] Tiene check verde ✓ (validada)
- [ ] Es HTTPS (no HTTP)

## ✅ Flujos OAuth
- [x] **Authorization Code** - Tildado ✓
- [ ] **Refresh Token** - **TILDAR** (necesario)
- [ ] **Client Credentials** - Opcional (puede quedar sin tildar)
- [ ] **pkce** - Sin tildar (no necesario)

## ✅ Negocios
- [ ] **Mercado Libre** - **TILDAR** (obligatorio para Flex)
- [ ] **VIS** - Sin tildar (solo si no trabajas con VIS)

## ✅ Permisos
- [x] **Usuarios** - "Lectura y escritura" ✓
- [ ] Los demás permisos en "Sin acceso" (correcto)

## ✅ Tópicos (Topics) - CRÍTICO PARA FLEX

### En la sección "Shipments":
- [ ] **Shipments** - **TILDAR**
- [ ] **Flex-Handshakes** - **TILDAR** (MUY IMPORTANTE)
- [ ] **Fbm Stock Operations** - Opcional (solo si necesitas stock FBM)

### NO tildar en:
- [ ] Orders (dejar sin tildar)
- [ ] Messages (dejar sin tildar)
- [ ] Prices (dejar sin tildar)
- [ ] Items (dejar sin tildar)
- [ ] Catalog (dejar sin tildar)
- [ ] Promotions (dejar sin tildar)
- [ ] VIS Leads (dejar sin tildar)
- [ ] Post Purchase (dejar sin tildar)
- [ ] Others (dejar sin tildar)

## ✅ Configuración de Notificaciones
- [ ] Campo "Notificaciones callbacks URL" - **DEBES COMPLETARLO**
- [ ] Usar la misma URL HTTPS del túnel: `https://tu-tunel-url.com/api/webhooks/mercadolibre`
- [ ] Debe empezar con `https://` (no `http://`)
- [ ] Ejemplo con Cloudflare: `https://shake-blake-calgary-generates.trycloudflare.com/api/webhooks/mercadolibre`

## 📝 Resumen de Cambios Necesarios

Basándome en tus imágenes, necesitas hacer estos cambios:

1. **Flujos OAuth**: Tildar "Refresh Token"
2. **Negocios**: Tildar "Mercado Libre"
3. **Tópicos > Shipments**: 
   - Tildar "Shipments"
   - Tildar "Flex-Handshakes" ⚠️ **MUY IMPORTANTE**

Una vez que hagas estos cambios, puedes guardar la configuración.

