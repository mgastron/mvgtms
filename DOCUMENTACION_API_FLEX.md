# Documentación API MercadoLibre Flex - Investigación Necesaria

## Problema Actual
El endpoint `/shipments/search` devuelve 404. Necesitamos encontrar el endpoint correcto según la documentación oficial.

## Recursos a Consultar en developers.mercadolibre.com.ar

### 1. API de Orders
- **Endpoint**: `/orders/search`
- **Documentación**: https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas
- **Posibilidad**: Los shipments Flex pueden venir dentro de las órdenes
- **Filtros posibles**: `seller`, `order.status`, `logistic_type`

### 2. API de Shipments
- **Endpoint base**: `/shipments`
- **Posibles variantes**:
  - `/shipments/{id}` - Obtener un shipment específico
  - `/shipments` con query params - Listar shipments
  - Puede requerir parámetros específicos para Flex

### 3. API de Fulfillment
- Si Flex está relacionado con fulfillment, puede haber endpoints específicos
- Buscar documentación de "Fulfillment by MercadoLibre" o "Flex Fulfillment"

### 4. Flex API Específica
- Puede haber una sección dedicada a Flex
- Endpoints como `/flex/...` o similares

## Información que Necesitamos Obtener

1. **Endpoint correcto** para obtener shipments Flex de un vendedor
2. **Parámetros requeridos** (seller_id, filters, etc.)
3. **Estructura de la respuesta** (cómo vienen los datos)
4. **Scopes necesarios** (puede que necesitemos permisos adicionales)
5. **Autenticación** (si requiere algo especial para Flex)

## Próximos Pasos

1. Revisar la documentación oficial en developers.mercadolibre.com.ar
2. Buscar específicamente "Flex" o "Mercado Envíos Flex"
3. Identificar el endpoint correcto con ejemplos
4. Implementar según la documentación oficial

## Nota Importante

Los webhooks están funcionando (el 404 es solo del endpoint de consulta manual). Una vez que identifiquemos el endpoint correcto, podremos:
- Sincronizar envíos manualmente
- Los webhooks seguirán funcionando para recibir notificaciones automáticas

