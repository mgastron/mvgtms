package com.zetallegue.tms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.repository.ClienteRepository;
import com.zetallegue.tms.repository.EnvioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio para procesar automáticamente pedidos de Shopify que coinciden con el método de envío configurado
 * 
 * - Se ejecuta cada 5 minutos
 * - Obtiene todos los pedidos de Shopify de todos los clientes vinculados
 * - Procesa automáticamente los pedidos cuyo método de envío coincide con la palabra de filtrado del cliente
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ShopifyPollingService {

    private final ShopifyService shopifyService;
    private final EnvioServiceShopify envioServiceShopify;
    private final ClienteRepository clienteRepository;
    private final EnvioRepository envioRepository;

    /**
     * Polling cada 5 minutos para procesar pedidos de Shopify automáticamente
     */
    @Scheduled(cron = "0 0/5 * * * ?") // Cada 5 minutos en minutos 0, 5, 10, 15, etc.
    public void procesarPedidosShopify() {
        log.info("=== INICIANDO PROCESAMIENTO AUTOMÁTICO DE PEDIDOS SHOPIFY ===");
        
        try {
            // Obtener todos los pedidos de Shopify de todos los clientes
            List<JsonNode> todosLosPedidos = shopifyService.obtenerTodosLosPedidosShopify();
            
            int procesados = 0;
            int yaExistentes = 0;
            int noCoinciden = 0;
            int errores = 0;
            
            for (JsonNode pedidoConCliente : todosLosPedidos) {
                try {
                    JsonNode pedido = pedidoConCliente.get("pedido");
                    Long clienteId = pedidoConCliente.get("clienteId").asLong();
                    
                    // Obtener el cliente para verificar la configuración
                    Cliente cliente = clienteRepository.findById(clienteId)
                        .orElse(null);
                    
                    if (cliente == null) {
                        log.warn("Cliente {} no encontrado, saltando pedido", clienteId);
                        errores++;
                        continue;
                    }
                    
                    // Usar el método de envío del cliente si está disponible
                    String metodoEnvioCliente = cliente.getShopifyMetodoEnvio();
                    
                    // Obtener el método de envío del pedido
                    String metodoEnvioPedido = obtenerMetodoEnvioPedido(pedido);
                    
                    if (metodoEnvioPedido == null || metodoEnvioPedido.trim().isEmpty()) {
                        noCoinciden++;
                        continue;
                    }
                    
                    // Si no hay método configurado en el cliente, no procesar automáticamente
                    if (metodoEnvioCliente == null || metodoEnvioCliente.trim().isEmpty()) {
                        noCoinciden++;
                        continue;
                    }
                    
                    // Verificar si el método del pedido coincide con el del cliente
                    boolean coincide = metodoEnvioPedido.toLowerCase().startsWith(metodoEnvioCliente.toLowerCase().trim());
                    
                    if (!coincide) {
                        noCoinciden++;
                        continue;
                    }
                    
                    // Verificar si ya existe un envío para este pedido ANTES de procesarlo
                    String numeroPedido = pedido.has("order_number") ? pedido.get("order_number").asText() :
                                        pedido.has("id") ? pedido.get("id").asText() :
                                        "desconocido";
                    
                    // Obtener fecha de venta del pedido
                    LocalDateTime fechaVentaPedido = null;
                    if (pedido.has("created_at")) {
                        try {
                            String fechaStr = pedido.get("created_at").asText();
                            fechaVentaPedido = parsearFechaShopify(fechaStr);
                        } catch (Exception e) {
                            // Silencioso - si no se puede parsear, se verificará sin fecha
                        }
                    }
                    
                    // Obtener destinatario del pedido
                    String destinatarioPedido = null;
                    if (pedido.has("shipping_address") && pedido.get("shipping_address").has("name")) {
                        destinatarioPedido = pedido.get("shipping_address").get("name").asText();
                    } else if (pedido.has("customer") && pedido.get("customer").has("first_name")) {
                        destinatarioPedido = pedido.get("customer").get("first_name").asText();
                        if (pedido.get("customer").has("last_name")) {
                            destinatarioPedido += " " + pedido.get("customer").get("last_name").asText();
                        }
                    }
                    
                    // Construir string del cliente para buscar
                    String clienteStr = cliente.getCodigo() + " - " + (cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : cliente.getRazonSocial());
                    
                    // Verificar si ya existe un envío para este pedido
                    boolean yaExiste = verificarEnvioExistente(clienteStr, fechaVentaPedido, destinatarioPedido);
                    
                    if (yaExiste) {
                        yaExistentes++;
                        continue;
                    }
                    
                    log.info("Procesando pedido {} del cliente {} - Método: '{}'", numeroPedido, clienteId, metodoEnvioPedido);
                    
                    // Crear el envío (solo si no existe)
                    envioServiceShopify.crearEnvioDesdeShopify(pedido, clienteId);
                    procesados++;
                    
                } catch (Exception e) {
                    log.error("Error al procesar pedido de Shopify: {}", e.getMessage(), e);
                    errores++;
                }
            }
            
            log.info("=== PROCESAMIENTO AUTOMÁTICO COMPLETADO ===");
            log.info("Procesados: {}, Ya existentes: {}, No coinciden: {}, Errores: {}", 
                procesados, yaExistentes, noCoinciden, errores);
            
        } catch (Exception e) {
            log.error("Error en el procesamiento automático de pedidos de Shopify: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Obtiene el método de envío de un pedido de Shopify
     */
    private String obtenerMetodoEnvioPedido(JsonNode pedido) {
        if (pedido.has("shipping_lines") && pedido.get("shipping_lines").isArray() && pedido.get("shipping_lines").size() > 0) {
            JsonNode firstShippingLine = pedido.get("shipping_lines").get(0);
            if (firstShippingLine.has("title")) {
                return firstShippingLine.get("title").asText();
            }
        }
        return null;
    }
    
    /**
     * Verifica si ya existe un envío para un pedido de Shopify
     * Busca envíos de Shopify del mismo cliente con la misma fecha de venta y destinatario
     */
    private boolean verificarEnvioExistente(String clienteStr, LocalDateTime fechaVenta, String destinatario) {
        if (fechaVenta == null || destinatario == null || destinatario.trim().isEmpty()) {
            // Si no tenemos datos suficientes, no podemos verificar de forma confiable
            return false;
        }
        
        // Buscar en un rango de fechas cercano (2 minutos antes y después) para tolerar diferencias de redondeo
        LocalDateTime fechaDesde = fechaVenta.minusMinutes(2);
        LocalDateTime fechaHasta = fechaVenta.plusMinutes(2);
        
        // Usar query específica del repositorio para eficiencia
        List<Envio> enviosExistentes = envioRepository.findEnviosShopifyDuplicados(
            clienteStr,
            fechaDesde,
            fechaHasta,
            destinatario.trim()
        );
        
        return !enviosExistentes.isEmpty();
    }
    
    /**
     * Parsea una fecha de Shopify (formato ISO-8601)
     * Maneja formatos como: "2026-02-04T20:39:09+0000" o "2026-02-04T20:39:09-03:00" o "2026-02-04T20:39:09+01:00"
     */
    private LocalDateTime parsearFechaShopify(String fechaStr) {
        try {
            // Shopify usa formato ISO-8601: "2024-01-15T10:30:00-03:00" o "2024-01-15T10:30:00Z" o "2024-01-15T10:30:00+01:00"
            // Usar ZonedDateTime para manejar correctamente el timezone y luego convertir a LocalDateTime
            java.time.ZonedDateTime zonedDateTime;
            
            if (fechaStr.endsWith("Z")) {
                // Formato UTC
                zonedDateTime = java.time.ZonedDateTime.parse(fechaStr, java.time.format.DateTimeFormatter.ISO_INSTANT);
            } else {
                // Formato con timezone offset
                zonedDateTime = java.time.ZonedDateTime.parse(fechaStr, java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            
            // Convertir a LocalDateTime (sin timezone, solo fecha y hora)
            return zonedDateTime.toLocalDateTime();
        } catch (Exception e) {
            log.warn("Error al parsear fecha de Shopify: '{}' - Error: {}", fechaStr, e.getMessage());
            // Retornar null si no se puede parsear (no usar LocalDateTime.now() como fallback)
            return null;
        }
    }
}

