package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.EnvioDTO;
import com.zetallegue.tms.service.EnvioService;
import com.zetallegue.tms.service.MercadoLibreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mercadolibre")
@RequiredArgsConstructor
@Slf4j
public class MercadoLibreController {

    private final MercadoLibreService mercadoLibreService;
    private final EnvioService envioService;

    /**
     * Sincroniza los envíos Flex de un cliente desde MercadoLibre
     * POST /api/mercadolibre/sincronizar/{clienteId}
     */
    @PostMapping("/sincronizar/{clienteId}")
    public ResponseEntity<Map<String, Object>> sincronizarEnvios(@PathVariable Long clienteId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            log.info("Iniciando sincronización de envíos Flex para cliente {}", clienteId);
            
            // Obtener envíos de MercadoLibre
            List<com.fasterxml.jackson.databind.JsonNode> enviosML = mercadoLibreService.obtenerEnviosFlex(clienteId);
            
            log.info("Se obtuvieron {} envíos de MercadoLibre", enviosML.size());
            
            // Obtener el cliente para mapear
            com.zetallegue.tms.model.Cliente cliente = mercadoLibreService.getClienteRepository()
                .findById(clienteId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
            
            // Mapear y guardar envíos
            int nuevos = 0;
            int actualizados = 0;
            int errores = 0;
            
            for (com.fasterxml.jackson.databind.JsonNode envioML : enviosML) {
                try {
                    EnvioDTO envioDTO = mercadoLibreService.mapearEnvioFlex(envioML, cliente);
                    
                    // Verificar si el envío ya existe (por tracking)
                    java.util.Optional<com.zetallegue.tms.model.Envio> envioExistenteOpt = 
                        envioService.findByTracking(envioDTO.getTracking());
                    
                    if (envioExistenteOpt.isPresent()) {
                        // Actualizar envío existente
                        com.zetallegue.tms.model.Envio envioExistente = envioExistenteOpt.get();
                        if (!envioExistente.getEliminado()) {
                            envioService.actualizarEnvio(envioExistente.getId(), envioDTO);
                            actualizados++;
                            log.debug("Envío actualizado: {}", envioDTO.getTracking());
                        } else {
                            // Si estaba eliminado, crear uno nuevo
                            envioService.crearEnvio(envioDTO);
                            nuevos++;
                            log.debug("Nuevo envío creado (anterior eliminado): {}", envioDTO.getTracking());
                        }
                    } else {
                        // Crear nuevo envío
                        envioService.crearEnvio(envioDTO);
                        nuevos++;
                        log.debug("Nuevo envío creado: {}", envioDTO.getTracking());
                    }
                } catch (Exception e) {
                    errores++;
                    log.error("Error al procesar envío: {}", e.getMessage(), e);
                }
            }
            
            response.put("success", true);
            response.put("total", enviosML.size());
            response.put("nuevos", nuevos);
            response.put("actualizados", actualizados);
            response.put("errores", errores);
            response.put("message", String.format(
                "Sincronización completada: %d nuevos, %d actualizados, %d errores",
                nuevos, actualizados, errores
            ));
            
            log.info("Sincronización completada para cliente {}: {} nuevos, {} actualizados, {} errores",
                clienteId, nuevos, actualizados, errores);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error al sincronizar envíos Flex para cliente {}: {}", clienteId, e.getMessage(), e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Obtiene información sobre los envíos Flex de un cliente (sin guardarlos)
     * GET /api/mercadolibre/envios/{clienteId}
     */
    @GetMapping("/envios/{clienteId}")
    public ResponseEntity<Map<String, Object>> obtenerEnvios(@PathVariable Long clienteId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<com.fasterxml.jackson.databind.JsonNode> enviosML = mercadoLibreService.obtenerEnviosFlex(clienteId);
            
            response.put("success", true);
            response.put("total", enviosML.size());
            response.put("envios", enviosML);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error al obtener envíos Flex para cliente {}: {}", clienteId, e.getMessage(), e);
            response.put("success", false);
            response.put("error", e.getMessage());
            response.put("stackTrace", e.getStackTrace());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Endpoint de prueba para verificar la sincronización manual
     * GET /api/mercadolibre/test/{clienteId}
     */
    @GetMapping("/test/{clienteId}")
    public ResponseEntity<Map<String, Object>> testSincronizacion(@PathVariable Long clienteId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            log.info("=== TEST DE SINCRONIZACIÓN PARA CLIENTE {} ===", clienteId);
            
            // Obtener información del cliente
            com.zetallegue.tms.model.Cliente cliente = mercadoLibreService.getClienteRepository()
                .findById(clienteId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
            
            response.put("cliente", Map.of(
                "id", cliente.getId(),
                "nombre", cliente.getNombreFantasia(),
                "flexIdVendedor", cliente.getFlexIdVendedor() != null ? cliente.getFlexIdVendedor() : "NO CONFIGURADO",
                "flexUsername", cliente.getFlexUsername() != null ? cliente.getFlexUsername() : "NO CONFIGURADO",
                "tieneToken", cliente.getFlexAccessToken() != null && !cliente.getFlexAccessToken().isEmpty()
            ));
            
            // Intentar obtener envíos
            try {
                List<com.fasterxml.jackson.databind.JsonNode> enviosML = mercadoLibreService.obtenerEnviosFlex(clienteId);
                response.put("enviosObtenidos", enviosML.size());
                response.put("envios", enviosML);
                response.put("mensaje", "Envíos obtenidos correctamente");
            } catch (Exception e) {
                response.put("errorObteniendoEnvios", e.getMessage());
                response.put("stackTrace", java.util.Arrays.toString(e.getStackTrace()));
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error en test de sincronización para cliente {}: {}", clienteId, e.getMessage(), e);
            response.put("success", false);
            response.put("error", e.getMessage());
            response.put("stackTrace", java.util.Arrays.toString(e.getStackTrace()));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Endpoint de prueba buscando por flexIdVendedor (más fácil para pruebas)
     * GET /api/mercadolibre/test-flex/{flexIdVendedor}
     */
    @GetMapping("/test-flex/{flexIdVendedor}")
    public ResponseEntity<Map<String, Object>> testSincronizacionPorFlexId(@PathVariable String flexIdVendedor) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            log.info("=== TEST DE SINCRONIZACIÓN POR FLEX ID: {} ===", flexIdVendedor);
            
            // Buscar cliente por flexIdVendedor
            com.zetallegue.tms.model.Cliente cliente = mercadoLibreService.getClienteRepository()
                .findByFlexIdVendedor(flexIdVendedor)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con flexIdVendedor: " + flexIdVendedor));
            
            response.put("cliente", Map.of(
                "id", cliente.getId(),
                "codigo", cliente.getCodigo(),
                "nombre", cliente.getNombreFantasia(),
                "flexIdVendedor", cliente.getFlexIdVendedor() != null ? cliente.getFlexIdVendedor() : "NO CONFIGURADO",
                "flexUsername", cliente.getFlexUsername() != null ? cliente.getFlexUsername() : "NO CONFIGURADO",
                "tieneToken", cliente.getFlexAccessToken() != null && !cliente.getFlexAccessToken().isEmpty(),
                "tokenExpira", cliente.getFlexTokenExpiresAt() != null ? cliente.getFlexTokenExpiresAt().toString() : "NO CONFIGURADO"
            ));
            
            // Intentar obtener envíos
            try {
                log.info("Intentando obtener envíos para cliente ID: {}", cliente.getId());
                List<com.fasterxml.jackson.databind.JsonNode> enviosML = mercadoLibreService.obtenerEnviosFlex(cliente.getId());
                response.put("enviosObtenidos", enviosML.size());
                response.put("envios", enviosML);
                response.put("mensaje", "Envíos obtenidos correctamente");
                
                // Mostrar detalles del primer envío si existe
                if (!enviosML.isEmpty()) {
                    response.put("primerEnvio", enviosML.get(0).toString());
                }
            } catch (Exception e) {
                log.error("Error al obtener envíos: {}", e.getMessage(), e);
                response.put("errorObteniendoEnvios", e.getMessage());
                response.put("errorClass", e.getClass().getName());
                StringBuilder stackTrace = new StringBuilder();
                for (StackTraceElement element : e.getStackTrace()) {
                    stackTrace.append(element.toString()).append("\n");
                }
                response.put("stackTrace", stackTrace.toString());
            }
            
            response.put("success", true);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error en test de sincronización por flexId {}: {}", flexIdVendedor, e.getMessage(), e);
            response.put("success", false);
            response.put("error", e.getMessage());
            response.put("errorClass", e.getClass().getName());
            StringBuilder stackTrace = new StringBuilder();
            for (StackTraceElement element : e.getStackTrace()) {
                stackTrace.append(element.toString()).append("\n");
            }
            response.put("stackTrace", stackTrace.toString());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Lista todos los clientes vinculados con Flex
     * GET /api/mercadolibre/clientes-vinculados
     */
    @GetMapping("/clientes-vinculados")
    public ResponseEntity<Map<String, Object>> listarClientesVinculados() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<com.zetallegue.tms.model.Cliente> clientes = mercadoLibreService.getClienteRepository().findAll();
            
            List<Map<String, Object>> clientesVinculados = new java.util.ArrayList<>();
            for (com.zetallegue.tms.model.Cliente cliente : clientes) {
                if (cliente.getFlexIdVendedor() != null && !cliente.getFlexIdVendedor().isEmpty()) {
                    clientesVinculados.add(Map.of(
                        "id", cliente.getId(),
                        "codigo", cliente.getCodigo() != null ? cliente.getCodigo() : "",
                        "nombre", cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : "",
                        "flexIdVendedor", cliente.getFlexIdVendedor(),
                        "flexUsername", cliente.getFlexUsername() != null ? cliente.getFlexUsername() : ""
                    ));
                }
            }
            
            response.put("success", true);
            response.put("total", clientesVinculados.size());
            response.put("clientes", clientesVinculados);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error al listar clientes vinculados: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}

