package com.zetallegue.tms.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.repository.ClienteRepository;
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
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@Slf4j
public class WebhookController {

    private final ClienteRepository clienteRepository;
    private final MercadoLibreService mercadoLibreService;
    private final EnvioService envioService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Endpoint para recibir webhooks de MercadoLibre
     * POST /api/webhooks/mercadolibre
     */
    @PostMapping("/mercadolibre")
    public ResponseEntity<Map<String, Object>> recibirWebhook(@RequestBody String body) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            log.info("Webhook recibido de MercadoLibre: {}", body);
            
            JsonNode webhookData = objectMapper.readTree(body);
            
            // MercadoLibre envía diferentes tipos de notificaciones
            // Para Flex, generalmente viene en el formato:
            // { "resource": "/shipments/{id}", "topic": "shipments", "user_id": 123456 }
            
            String topic = webhookData.has("topic") ? webhookData.get("topic").asText() : null;
            String resource = webhookData.has("resource") ? webhookData.get("resource").asText() : null;
            Long userId = webhookData.has("user_id") ? webhookData.get("user_id").asLong() : null;
            
            log.info("Webhook - Topic: {}, Resource: {}, User ID: {}", topic, resource, userId);
            
            // Solo procesar notificaciones de shipments
            if (!"shipments".equals(topic) && !"flex-handshakes".equals(topic)) {
                log.debug("Webhook ignorado - topic no es shipments ni flex-handshakes: {}", topic);
                response.put("status", "ignored");
                response.put("message", "Topic no procesado: " + topic);
                return ResponseEntity.ok(response);
            }
            
            // Buscar el cliente por flexIdVendedor
            if (userId == null) {
                log.warn("Webhook sin user_id, no se puede procesar");
                response.put("status", "error");
                response.put("message", "user_id no encontrado en webhook");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
            
            Cliente cliente = clienteRepository.findByFlexIdVendedor(userId.toString())
                .orElse(null);
            
            if (cliente == null) {
                log.warn("Cliente no encontrado para user_id: {}", userId);
                response.put("status", "error");
                response.put("message", "Cliente no encontrado para user_id: " + userId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }
            
            // Si el resource es un shipment, obtenerlo y procesarlo
            if (resource != null && resource.startsWith("/shipments/")) {
                String shipmentId = resource.replace("/shipments/", "");
                log.info("Procesando shipment: {} para cliente: {}", shipmentId, cliente.getId());
                
                // Obtener el envío desde MercadoLibre
                try {
                    List<com.fasterxml.jackson.databind.JsonNode> enviosML = mercadoLibreService.obtenerEnviosFlex(cliente.getId());
                    
                    // Buscar el envío específico
                    com.fasterxml.jackson.databind.JsonNode envioML = null;
                    for (com.fasterxml.jackson.databind.JsonNode envio : enviosML) {
                        if (envio.has("id") && shipmentId.equals(envio.get("id").asText())) {
                            envioML = envio;
                            break;
                        }
                    }
                    
                    if (envioML != null) {
                        // Mapear y guardar/actualizar el envío
                        com.zetallegue.tms.dto.EnvioDTO envioDTO = mercadoLibreService.mapearEnvioFlex(envioML, cliente);
                        
                        java.util.Optional<com.zetallegue.tms.model.Envio> envioExistenteOpt = 
                            envioService.findByTracking(envioDTO.getTracking());
                        
                        if (envioExistenteOpt.isPresent()) {
                            com.zetallegue.tms.model.Envio envioExistente = envioExistenteOpt.get();
                            if (!envioExistente.getEliminado()) {
                                envioService.actualizarEnvio(envioExistente.getId(), envioDTO);
                                log.info("Envío actualizado desde webhook: {}", shipmentId);
                            } else {
                                envioService.crearEnvio(envioDTO);
                                log.info("Nuevo envío creado desde webhook (anterior eliminado): {}", shipmentId);
                            }
                        } else {
                            envioService.crearEnvio(envioDTO);
                            log.info("Nuevo envío creado desde webhook: {}", shipmentId);
                        }
                        
                        response.put("status", "success");
                        response.put("message", "Envío procesado correctamente");
                        return ResponseEntity.ok(response);
                    } else {
                        log.warn("Envío {} no encontrado en la respuesta de MercadoLibre", shipmentId);
                        response.put("status", "warning");
                        response.put("message", "Envío no encontrado en MercadoLibre");
                        return ResponseEntity.ok(response);
                    }
                } catch (Exception e) {
                    log.error("Error al procesar envío desde webhook: {}", e.getMessage(), e);
                    response.put("status", "error");
                    response.put("message", "Error al procesar envío: " + e.getMessage());
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
                }
            }
            
            // Si no es un shipment específico, responder OK pero no procesar
            response.put("status", "received");
            response.put("message", "Webhook recibido pero no procesado (resource no es shipment)");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error al procesar webhook de MercadoLibre: {}", e.getMessage(), e);
            response.put("status", "error");
            response.put("message", "Error al procesar webhook: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Endpoint GET para verificación de webhooks (MercadoLibre puede hacer GET para verificar)
     */
    @GetMapping("/mercadolibre")
    public ResponseEntity<Map<String, String>> verificarWebhook() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "ok");
        response.put("message", "Webhook endpoint activo");
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint para recibir webhooks de Tienda Nube - Store Redact
     * Se activa cuando una tienda elimina/redacta datos
     * POST /api/webhooks/tiendanube/store-redact
     */
    @PostMapping("/tiendanube/store-redact")
    public ResponseEntity<Map<String, Object>> recibirWebhookStoreRedact(@RequestBody String body) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            log.info("Webhook Tienda Nube - Store Redact recibido: {}", body);
            
            // TODO: Procesar el webhook según la estructura de Tienda Nube
            // JsonNode webhookData = objectMapper.readTree(body);
            // Por ahora, solo logueamos y respondemos OK
            
            response.put("status", "received");
            response.put("message", "Webhook store redact recibido correctamente");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error al procesar webhook store redact de Tienda Nube: {}", e.getMessage(), e);
            response.put("status", "error");
            response.put("message", "Error al procesar webhook: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Endpoint para recibir webhooks de Tienda Nube - Customers Redact
     * Se activa cuando un cliente solicita la eliminación/redacción de sus datos
     * POST /api/webhooks/tiendanube/customers-redact
     */
    @PostMapping("/tiendanube/customers-redact")
    public ResponseEntity<Map<String, Object>> recibirWebhookCustomersRedact(@RequestBody String body) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            log.info("Webhook Tienda Nube - Customers Redact recibido: {}", body);
            
            // TODO: Procesar el webhook según la estructura de Tienda Nube
            // JsonNode webhookData = objectMapper.readTree(body);
            // Por ahora, solo logueamos y respondemos OK
            
            response.put("status", "received");
            response.put("message", "Webhook customers redact recibido correctamente");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error al procesar webhook customers redact de Tienda Nube: {}", e.getMessage(), e);
            response.put("status", "error");
            response.put("message", "Error al procesar webhook: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Endpoint para recibir webhooks de Tienda Nube - Customers Data Request
     * Se activa cuando un cliente solicita sus datos personales
     * POST /api/webhooks/tiendanube/customers-data-request
     */
    @PostMapping("/tiendanube/customers-data-request")
    public ResponseEntity<Map<String, Object>> recibirWebhookCustomersDataRequest(@RequestBody String body) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            log.info("Webhook Tienda Nube - Customers Data Request recibido: {}", body);
            
            // TODO: Procesar el webhook según la estructura de Tienda Nube
            // JsonNode webhookData = objectMapper.readTree(body);
            // Por ahora, solo logueamos y respondemos OK
            
            response.put("status", "received");
            response.put("message", "Webhook customers data request recibido correctamente");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error al procesar webhook customers data request de Tienda Nube: {}", e.getMessage(), e);
            response.put("status", "error");
            response.put("message", "Error al procesar webhook: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Endpoints GET para verificación de webhooks de Tienda Nube
     */
    @GetMapping("/tiendanube/store-redact")
    public ResponseEntity<Map<String, String>> verificarWebhookStoreRedact() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "ok");
        response.put("message", "Webhook store redact endpoint activo");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/tiendanube/customers-redact")
    public ResponseEntity<Map<String, String>> verificarWebhookCustomersRedact() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "ok");
        response.put("message", "Webhook customers redact endpoint activo");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/tiendanube/customers-data-request")
    public ResponseEntity<Map<String, String>> verificarWebhookCustomersDataRequest() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "ok");
        response.put("message", "Webhook customers data request endpoint activo");
        return ResponseEntity.ok(response);
    }
}

