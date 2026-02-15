# Guía de Sincronización de Envíos Flex

## Resumen

Se ha implementado la funcionalidad para consumir y sincronizar envíos de MercadoLibre Flex desde un cliente real vinculado.

## Funcionalidades Implementadas

### 1. Servicio de MercadoLibre (`MercadoLibreService`)
- ✅ Refresco automático de tokens cuando expiran
- ✅ Obtención de envíos Flex desde la API de MercadoLibre
- ✅ Mapeo de datos de ML a nuestro modelo `Envio`
- ✅ Manejo de diferentes estructuras de respuesta de la API

### 2. Endpoint de Sincronización
- ✅ `POST /api/mercadolibre/sincronizar/{clienteId}` - Sincroniza envíos de un cliente
- ✅ `GET /api/mercadolibre/envios/{clienteId}` - Obtiene información de envíos (sin guardar)

### 3. Interfaz de Usuario
- ✅ Botón "Sincronizar envíos" en el modal de clientes (pestaña CUENTAS > FLEX)
- ✅ Indicador de carga durante la sincronización
- ✅ Mensaje de confirmación con resultados

## Cómo Usar

### Paso 1: Verificar que el Cliente Esté Vinculado
1. Ve a **Clientes** → Edita el cliente
2. Pestaña **CUENTAS** → Sección **FLEX**
3. Debe mostrar "Vinculado ✓" con ID VENDEDOR y USERNAME completos

### Paso 2: Sincronizar Envíos
1. Con el cliente vinculado, haz clic en **"Sincronizar envíos"**
2. Confirma la acción
3. Espera a que se complete la sincronización
4. Verás un mensaje con:
   - Cantidad de nuevos envíos
   - Cantidad de envíos actualizados
   - Cantidad de errores (si los hay)

### Paso 3: Ver los Envíos
Los envíos sincronizados aparecerán en:
- **Envios** → `/envios` (página principal de envíos)
- **Reimprimir NoFlex** → `/reimprimir-noflex`

Los envíos Flex se identifican por:
- **Origen**: "Flex"
- **Tracking**: ID del envío en MercadoLibre
- **QR Data**: Prefijo "FLEX_" + ID del envío

## Mapeo de Estados

Los estados de MercadoLibre se mapean a nuestros estados:

| Estado ML | Estado TMS |
|-----------|------------|
| `ready_to_ship`, `pending` | "A retirar" |
| `shipped`, `in_transit` | "En camino al destinatario" |
| `delivered` | "Entregado" |
| `cancelled` | "Cancelado" |
| `rejected` | "Rechazado por el comprador" |

## Datos Mapeados

De cada envío de MercadoLibre se extrae:
- ✅ Tracking (ID del envío)
- ✅ Cliente (código - nombre)
- ✅ Origen ("Flex")
- ✅ Estado (mapeado)
- ✅ Fecha de creación
- ✅ Dirección completa
- ✅ Localidad
- ✅ Código postal
- ✅ Nombre del destinatario
- ✅ Teléfono
- ✅ Observaciones
- ✅ QR Data

## Prevención de Duplicados

El sistema verifica si un envío ya existe por su `tracking`:
- Si existe y NO está eliminado → Se actualiza
- Si existe pero está eliminado → Se crea uno nuevo
- Si no existe → Se crea uno nuevo

## Notas Importantes

⚠️ **Límite de la API**: MercadoLibre tiene un límite de 1000 requests por minuto. El sistema respeta este límite.

⚠️ **Tokens**: Los tokens se refrescan automáticamente cuando están próximos a expirar (5 minutos antes).

⚠️ **Solo Lectura**: Esta implementación **NO modifica nada en la cuenta del cliente** en MercadoLibre. Solo consume datos.

⚠️ **Endpoint de ML**: Si el endpoint `/shipments/search` no funciona, puede ser necesario ajustarlo según la documentación actualizada de MercadoLibre.

## Troubleshooting

### Error: "El cliente no tiene token de acceso"
- Verifica que el cliente esté vinculado correctamente
- Regenera el link de vinculación si es necesario

### Error: "Error al refrescar token"
- Verifica que las credenciales en `application.properties` sean correctas
- Verifica que el refresh token no haya expirado (puede requerir re-vinculación)

### No aparecen envíos
- Verifica que el cliente tenga envíos Flex en MercadoLibre
- Revisa los logs del backend para ver errores específicos
- Prueba el endpoint `GET /api/mercadolibre/envios/{clienteId}` para ver qué devuelve la API

### Los envíos no aparecen en las páginas
- Verifica que el filtro de "Origen" no esté excluyendo "Flex"
- Verifica que los envíos no estén marcados como eliminados
- Revisa la consola del navegador para errores

## Próximos Pasos (Opcional)

- [ ] Implementar sincronización automática periódica (scheduler)
- [ ] Implementar webhooks para recibir notificaciones en tiempo real
- [ ] Sincronización bidireccional de estados
- [ ] Historial de sincronizaciones

