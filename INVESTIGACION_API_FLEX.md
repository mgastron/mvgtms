# Investigación: API de MercadoLibre Flex

## Problema Actual
El endpoint `/shipments/search` devuelve 404 "resource not found". Necesitamos encontrar el endpoint correcto según la documentación oficial.

## Documentación a Revisar

### 1. Portal de Desarrolladores de MercadoLibre
- **Argentina**: https://developers.mercadolibre.com.ar/es_ar/api-docs-es
- **General**: https://developers.mercadolibre.com.ar/es_ar/

### 2. Secciones Relevantes
- **Gestión de Ventas**: https://developers.mercadolibre.cl/es_ar/gestiona-ventas
- **API de Envíos**: Buscar documentación específica de "Mercado Envíos" o "Flex"
- **Fulfillment**: Si Flex está relacionado con fulfillment

### 3. Endpoints Posibles a Investigar

#### Opción A: Orders API
- `/orders/search` - Buscar órdenes del vendedor
- Los shipments Flex pueden venir dentro de las órdenes
- Filtro: `order.status=paid` o similar

#### Opción B: Shipments API Directa
- `/shipments` - Listar shipments directamente
- Posible filtro: `seller_id`, `logistic_type=flex`
- Puede requerir parámetros específicos

#### Opción C: Fulfillment API
- Si Flex usa fulfillment, puede haber endpoints específicos
- `/fulfillment/...` o similar

#### Opción D: Flex API Específica
- Puede haber una API separada para Flex
- Endpoints específicos como `/flex/shipments` o similar

## Próximos Pasos

1. **Revisar documentación oficial** en developers.mercadolibre.com.ar
2. **Buscar sección específica de Flex** o "Mercado Envíos Flex"
3. **Identificar el endpoint correcto** con ejemplos de request/response
4. **Verificar scopes necesarios** - puede que necesitemos permisos adicionales
5. **Implementar según documentación oficial**

## Notas Importantes

- Los webhooks están configurados y funcionando (el 404 es solo del endpoint de consulta)
- El cliente tiene token válido hasta 2026-01-27
- Los scopes actuales incluyen: `offline_access`, `read`, `write`, `fulfillment`
- Puede ser necesario agregar scopes adicionales para acceder a shipments Flex

