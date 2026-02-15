# Checklist de Configuración de Tienda Nube

## ✅ Completado

- [x] Aplicación creada en Portal de Socios
- [x] App ID obtenido: **25636**
- [x] Client Secret obtenido: **31e3abf3306b455b010bac52000c2fcad9416ea7501ed5c3**
- [x] Link de instalación: `/admin/apps/25636/authorize`
- [x] Datos básicos completados
- [x] **Webhooks configurados** en sección "Privacidad":
  - Store redact: `https://retail-touring-hung-fall.trycloudflare.com/api/webhooks/tiendanube/store-redact`
  - Customers redact: `https://retail-touring-hung-fall.trycloudflare.com/api/webhooks/tiendanube/customers-redact`
  - Customers data request: `https://retail-touring-hung-fall.trycloudflare.com/api/webhooks/tiendanube/customers-data-request`
- [x] **URLs configuradas** en sección "URLs":
  - Página de la aplicación: `https://floating-off-savings-charging.trycloudflare.com/auth/tiendanube/callback`
  - URL para redirigir después de la instalación: `https://partners.tiendanube.com/applications/authentication/25636`
- [x] **Credenciales configuradas** en `application.properties`

## ✅ Todo Listo

¡La configuración está completa! Solo falta:

### Reiniciar el Backend

Después de configurar las credenciales, reinicia el backend para que tome los cambios.

## 📝 Notas Importantes

- El **Link de instalación** (`/admin/apps/25636/authorize`) es relativo. Para usarlo, necesitas la URL completa de la tienda del cliente:
  ```
  https://tienda-del-cliente.mitiendanube.com/admin/apps/25636/authorize
  ```

- Los webhooks son **obligatorios** según la documentación de Tienda Nube.

- Las URLs deben usar **HTTPS** (no HTTP).

- Si reinicias los túneles, las URLs cambiarán y tendrás que actualizarlas en el Portal de Socios.

