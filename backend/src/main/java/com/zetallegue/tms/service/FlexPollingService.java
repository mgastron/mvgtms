package com.zetallegue.tms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.model.HistorialEnvio;
import com.zetallegue.tms.repository.ClienteRepository;
import com.zetallegue.tms.repository.EnvioRepository;
import com.zetallegue.tms.repository.HistorialEnvioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Servicio para sincronizar estados de envíos Flex desde MercadoLibre mediante polling
 * 
 * - Polling cada 5 minutos durante el día (00:00-21:00)
 * - Polling cada 1 minuto durante el cierre (21:00-24:00)
 * - Los polls están sincronizados (todos a la vez, por ejemplo 12:05, 12:10, etc.)
 * - El polling se detiene cuando el envío está en: "Entregado", "Cancelado", o "Rechazado por el comprador"
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FlexPollingService {

    private final EnvioRepository envioRepository;
    private final ClienteRepository clienteRepository;
    private final HistorialEnvioRepository historialEnvioRepository;
    private final MercadoLibreService mercadoLibreService;

    /**
     * Polling sincronizado cada 5 minutos (00:00-21:00) o cada 1 minuto (21:00-24:00)
     * Se ejecuta en los minutos 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 de cada hora
     * Y también en los minutos 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, etc. entre 21:00-24:00
     * 
     * Usamos cron expressions para sincronizar todos los polls:
     * - Cada 5 minutos: "0 0/5 * * * ?" (minutos 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
     * - Cada 1 minuto entre 21-24: "0 * 21-23 * * ?" (cada minuto de 21:00 a 23:59)
     */
    @Scheduled(cron = "0 0/5 * * * ?") // Cada 5 minutos en minutos 0, 5, 10, 15, etc.
    public void sincronizarEstadosFlex5Minutos() {
        LocalTime ahora = LocalTime.now();
        // Solo ejecutar si NO estamos en horario de cierre (21:00-24:00)
        if (ahora.isBefore(LocalTime.of(21, 0))) {
            sincronizarEstadosFlex();
        }
    }

    @Scheduled(cron = "0 * 21-23 * * ?") // Cada 1 minuto entre 21:00 y 23:59
    public void sincronizarEstadosFlex1Minuto() {
        sincronizarEstadosFlex();
    }

    /**
     * Sincroniza los estados de todos los envíos Flex que no estén en estados finales
     */
    @Transactional
    public void sincronizarEstadosFlex() {
        try {
            log.info("=== Iniciando sincronización de estados Flex ===");
            
            // Obtener todos los envíos Flex que NO estén en estados finales (usando query optimizado)
            List<Envio> enviosFlex = envioRepository.findEnviosFlexParaPolling();
            
            if (enviosFlex.isEmpty()) {
                log.info("No hay envíos Flex para sincronizar");
                return;
            }
            
            log.info("Encontrados {} envíos Flex para sincronizar", enviosFlex.size());
            
            // Obtener todos los clientes vinculados con Flex una sola vez
            Map<String, Cliente> clientesPorCodigo = clienteRepository.findAll().stream()
                    .filter(c -> c.getFlexIdVendedor() != null && !c.getFlexIdVendedor().isEmpty())
                    .filter(c -> c.getFlexRefreshToken() != null && !c.getFlexRefreshToken().isEmpty())
                    .collect(Collectors.toMap(
                            Cliente::getCodigo,
                            c -> c,
                            (c1, c2) -> c1 // En caso de duplicados, tomar el primero
                    ));
            
            // Agrupar envíos por cliente para optimizar las llamadas a la API
            Map<Cliente, List<Envio>> enviosPorCliente = enviosFlex.stream()
                    .filter(e -> {
                        String clienteStr = e.getCliente();
                        if (clienteStr != null && clienteStr.contains(" - ")) {
                            String codigoCliente = clienteStr.split(" - ")[0].trim();
                            return clientesPorCodigo.containsKey(codigoCliente);
                        }
                        return false;
                    })
                    .collect(Collectors.groupingBy(e -> {
                        String clienteStr = e.getCliente();
                        String codigoCliente = clienteStr.split(" - ")[0].trim();
                        return clientesPorCodigo.get(codigoCliente);
                    }));
            
            int sincronizados = 0;
            int errores = 0;
            
            for (Map.Entry<Cliente, List<Envio>> entry : enviosPorCliente.entrySet()) {
                Cliente cliente = entry.getKey();
                List<Envio> enviosDelCliente = entry.getValue();
                
                log.info("Sincronizando {} envíos del cliente {} (seller: {})", 
                        enviosDelCliente.size(), cliente.getId(), cliente.getFlexIdVendedor());
                
                for (Envio envio : enviosDelCliente) {
                    try {
                        sincronizarEstadoEnvio(envio, cliente);
                        sincronizados++;
                    } catch (Exception e) {
                        log.error("Error al sincronizar envío {} (shipment: {}): {}", 
                                envio.getId(), envio.getMlShipmentId(), e.getMessage());
                        errores++;
                    }
                }
            }
            
            log.info("=== Sincronización completada: {} exitosos, {} errores ===", sincronizados, errores);
            
        } catch (Exception e) {
            log.error("Error general en sincronización de estados Flex: {}", e.getMessage(), e);
        }
    }

    /**
     * Sincroniza el estado de un envío individual desde MercadoLibre
     */
    private void sincronizarEstadoEnvio(Envio envio, Cliente cliente) throws Exception {
        String mlShipmentId = envio.getMlShipmentId();
        if (mlShipmentId == null || mlShipmentId.isEmpty()) {
            log.warn("Envío {} no tiene mlShipmentId, saltando...", envio.getId());
            return;
        }
        
        log.debug("Sincronizando estado del envío {} (shipment: {})", envio.getId(), mlShipmentId);
        
        // Obtener el estado actual desde MercadoLibre
        JsonNode shipmentData = mercadoLibreService.obtenerShipmentPorId(mlShipmentId, cliente);
        
        if (!shipmentData.has("status")) {
            log.warn("Shipment {} no tiene campo 'status', saltando...", mlShipmentId);
            return;
        }
        
        String mlStatus = shipmentData.get("status").asText();
        String nuevoEstado = mercadoLibreService.mapearEstadoML(mlStatus);
        
        // Solo actualizar si el estado cambió
        if (!nuevoEstado.equals(envio.getEstado())) {
            String estadoAnterior = envio.getEstado();
            envio.setEstado(nuevoEstado);
            envio.setFechaUltimoMovimiento(LocalDateTime.now());
            
            // Actualizar fechas específicas según el estado
            LocalDateTime ahora = LocalDateTime.now();
            switch (nuevoEstado) {
                case "Entregado":
                    if (envio.getFechaEntregado() == null) {
                        envio.setFechaEntregado(ahora);
                    }
                    break;
                case "Cancelado":
                    if (envio.getFechaCancelado() == null) {
                        envio.setFechaCancelado(ahora);
                    }
                    break;
                case "En camino al destinatario":
                    if (envio.getFechaAsignacion() == null) {
                        envio.setFechaAsignacion(ahora);
                    }
                    break;
            }
            
            envioRepository.save(envio);
            
            // Agregar entrada al historial
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(nuevoEstado);
            historial.setFecha(ahora);
            historial.setQuien("Sistema (Polling Flex)");
            historial.setObservaciones(String.format("Estado sincronizado desde MercadoLibre: %s -> %s", estadoAnterior, nuevoEstado));
            historial.setOrigen("POLLING");
            historialEnvioRepository.save(historial);
            
            log.info("Estado del envío {} actualizado: {} -> {} (shipment: {})", 
                    envio.getId(), estadoAnterior, nuevoEstado, mlShipmentId);
        } else {
            log.debug("Estado del envío {} sin cambios: {} (shipment: {})", 
                    envio.getId(), nuevoEstado, mlShipmentId);
        }
    }
}

