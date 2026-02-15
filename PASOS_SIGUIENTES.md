# Próximos Pasos - Integración MercadoLibre Flex

## ✅ Lo que ya está configurado:
- ✅ Client ID: `5552011749820676`
- ✅ Client Secret: Configurado en `application.properties`
- ✅ Redirect URI: `https://shake-blake-calgary-generates.trycloudflare.com/auth/mercadolibre/callback`
- ✅ URL de Notificaciones: `https://shake-blake-calgary-generates.trycloudflare.com/api/webhooks/mercadolibre`

## 🔒 Seguridad - IMPORTANTE

⚠️ **NO commitees el Client Secret al repositorio**

El archivo `application.properties` contiene credenciales sensibles. Asegúrate de que esté en `.gitignore` o usa variables de entorno en producción.

## 📋 Pasos para Probar la Integración

### Paso 1: Verificar que el túnel Cloudflare esté corriendo

```bash
# En una terminal separada, asegúrate de que el túnel esté activo
cloudflared tunnel --url http://localhost:3000
```

O usa el script:
```bash
./scripts/start-tunnel.sh cloudflare 3000
```

**IMPORTANTE**: La URL del túnel puede cambiar cada vez que lo reinicias. Si cambia, actualiza:
1. La Redirect URI en MercadoLibre Developers
2. La URL de Notificaciones en MercadoLibre Developers
3. El valor en `application.properties`

### Paso 2: Iniciar el Backend

```bash
cd backend
./mvnw spring-boot:run
# O si usas Maven instalado:
mvn spring-boot:run
```

Verifica que no haya errores al iniciar.

### Paso 3: Iniciar el Frontend

```bash
# En otra terminal
npm run dev
```

Asegúrate de que esté corriendo en `http://localhost:3000`

### Paso 4: Probar la Vinculación

1. Abre la aplicación web: `http://localhost:3000`
2. Ve a **Clientes** → Selecciona o crea un cliente
3. Haz clic en **Editar** (o crea uno nuevo)
4. Ve a la pestaña **"CUENTAS"**
5. En la sección **FLEX**, haz clic en **"Link vinculación"**
6. Se copiará un link al portapapeles
7. Abre ese link en el navegador
8. Verás la página de autorización
9. Marca o desmarca **"FulFillment (WMS)"** según necesites
10. Haz clic en **"CONTINUAR A MERCADOLIBRE"**
11. Inicia sesión en MercadoLibre
12. Autoriza la aplicación
13. Serás redirigido de vuelta y deberías ver un mensaje de éxito

### Paso 5: Verificar la Vinculación

1. Vuelve al modal del cliente
2. En la sección FLEX deberías ver:
   - Estado: **"Vinculado ✓"** (verde)
   - **ID VENDEDOR** completado
   - **USERNAME** completado

## 🐛 Solución de Problemas

### Error: "redirect_uri_mismatch"
- Verifica que la URL en MercadoLibre Developers coincida exactamente con la del túnel
- Asegúrate de que el túnel esté corriendo

### Error: "invalid_client"
- Verifica que el Client ID y Secret sean correctos
- Reinicia el backend después de cambiar las credenciales

### Error: "MERCADOLIBRE_CLIENT_SECRET no configurado"
- Verifica que `application.properties` tenga el secret configurado
- O configura la variable de entorno `MERCADOLIBRE_CLIENT_SECRET`

### El túnel cambió de URL
- Actualiza la Redirect URI en MercadoLibre Developers
- Actualiza `mercadolibre.redirect.uri` en `application.properties`
- Reinicia el backend

## 🚀 Próximos Pasos Después de la Vinculación

Una vez que la vinculación funcione:

1. **Implementar recepción de pedidos**:
   - Crear endpoint `/api/webhooks/mercadolibre` para recibir notificaciones
   - Procesar los pedidos de Flex automáticamente
   - Crear envíos en la base de datos

2. **Sincronización de estados**:
   - Actualizar estados de envíos desde MercadoLibre
   - Enviar actualizaciones a MercadoLibre cuando cambien estados

3. **Mejorar seguridad**:
   - Mover credenciales a variables de entorno
   - Implementar validación de webhooks
   - Agregar logs y monitoreo

