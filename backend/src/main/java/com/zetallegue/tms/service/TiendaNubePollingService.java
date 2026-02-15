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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio para procesar automáticamente pedidos de Tienda Nube que coinciden con el método de envío configurado
 * 
 * - Se ejecuta cada 5 minutos
 * - Obtiene todos los pedidos de Tienda Nube de todos los clientes vinculados
 * - Procesa automáticamente los pedidos cuyo método de envío coincide con la palabra de filtrado del cliente
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TiendaNubePollingService {

    private final TiendaNubeService tiendaNubeService;
    private final EnvioServiceTiendaNube envioServiceTiendaNube;
    private final ClienteRepository clienteRepository;
    private final EnvioRepository envioRepository;

    /**
     * Polling cada 5 minutos para procesar pedidos de Tienda Nube automáticamente
     */
    @Scheduled(cron = "0 0/5 * * * ?") // Cada 5 minutos en minutos 0, 5, 10, 15, etc.
    public void procesarPedidosTiendaNube() {
        log.info("=== INICIANDO PROCESAMIENTO AUTOMÁTICO DE PEDIDOS TIENDA NUBE ===");
        
        try {
            // Obtener todos los pedidos de Tienda Nube de todos los clientes
            List<JsonNode> todosLosPedidos = tiendaNubeService.obtenerTodosLosPedidosTiendaNube();
            
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
                    String metodoEnvioCliente = cliente.getTiendanubeMetodoEnvio();
                    if (metodoEnvioCliente == null || metodoEnvioCliente.trim().isEmpty()) {
                        noCoinciden++;
                        continue;
                    }
                    
                    // Obtener el método de envío del pedido
                    String metodoEnvioPedido = obtenerMetodoEnvioPedido(pedido);
                    
                    if (metodoEnvioPedido == null || metodoEnvioPedido.trim().isEmpty()) {
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
                    // Buscar envíos de Tienda Nube del mismo cliente con la misma fecha de venta y destinatario
                    String numeroPedido = pedido.has("number") ? pedido.get("number").asText() : 
                                        pedido.has("id") ? pedido.get("id").asText() : 
                                        "desconocido";
                    
                    // Obtener fecha de venta del pedido
                    LocalDateTime fechaVentaPedido = null;
                    if (pedido.has("created_at")) {
                        try {
                            String fechaStr = pedido.get("created_at").asText();
                            fechaVentaPedido = parsearFechaTiendaNube(fechaStr);
                        } catch (Exception e) {
                            // Silencioso - si no se puede parsear, se verificará sin fecha
                        }
                    }
                    
                    // Obtener destinatario del pedido
                    String destinatarioPedido = null;
                    if (pedido.has("shipping_address") && pedido.get("shipping_address").has("name")) {
                        destinatarioPedido = pedido.get("shipping_address").get("name").asText();
                    } else if (pedido.has("customer") && pedido.get("customer").has("name")) {
                        destinatarioPedido = pedido.get("customer").get("name").asText();
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
                    envioServiceTiendaNube.crearEnvioDesdeTiendaNube(pedido, clienteId);
                    procesados++;
                    
                } catch (Exception e) {
                    log.error("Error al procesar pedido de Tienda Nube: {}", e.getMessage(), e);
                    errores++;
                }
            }
            
            log.info("=== PROCESAMIENTO AUTOMÁTICO COMPLETADO ===");
            log.info("Procesados: {}, Ya existentes: {}, No coinciden: {}, Errores: {}", 
                procesados, yaExistentes, noCoinciden, errores);
            
        } catch (Exception e) {
            log.error("Error en el procesamiento automático de pedidos de Tienda Nube: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Obtiene el método de envío de un pedido de Tienda Nube
     */
    private String obtenerMetodoEnvioPedido(JsonNode pedido) {
        if (pedido.has("shipping_option")) {
            return pedido.get("shipping_option").asText();
        }
        if (pedido.has("shipping") && pedido.get("shipping").has("method_name")) {
            return pedido.get("shipping").get("method_name").asText();
        }
        return null;
    }
    
    /**
     * Verifica si ya existe un envío para un pedido de Tienda Nube
     * Busca envíos de Tienda Nube del mismo cliente con la misma fecha de venta y destinatario
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
        List<Envio> enviosExistentes = envioRepository.findEnviosTiendaNubeDuplicados(
            clienteStr,
            fechaDesde,
            fechaHasta,
            destinatario.trim()
        );
        
        return !enviosExistentes.isEmpty();
    }
    
    /**
     * Parsea una fecha de Tienda Nube (formato ISO-8601)
     * Maneja formatos como: "2026-02-04T20:39:09+0000" o "2026-02-04T20:39:09-03:00"
     */
    private LocalDateTime parsearFechaTiendaNube(String fechaStr) {
        try {
            if (fechaStr.contains("T")) {
                String fechaPart = fechaStr.split("T")[0];
                String horaPart = fechaStr.split("T")[1];
                // Remover timezone offset (puede ser +0000, -0300, +00:00, -03:00, etc.)
                horaPart = horaPart.split("\\+")[0].split("-")[0].split("\\.")[0];
                return LocalDateTime.parse(fechaPart + "T" + horaPart);
            } else {
                return LocalDate.parse(fechaStr).atStartOfDay();
            }
        } catch (Exception e) {
            // Silencioso - retornar null si no se puede parsear
            return null;
        }
    }
}

