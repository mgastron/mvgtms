# Configuración de Permisos en MercadoLibre

## Problema Actual

Los endpoints de MercadoLibre están devolviendo `403 UNAUTHORIZED` porque la aplicación no tiene los permisos necesarios activados en el panel de desarrolladores.

## Solución: Activar Permisos en el Panel de Desarrolladores

### Paso 1: Acceder al Panel de Desarrolladores

1. Ir a: https://developers.mercadolibre.com.ar/apps/{APP_ID}/edit
   - Reemplazar `{APP_ID}` con el Client ID: `5552011749820676`
   - O ir directamente a: https://developers.mercadolibre.com.ar/apps/5552011749820676/edit

### Paso 2: Activar Permisos Necesarios

En la sección **"Permisos"**, activar los siguientes:

#### 1. "Venta y envíos de un producto"
- **Estado actual**: "Sin acceso"
- **Estado requerido**: "Lectura y escritura"
- **Por qué**: Necesario para acceder a información de shipments y orders completos

#### 2. "Orders"
- **Estado actual**: No está activado (ver imagen 2)
- **Estado requerido**: 
  - ✅ "Orders_v2" debe estar seleccionado
  - ✅ "Orders Feedback" debe estar seleccionado
- **Por qué**: Necesario para acceder a información completa de órdenes, incluyendo direcciones de envío

### Paso 3: Re-autorizar la Aplicación

Después de activar los permisos:

1. **IMPORTANTE**: Los permisos solo se aplican a nuevas autorizaciones
2. El cliente debe re-autorizar la aplicación:
   - Ir a la pestaña "CUENTAS" del cliente en el TMS
   - Hacer clic en "Link vinculación"
   - Seguir el flujo de autorización nuevamente
   - Esto generará nuevos tokens con los permisos actualizados

### Paso 4: Verificar

Después de re-autorizar, los endpoints deberían funcionar:
- ✅ `/shipments/{shipment_id}` debería devolver 200 en lugar de 403
- ✅ `/orders/{order_id}` debería devolver 200 en lugar de 403
- ✅ La información de dirección debería estar disponible en las respuestas

## Scopes Solicitados en el Código

El código actual solicita estos scopes en la URL de autorización:
- `offline_access` - Para obtener refresh token
- `read` - Lectura básica
- `write` - Escritura
- `shipments` - Scope específico para shipments
- `fulfillment` - Si está marcado el checkbox de Fulfillment

**Nota**: Los scopes en la URL de autorización deben coincidir con los permisos activados en el panel.

## Logs de Debugging

El código ahora incluye logs que muestran:
- Los scopes solicitados en la URL de autorización
- Advertencias cuando se detectan respuestas parciales (sin dirección)
- Instrucciones sobre qué permisos activar

Buscar en los logs:
```
=== SCOPES SOLICITADOS EN URL DE AUTORIZACIÓN ===
⚠️  /orders/search devolvió datos parciales (solo shipping.id sin dirección)
⚠️  Esto indica que faltan permisos en el panel de desarrolladores
```

## Referencias

- Panel de Desarrolladores: https://developers.mercadolibre.com.ar/apps/5552011749820676/edit
- Documentación de Permisos: https://developers.mercadolibre.com.ar/es_ar/permisos-y-autorizaciones

