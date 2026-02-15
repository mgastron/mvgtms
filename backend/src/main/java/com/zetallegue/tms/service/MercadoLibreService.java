package com.zetallegue.tms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.repository.ClienteRepository;
import com.zetallegue.tms.service.ListaPrecioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MercadoLibreService {

    private final ClienteRepository clienteRepository;
    private final ListaPrecioService listaPrecioService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    public ClienteRepository getClienteRepository() {
        return clienteRepository;
    }
    
    // Base URL de la API de MercadoLibre Argentina
    private static final String ML_API_BASE = "https://api.mercadolibre.com";
    
    /**
     * Refresca el access token si está expirado
     */
    @Transactional
    public String refrescarTokenSiNecesario(Cliente cliente) throws Exception {
        // Si el token no está expirado, devolverlo directamente
        if (cliente.getFlexTokenExpiresAt() != null && 
            cliente.getFlexTokenExpiresAt().isAfter(LocalDateTime.now().plusMinutes(5))) {
            if (cliente.getFlexAccessToken() != null && !cliente.getFlexAccessToken().isEmpty()) {
                return cliente.getFlexAccessToken();
            }
        }
        
        // Si no hay refresh token, intentar usar el access token actual si existe
        if (cliente.getFlexRefreshToken() == null || cliente.getFlexRefreshToken().isEmpty()) {
            log.warn("⚠️ Cliente {} no tiene refresh token guardado", cliente.getId());
            
            // Si hay access token, intentar usarlo aunque pueda estar expirado
            if (cliente.getFlexAccessToken() != null && !cliente.getFlexAccessToken().isEmpty()) {
                log.warn("⚠️ Intentando usar access token existente (puede estar expirado)");
                return cliente.getFlexAccessToken();
            }
            
            // Si no hay ni access token ni refresh token, no hay nada que hacer
            throw new RuntimeException(
                "El cliente " + cliente.getId() + " no tiene refresh token ni access token configurado. " +
                "Es necesario re-autorizar la vinculación con MercadoLibre desde la pestaña 'CUENTAS' del cliente. " +
                "El refresh token debería haberse guardado durante la autorización inicial."
            );
        }
        
        log.info("Refrescando token para cliente {}", cliente.getId());
        
        // Obtener credenciales
        String clientId = System.getenv("MERCADOLIBRE_CLIENT_ID");
        if (clientId == null || clientId.isEmpty()) {
            clientId = "5552011749820676";
        }
        
        String clientSecret = System.getenv("MERCADOLIBRE_CLIENT_SECRET");
        if (clientSecret == null || clientSecret.isEmpty()) {
            clientSecret = "8gCzwpun6ny443pfdq7fJH00xa3PSFZW";
        }
        
        // Hacer la petición para refrescar el token
        String urlStr = ML_API_BASE + "/oauth/token";
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        conn.setDoOutput(true);
        
        String params = String.format(
            "grant_type=refresh_token&client_id=%s&client_secret=%s&refresh_token=%s",
            clientId,
            clientSecret,
            java.net.URLEncoder.encode(cliente.getFlexRefreshToken(), "UTF-8")
        );
        
        conn.getOutputStream().write(params.getBytes("UTF-8"));
        
        int responseCode = conn.getResponseCode();
        if (responseCode != 200) {
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
            StringBuilder errorResponse = new StringBuilder();
            String line;
            while ((line = errorReader.readLine()) != null) {
                errorResponse.append(line);
            }
            throw new RuntimeException("Error al refrescar token: " + responseCode + " - " + errorResponse.toString());
        }
        
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            response.append(line);
        }
        
        JsonNode jsonResponse = objectMapper.readTree(response.toString());
        String newAccessToken = jsonResponse.get("access_token").asText();
        String newRefreshToken = jsonResponse.has("refresh_token") ? 
            jsonResponse.get("refresh_token").asText() : cliente.getFlexRefreshToken();
        int expiresIn = jsonResponse.get("expires_in").asInt();
        
        // Actualizar el cliente con los nuevos tokens
        cliente.setFlexAccessToken(newAccessToken);
        cliente.setFlexRefreshToken(newRefreshToken);
        cliente.setFlexTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
        clienteRepository.save(cliente);
        
        log.info("Token refrescado exitosamente para cliente {}", cliente.getId());
        return newAccessToken;
    }
    
    /**
     * Obtiene los envíos Flex de un cliente desde MercadoLibre
     * @param clienteId ID del cliente
     * @return Lista de envíos en formato JSON (para mapear después)
     */
    @Transactional(readOnly = true)
    public List<JsonNode> obtenerEnviosFlex(Long clienteId) throws Exception {
        Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getFlexAccessToken() == null || cliente.getFlexAccessToken().isEmpty()) {
            throw new RuntimeException("El cliente no tiene token de acceso de MercadoLibre");
        }
        
        // Refrescar token si es necesario
        String accessToken = refrescarTokenSiNecesario(cliente);
        
        // Obtener el seller ID
        String sellerId = cliente.getFlexIdVendedor();
        if (sellerId == null || sellerId.isEmpty()) {
            throw new RuntimeException("El cliente no tiene seller ID configurado");
        }
        
        log.info("Obteniendo envíos Flex para cliente {} (seller: {})", clienteId, sellerId);
        
        // Endpoint para obtener envíos Flex
        // Según la documentación oficial de MercadoLibre:
        // - Los shipments Flex vienen dentro de las órdenes
        // - Se usa /orders/search para obtener órdenes del vendedor
        // - Luego se extraen los shipments con logistic_type=flex de cada orden
        
        // Usar /orders/search según documentación oficial
        String urlStr = String.format(
            "%s/orders/search?seller=%s",
            ML_API_BASE,
            sellerId
        );
        
        log.info("Consultando endpoint oficial: {}", urlStr);
        
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", "Bearer " + accessToken);
        conn.setRequestProperty("Accept", "application/json");
        
        int responseCode = conn.getResponseCode();
        
        if (responseCode == 401) {
            // Token inválido, intentar refrescar
            log.warn("Token inválido, intentando refrescar...");
            accessToken = refrescarTokenSiNecesario(cliente);
            conn.disconnect();
            
            // Reintentar la petición
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            responseCode = conn.getResponseCode();
        }
        
        if (responseCode != 200) {
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
            StringBuilder errorResponse = new StringBuilder();
            String line;
            while ((line = errorReader.readLine()) != null) {
                errorResponse.append(line);
            }
            
            // Si el primer endpoint falla con 404, intentar alternativas
            if (responseCode == 404) {
                log.warn("Endpoint /shipments falló con 404, intentando alternativas...");
                
                // Alternativa 1: /orders/search y extraer shipments Flex
                try {
                    String altUrl1 = String.format("%s/orders/search?seller=%s&order.status=paid", ML_API_BASE, sellerId);
                    log.info("Intentando endpoint alternativo 1: {}", altUrl1);
                    
                    URL altUrl = new URL(altUrl1);
                    HttpURLConnection altConn = (HttpURLConnection) altUrl.openConnection();
                    altConn.setRequestMethod("GET");
                    altConn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    altConn.setRequestProperty("Accept", "application/json");
                    
                    int altResponseCode = altConn.getResponseCode();
                    if (altResponseCode == 200) {
                        BufferedReader altReader = new BufferedReader(new InputStreamReader(altConn.getInputStream()));
                        StringBuilder altResponse = new StringBuilder();
                        while ((line = altReader.readLine()) != null) {
                            altResponse.append(line);
                        }
                        JsonNode altJsonResponse = objectMapper.readTree(altResponse.toString());
                        
                        // Procesar respuesta de orders y extraer shipments Flex
                        List<JsonNode> envios = new ArrayList<>();
                        if (altJsonResponse.has("results") && altJsonResponse.get("results").isArray()) {
                            for (JsonNode order : altJsonResponse.get("results")) {
                                if (order.has("shipping") && order.get("shipping").has("shipments")) {
                                    JsonNode shipments = order.get("shipping").get("shipments");
                                    if (shipments.isArray()) {
                                        for (JsonNode shipment : shipments) {
                                            if (shipment.has("logistic_type") && 
                                                "flex".equalsIgnoreCase(shipment.get("logistic_type").asText())) {
                                                envios.add(shipment);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        altConn.disconnect();
                        
                        if (!envios.isEmpty()) {
                            log.info("Se obtuvieron {} envíos Flex desde /orders/search", envios.size());
                            return envios;
                        }
                    }
                    altConn.disconnect();
                } catch (Exception e) {
                    log.warn("Error al intentar endpoint alternativo 1: {}", e.getMessage());
                }
                
                // Alternativa 2: /shipments directamente sin filtros
                try {
                    String altUrl2 = String.format("%s/shipments?seller_id=%s", ML_API_BASE, sellerId);
                    log.info("Intentando endpoint alternativo 2: {}", altUrl2);
                    
                    URL altUrl = new URL(altUrl2);
                    HttpURLConnection altConn = (HttpURLConnection) altUrl.openConnection();
                    altConn.setRequestMethod("GET");
                    altConn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    altConn.setRequestProperty("Accept", "application/json");
                    
                    int altResponseCode = altConn.getResponseCode();
                    if (altResponseCode == 200) {
                        BufferedReader altReader = new BufferedReader(new InputStreamReader(altConn.getInputStream()));
                        StringBuilder altResponse = new StringBuilder();
                        while ((line = altReader.readLine()) != null) {
                            altResponse.append(line);
                        }
                        JsonNode altJsonResponse = objectMapper.readTree(altResponse.toString());
                        
                        // Procesar respuesta y filtrar solo Flex
                        List<JsonNode> envios = new ArrayList<>();
                        if (altJsonResponse.isArray()) {
                            for (JsonNode shipment : altJsonResponse) {
                                if (shipment.has("logistic_type") && 
                                    "flex".equalsIgnoreCase(shipment.get("logistic_type").asText())) {
                                    envios.add(shipment);
                                }
                            }
                        } else if (altJsonResponse.has("results")) {
                            for (JsonNode shipment : altJsonResponse.get("results")) {
                                if (shipment.has("logistic_type") && 
                                    "flex".equalsIgnoreCase(shipment.get("logistic_type").asText())) {
                                    envios.add(shipment);
                                }
                            }
                        }
                        altConn.disconnect();
                        
                        if (!envios.isEmpty()) {
                            log.info("Se obtuvieron {} envíos Flex desde /shipments", envios.size());
                            return envios;
                        }
                    }
                    altConn.disconnect();
                } catch (Exception e) {
                    log.warn("Error al intentar endpoint alternativo 2: {}", e.getMessage());
                }
            }
            
            throw new RuntimeException("Error al obtener envíos Flex: " + responseCode + " - " + errorResponse.toString());
        }
        
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            response.append(line);
        }
        
        JsonNode jsonResponse = objectMapper.readTree(response.toString());
        
        // Procesar respuesta de /orders/search
        // Las órdenes Flex/Fulfillment tienen "fulfilled": true
        // Construimos el shipment directamente desde la orden sin necesidad de llamadas adicionales
        List<JsonNode> envios = new ArrayList<>();
        
        if (jsonResponse.has("results") && jsonResponse.get("results").isArray()) {
            // Iterar sobre las órdenes
            for (JsonNode order : jsonResponse.get("results")) {
                // Filtrar solo órdenes Flex/Fulfillment (fulfilled: true)
                boolean isFulfillment = order.has("fulfilled") && order.get("fulfilled").asBoolean();
                
                if (isFulfillment && order.has("shipping") && order.get("shipping").has("id")) {
                    // Construir un objeto shipment desde la orden
                    ObjectNode shipmentNode = objectMapper.createObjectNode();
                    
                    // ID del shipment (desde shipping.id)
                    JsonNode shipping = order.get("shipping");
                    if (shipping.has("id")) {
                        shipmentNode.put("id", shipping.get("id").asLong());
                    }
                    
                    // Estado del shipment (mapear desde order.status)
                    if (order.has("status")) {
                        String orderStatus = order.get("status").asText();
                        // Mapear estado de orden a estado de shipment
                        String shipmentStatus = mapearEstadoOrdenAShipment(orderStatus);
                        shipmentNode.put("status", shipmentStatus);
                    } else {
                        shipmentNode.put("status", "ready_to_ship");
                    }
                    
                    // Fecha de creación (desde order.date_created)
                    if (order.has("date_created")) {
                        shipmentNode.put("date_created", order.get("date_created").asText());
                    }
                    
                    // Tipo logístico (Flex/Fulfillment)
                    shipmentNode.put("logistic_type", "flex");
                    
                    // Dirección del destinatario (construir desde order si está disponible)
                    // Nota: La dirección puede estar en order.shipping o necesitar otra llamada
                    // Por ahora, intentamos construirla desde lo que tenemos
                    ObjectNode receiverAddress = objectMapper.createObjectNode();
                    
                    // Si la orden tiene información del buyer, usarla
                    if (order.has("buyer")) {
                        JsonNode buyer = order.get("buyer");
                        if (buyer.has("nickname")) {
                            receiverAddress.put("receiver_name", buyer.get("nickname").asText());
                        }
                    }
                    
                    // Intentar obtener dirección desde shipping si está disponible
                    if (shipping.has("receiver_address")) {
                        receiverAddress.setAll((ObjectNode) shipping.get("receiver_address"));
                    } else {
                        // Si no hay receiver_address, dejamos campos vacíos
                        // (se completarán cuando se obtenga el shipment completo o desde otra fuente)
                        receiverAddress.put("address_line", "");
                        ObjectNode cityNode = objectMapper.createObjectNode();
                        cityNode.put("name", "");
                        receiverAddress.set("city", cityNode);
                        receiverAddress.put("zip_code", "");
                    }
                    
                    shipmentNode.set("receiver_address", receiverAddress);
                    
                    // Comentario (desde order.comment si existe)
                    if (order.has("comment")) {
                        shipmentNode.put("comment", order.get("comment").asText());
                    }
                    
                    // Agregar el shipment construido
                    envios.add(shipmentNode);
                    log.debug("Shipment construido desde orden {}: {}", 
                        order.has("id") ? order.get("id").asLong() : "N/A", 
                        shipmentNode.toString());
                }
            }
        } else if (jsonResponse.isArray()) {
            // Si la respuesta es directamente un array de órdenes
            for (JsonNode order : jsonResponse) {
                boolean isFulfillment = order.has("fulfilled") && order.get("fulfilled").asBoolean();
                
                if (isFulfillment && order.has("shipping") && order.get("shipping").has("id")) {
                    // Misma lógica que arriba
                    ObjectNode shipmentNode = objectMapper.createObjectNode();
                    JsonNode shipping = order.get("shipping");
                    
                    if (shipping.has("id")) {
                        shipmentNode.put("id", shipping.get("id").asLong());
                    }
                    
                    if (order.has("status")) {
                        String orderStatus = order.get("status").asText();
                        shipmentNode.put("status", mapearEstadoOrdenAShipment(orderStatus));
                    } else {
                        shipmentNode.put("status", "ready_to_ship");
                    }
                    
                    if (order.has("date_created")) {
                        shipmentNode.put("date_created", order.get("date_created").asText());
                    }
                    
                    shipmentNode.put("logistic_type", "flex");
                    
                    ObjectNode receiverAddress = objectMapper.createObjectNode();
                    if (order.has("buyer")) {
                        JsonNode buyer = order.get("buyer");
                        if (buyer.has("nickname")) {
                            receiverAddress.put("receiver_name", buyer.get("nickname").asText());
                        }
                    }
                    
                    if (shipping.has("receiver_address")) {
                        receiverAddress.setAll((ObjectNode) shipping.get("receiver_address"));
                    } else {
                        receiverAddress.put("address_line", "");
                        ObjectNode cityNode = objectMapper.createObjectNode();
                        cityNode.put("name", "");
                        receiverAddress.set("city", cityNode);
                        receiverAddress.put("zip_code", "");
                    }
                    
                    shipmentNode.set("receiver_address", receiverAddress);
                    
                    if (order.has("comment")) {
                        shipmentNode.put("comment", order.get("comment").asText());
                    }
                    
                    envios.add(shipmentNode);
                }
            }
        }
        
        log.info("Se obtuvieron {} envíos Flex para el cliente {} (de {} órdenes)", 
            envios.size(), clienteId, 
            jsonResponse.has("results") ? jsonResponse.get("results").size() : 0);
        
        // Log detallado de la respuesta si no hay envíos
        if (envios.isEmpty()) {
            log.warn("No se encontraron envíos Flex. Estructura de respuesta: {}", 
                jsonResponse.has("results") ? "Tiene 'results'" : 
                jsonResponse.isArray() ? "Es array" : "Estructura desconocida");
            if (jsonResponse.has("results") && jsonResponse.get("results").size() > 0) {
                JsonNode primeraOrden = jsonResponse.get("results").get(0);
                log.warn("Estructura de primera orden: {}", primeraOrden.toString());
            }
        } else {
            log.debug("Primer envío recibido: {}", envios.get(0).toString());
        }
        
        return envios;
    }
    
    /**
     * Convierte un envío de MercadoLibre a EnvioDTO
     */
    public com.zetallegue.tms.dto.EnvioDTO mapearEnvioFlex(JsonNode mlEnvio, Cliente cliente) {
        com.zetallegue.tms.dto.EnvioDTO envioDTO = new com.zetallegue.tms.dto.EnvioDTO();
        
        try {
            // Tracking (ID del envío en ML)
            if (mlEnvio.has("id")) {
                envioDTO.setTracking(mlEnvio.get("id").asText());
            }
            
            // Cliente (formato: codigo - nombre)
            String clienteStr = cliente.getCodigo() + " - " + cliente.getNombreFantasia();
            envioDTO.setCliente(clienteStr);
            
            // Origen
            envioDTO.setOrigen("Flex");
            
            // Estado - mapear estados de ML a nuestros estados
            if (mlEnvio.has("status")) {
                String mlStatus = mlEnvio.get("status").asText();
                envioDTO.setEstado(mapearEstadoML(mlStatus));
            } else {
                envioDTO.setEstado("A retirar");
            }
            
            // Fechas
            // Fecha de ingreso: fecha actual (cuando se colecta/escanea)
            envioDTO.setFecha(LocalDateTime.now());
            
            // Fecha de venta: date_created del shipment (cuando se creó en MercadoLibre)
            // Fecha de venta (date_created del shipment)
            LocalDateTime fechaVenta = null;
            if (mlEnvio.has("date_created")) {
                String dateCreated = mlEnvio.get("date_created").asText();
                fechaVenta = parsearFechaML(dateCreated);
                envioDTO.setFechaVenta(fechaVenta);
                log.info("Fecha de venta mapeada desde date_created: {}", fechaVenta);
            } else {
                envioDTO.setFechaVenta(null);
            }
            
            // Calcular deadline: mismo día a las 23:00 si venta antes de las 15:00, o día siguiente a las 23:00 si después
            if (fechaVenta != null) {
                LocalDateTime deadline;
                if (fechaVenta.getHour() < 15) {
                    // Mismo día a las 23:00:00
                    deadline = fechaVenta.toLocalDate().atTime(23, 0, 0);
                } else {
                    // Día siguiente a las 23:00:00
                    deadline = fechaVenta.toLocalDate().plusDays(1).atTime(23, 0, 0);
                }
                envioDTO.setDeadline(deadline);
                log.info("Deadline calculado: {} (venta a las {})", deadline, fechaVenta.toLocalTime());
            } else {
                envioDTO.setDeadline(null);
            }
            
            // Dirección y datos del destinatario
            // IMPORTANTE: La dirección puede estar en diferentes lugares según el endpoint usado:
            // 1. receiver_address (formato antiguo o desde orders)
            // 2. destination.shipping_address (formato nuevo desde /shipments/{id})
            JsonNode addressNode = null;
            String addressSource = "none";
            
            // Prioridad 1: destination.shipping_address (formato nuevo desde /shipments/{id})
            if (mlEnvio.has("destination") && mlEnvio.get("destination").has("shipping_address")) {
                addressNode = mlEnvio.get("destination").get("shipping_address");
                addressSource = "destination.shipping_address";
                log.info("✓ Dirección encontrada en destination.shipping_address");
            }
            // Prioridad 2: receiver_address (formato antiguo o desde orders)
            else if (mlEnvio.has("receiver_address")) {
                addressNode = mlEnvio.get("receiver_address");
                addressSource = "receiver_address";
                log.info("✓ Dirección encontrada en receiver_address");
            }
            // Prioridad 3: destination.receiver_name (solo nombre, sin dirección completa)
            else if (mlEnvio.has("destination") && mlEnvio.get("destination").has("receiver_name")) {
                log.info("Solo receiver_name encontrado en destination, sin dirección completa");
            }
            
            if (addressNode != null) {
                // Dirección completa
                StringBuilder direccion = new StringBuilder();
                if (addressNode.has("address_line") && !addressNode.get("address_line").asText().isEmpty()) {
                    direccion.append(addressNode.get("address_line").asText());
                } else {
                    // Si no hay address_line, construir desde street_name y street_number
                    if (addressNode.has("street_name") && !addressNode.get("street_name").asText().isEmpty()) {
                        direccion.append(addressNode.get("street_name").asText());
                    }
                    if (addressNode.has("street_number") && !addressNode.get("street_number").asText().isEmpty()) {
                        if (direccion.length() > 0) direccion.append(" ");
                        direccion.append(addressNode.get("street_number").asText());
                    }
                }
                envioDTO.setDireccion(direccion.length() > 0 ? direccion.toString() : "Dirección pendiente");
                
                // Localidad
                if (addressNode.has("city")) {
                    JsonNode city = addressNode.get("city");
                    if (city.has("name") && !city.get("name").asText().isEmpty()) {
                        envioDTO.setLocalidad(city.get("name").asText());
                    } else {
                        envioDTO.setLocalidad("");
                    }
                } else {
                    envioDTO.setLocalidad("");
                }
                
                // Código postal
                if (addressNode.has("zip_code") && !addressNode.get("zip_code").asText().isEmpty()) {
                    envioDTO.setCodigoPostal(addressNode.get("zip_code").asText());
                } else {
                    envioDTO.setCodigoPostal("");
                }
                
                // Nombre del destinatario
                // Puede estar en addressNode.receiver_name o en destination.receiver_name
                String receiverName = null;
                if (addressNode.has("receiver_name") && !addressNode.get("receiver_name").asText().isEmpty()) {
                    receiverName = addressNode.get("receiver_name").asText();
                } else if (mlEnvio.has("destination") && mlEnvio.get("destination").has("receiver_name")) {
                    receiverName = mlEnvio.get("destination").get("receiver_name").asText();
                }
                
                if (receiverName != null && !receiverName.isEmpty()) {
                    envioDTO.setNombreDestinatario(receiverName);
                } else {
                    envioDTO.setNombreDestinatario("Destinatario pendiente");
                }
                
                // Teléfono
                // Puede estar en addressNode.receiver_phone o en destination.receiver_phone
                String receiverPhone = null;
                if (addressNode.has("receiver_phone") && !addressNode.get("receiver_phone").asText().isEmpty()) {
                    receiverPhone = addressNode.get("receiver_phone").asText();
                } else if (mlEnvio.has("destination") && mlEnvio.get("destination").has("receiver_phone")) {
                    receiverPhone = mlEnvio.get("destination").get("receiver_phone").asText();
                }
                
                if (receiverPhone != null && !receiverPhone.isEmpty()) {
                    envioDTO.setTelefono(receiverPhone);
                } else {
                    envioDTO.setTelefono("");
                }
                
                log.info("Dirección mapeada desde {}: {} - {} - CP: {} - Nombre: {} - Tel: {}", 
                    addressSource, 
                    envioDTO.getDireccion(), 
                    envioDTO.getLocalidad(), 
                    envioDTO.getCodigoPostal(),
                    envioDTO.getNombreDestinatario(),
                    envioDTO.getTelefono());
            } else {
                // Si no hay dirección en ningún lugar, usar valores por defecto
                log.warn("⚠️  No se encontró dirección en ningún lugar del shipment");
                envioDTO.setDireccion("Dirección pendiente");
                envioDTO.setLocalidad("");
                envioDTO.setCodigoPostal("");
                envioDTO.setNombreDestinatario("Destinatario pendiente");
                envioDTO.setTelefono("");
            }

            // Zona de entrega (misma lógica que "Subir individual" / `lib/zonas-utils.ts`)
            // Esto es independiente de la lista de precios: la columna debe completarse solo por CP.
            envioDTO.setZonaEntrega(determinarZonaEntrega(envioDTO.getCodigoPostal()));
            
            // Referencia domicilio (comment de destination.shipping_address) - va a cambioRetiro
            if (mlEnvio.has("destination") && mlEnvio.get("destination").has("shipping_address")) {
                JsonNode shippingAddress = mlEnvio.get("destination").get("shipping_address");
                if (shippingAddress.has("comment") && !shippingAddress.get("comment").asText().isEmpty()) {
                    envioDTO.setCambioRetiro(shippingAddress.get("comment").asText());
                    log.info("Referencia domicilio mapeada desde destination.shipping_address.comment: {}", shippingAddress.get("comment").asText());
                }
            }
            
            // Observaciones: solo las observaciones reales del shipment (comment), sin agregar basura
            if (mlEnvio.has("comment") && !mlEnvio.get("comment").isNull()) {
                String comment = mlEnvio.get("comment").asText();
                if (!comment.isEmpty() && !comment.equals("null")) {
                    envioDTO.setObservaciones(comment);
                } else {
                    envioDTO.setObservaciones(null);
                }
            } else {
                envioDTO.setObservaciones(null);
            }
            
            // QR Data: usar el QR completo si está disponible, sino construir uno básico
            if (mlEnvio.has("qr_data")) {
                envioDTO.setQrData(mlEnvio.get("qr_data").asText());
            } else if (mlEnvio.has("id")) {
                envioDTO.setQrData("FLEX_" + mlEnvio.get("id").asText());
            }
            
            // IDML (Order ID) - mapear a campo idml
            if (mlEnvio.has("order_id")) {
                envioDTO.setIdml(mlEnvio.get("order_id").asText());
                log.info("IDML (Order ID) mapeado: {}", mlEnvio.get("order_id").asText());
            } else if (mlEnvio.has("external_reference") && !mlEnvio.get("external_reference").isNull()) {
                envioDTO.setIdml(mlEnvio.get("external_reference").asText());
                log.info("IDML (external_reference) mapeado: {}", mlEnvio.get("external_reference").asText());
            }
            
            // Valor declarado del paquete (declared_value) - va a totalACobrar
            // IMPORTANTE: Usar declared_value, no total_amount
            if (mlEnvio.has("declared_value")) {
                double declaredValue = mlEnvio.get("declared_value").asDouble();
                envioDTO.setTotalACobrar(String.format("%.2f", declaredValue));
                log.info("Valor declarado del paquete mapeado desde declared_value a totalACobrar: ${}", String.format("%.2f", declaredValue));
            } else if (mlEnvio.has("total_amount")) {
                // Fallback a total_amount si declared_value no está disponible
                double totalAmount = mlEnvio.get("total_amount").asDouble();
                envioDTO.setTotalACobrar(String.format("%.2f", totalAmount));
                log.info("Valor declarado del paquete mapeado desde total_amount (fallback) a totalACobrar: ${}", String.format("%.2f", totalAmount));
            } else {
                envioDTO.setTotalACobrar("0.00");
                log.warn("⚠️  No se encontró declared_value ni total_amount, usando 0.00");
            }
            
            // Peso total - mapear a campo peso
            if (mlEnvio.has("dimensions") && mlEnvio.get("dimensions").has("weight")) {
                double peso = mlEnvio.get("dimensions").get("weight").asDouble();
                envioDTO.setPeso(String.format("%.0f", peso));
                log.info("Peso total mapeado: {}g", String.format("%.0f", peso));
            }
            
            // Costo de envío - calcular desde lista de precios usando CP y cliente
            // Similar a la lógica en "Lista de Precios"
            String codigoPostal = envioDTO.getCodigoPostal();
            if (codigoPostal != null && !codigoPostal.trim().isEmpty() && cliente.getListaPreciosId() != null) {
                try {
                    double costoEnvio = calcularCostoEnvioDesdeListaPrecios(codigoPostal, cliente.getListaPreciosId());
                    if (costoEnvio > 0) {
                        // Guardar el costo de envío en el campo costoEnvio (NO en observaciones)
                        envioDTO.setCostoEnvio(String.format("%.2f", costoEnvio));
                        log.info("Costo de envío calculado desde lista de precios: ${}", String.format("%.2f", costoEnvio));
                    } else {
                        envioDTO.setCostoEnvio(null);
                        log.warn("No se pudo calcular el costo de envío desde lista de precios para CP: {}", codigoPostal);
                    }
                } catch (Exception e) {
                    envioDTO.setCostoEnvio(null);
                    log.warn("Error al calcular costo de envío desde lista de precios: {}", e.getMessage());
                }
            } else {
                envioDTO.setCostoEnvio(null);
                log.warn("No se puede calcular costo de envío: CP={}, listaPreciosId={}", codigoPostal, cliente.getListaPreciosId());
            }
            
            // Costo de envío desde ML - solo loguear para referencia
            double shippingCostML = 0.0;
            if (mlEnvio.has("shipping_cost")) {
                shippingCostML = mlEnvio.get("shipping_cost").asDouble();
                log.info("Costo de envío desde ML (solo referencia): ${}", String.format("%.2f", shippingCostML));
            } else if (mlEnvio.has("lead_time") && mlEnvio.get("lead_time").has("cost")) {
                shippingCostML = mlEnvio.get("lead_time").get("cost").asDouble();
                log.info("Costo de envío desde ML lead_time.cost (solo referencia): ${}", String.format("%.2f", shippingCostML));
            } else if (mlEnvio.has("lead_time") && mlEnvio.get("lead_time").has("list_cost")) {
                shippingCostML = mlEnvio.get("lead_time").get("list_cost").asDouble();
                log.info("Costo de envío desde ML lead_time.list_cost (solo referencia): ${}", String.format("%.2f", shippingCostML));
            }
            
            // Método de envío - mapear a campo metodoEnvio
            String shippingMethod = null;
            if (mlEnvio.has("shipping_method")) {
                if (mlEnvio.get("shipping_method").isTextual()) {
                    shippingMethod = mlEnvio.get("shipping_method").asText();
                } else if (mlEnvio.get("shipping_method").has("name")) {
                    shippingMethod = mlEnvio.get("shipping_method").get("name").asText();
                }
            } else if (mlEnvio.has("lead_time") && mlEnvio.get("lead_time").has("shipping_method")) {
                JsonNode shippingMethodNode = mlEnvio.get("lead_time").get("shipping_method");
                if (shippingMethodNode.has("name")) {
                    shippingMethod = shippingMethodNode.get("name").asText();
                } else if (shippingMethodNode.isTextual()) {
                    shippingMethod = shippingMethodNode.asText();
                }
            }
            
            if (shippingMethod != null && !shippingMethod.isEmpty()) {
                envioDTO.setMetodoEnvio(shippingMethod);
                log.info("Método de envío mapeado: {}", shippingMethod);
            }
            
            // Eliminado
            envioDTO.setEliminado(false);
            
            // Impreso
            envioDTO.setImpreso("NO");
            
            // Colectado: true cuando se obtiene desde ML al escanear (ya se está colectando)
            envioDTO.setColectado(true);
            
        } catch (Exception e) {
            log.error("Error al mapear envío Flex: {}", e.getMessage(), e);
            throw new RuntimeException("Error al mapear envío Flex: " + e.getMessage(), e);
        }
        
        return envioDTO;
    }

    /**
     * Determina la zona de entrega basándose en el CP.
     * Replica `lib/zonas-utils.ts` (CABA / Zona 1 / Zona 2 / Zona 3 / Sin Zona).
     */
    private String determinarZonaEntrega(String codigoPostal) {
        if (codigoPostal == null || codigoPostal.trim().isEmpty()) {
            return "Sin Zona";
        }

        String cpLimpio = codigoPostal.replaceAll("\\D", "");
        if (cpLimpio.isEmpty()) return "Sin Zona";

        int cpNumero;
        try {
            cpNumero = Integer.parseInt(cpLimpio);
        } catch (NumberFormatException e) {
            return "Sin Zona";
        }

        // CABA (1000-1599)
        if (cpNumero >= 1000 && cpNumero <= 1599) {
            return "CABA";
        }

        if (CP_ZONA_1.contains(cpLimpio)) return "Zona 1";
        if (CP_ZONA_2.contains(cpLimpio)) return "Zona 2";
        if (CP_ZONA_3.contains(cpLimpio)) return "Zona 3";

        return "Sin Zona";
    }

    // CPs por zona (copiados de `lib/zonas-utils.ts`)
    private static final java.util.Set<String> CP_ZONA_1 = new java.util.HashSet<>(java.util.Arrays.asList(
            "1602","1603","1604","1605","1606","1607","1609","1636","1637","1638","1640","1641","1642","1643","1644","1645","1646","1649","1650","1651","1652","1653","1655","1657","1672","1674","1675","1676","1678","1682","1683","1684","1685","1686","1687","1688","1692","1702","1703","1704","1706","1707","1708","1712","1713","1714","1715","1751","1752","1753","1754","1766","1773","1821","1822","1823","1824","1825","1826","1827","1828","1829","1831","1832","1833","1834","1835","1836","1868","1869","1870","1871","1872","1873","1874","1875"
    ));
    private static final java.util.Set<String> CP_ZONA_2 = new java.util.HashSet<>(java.util.Arrays.asList(
            "1608","1610","1611","1612","1613","1614","1615","1616","1617","1618","1621","1624","1648","1659","1660","1661","1662","1663","1664","1665","1666","1667","1670","1671","1716","1718","1722","1723","1724","1736","1738","1740","1742","1743","1744","1745","1746","1755","1757","1758","1759","1761","1763","1764","1765","1768","1770","1771","1772","1774","1776","1778","1785","1786","1801","1802","1803","1804","1805","1806","1807","1812","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1851","1852","1853","1854","1855","1856","1859","1860","1861","1863","1867","1876","1877","1878","1879","1880","1881","1882","1883","1884","1885","1886","1887","1888","1889","1890","1891","1893"
    ));
    private static final java.util.Set<String> CP_ZONA_3 = new java.util.HashSet<>(java.util.Arrays.asList(
            "1601","1619","1620","1622","1623","1625","1626","1627","1628","1629","1630","1631","1632","1633","1634","1635","1639","1647","1669","1727","1748","1749","1808","1814","1815","1816","1858","1862","1864","1865","1894","1895","1896","1897","1898","1900","1901","1902","1903","1904","1905","1906","1907","1908","1909","1910","1912","1914","1916","1923","1924","1925","1926","1927","1929","1931","1984","2800","2801","2802","2804","2805","2806","2808","2814","2816","6608","6700","6701","6702","6703","6706","6708","6712"
    ));
    
    /**
     * Calcula el costo de envío desde la lista de precios del cliente
     * Replica la lógica de "Lista de Precios" del frontend
     */
    public double calcularCostoEnvioDesdeListaPrecios(String codigoPostal, Long listaPreciosId) {
        try {
            // Limpiar el CP (solo números)
            String cpLimpio = codigoPostal.replaceAll("\\D", "");
            int cpNumero;
            try {
                cpNumero = Integer.parseInt(cpLimpio);
            } catch (NumberFormatException e) {
                log.warn("CP inválido: {}", codigoPostal);
                return 0.0;
            }
            
            // Obtener la lista de precios directamente desde el servicio
            // Usar manejo de excepciones específico para evitar problemas de transacción
            log.info("Obteniendo lista de precios desde servicio para ID: {}", listaPreciosId);
            com.zetallegue.tms.dto.ListaPrecioDTO listaPreciosDTO;
            try {
                listaPreciosDTO = listaPrecioService.obtenerListaPrecioPorId(listaPreciosId);
            } catch (RuntimeException e) {
                // Si no se encuentra la lista de precios, no es crítico, continuar sin costo
                log.warn("Lista de precios no encontrada o error al obtenerla (ID: {}): {}", listaPreciosId, e.getMessage());
                return 0.0;
            } catch (Exception e) {
                log.warn("Error inesperado al obtener lista de precios desde servicio: {}", e.getMessage());
                return 0.0;
            }
            
            if (listaPreciosDTO == null || listaPreciosDTO.getZonas() == null || listaPreciosDTO.getZonas().isEmpty()) {
                log.warn("Lista de precios sin zonas para ID: {}", listaPreciosId);
                return 0.0;
            }
            
            // Buscar el CP en las zonas
            for (com.zetallegue.tms.dto.ZonaDTO zona : listaPreciosDTO.getZonas()) {
                if (zona.getCps() == null || zona.getCps().isEmpty()) continue;
                
                String cps = zona.getCps();
                
                // Verificar si es un rango (ej: "1000-1599")
                java.util.regex.Pattern rangoPattern = java.util.regex.Pattern.compile("(\\d+)-(\\d+)");
                java.util.regex.Matcher rangoMatch = rangoPattern.matcher(cps);
                if (rangoMatch.find()) {
                    int inicio = Integer.parseInt(rangoMatch.group(1));
                    int fin = Integer.parseInt(rangoMatch.group(2));
                    if (cpNumero >= inicio && cpNumero <= fin) {
                        // Zona encontrada
                        if (zona.getValor() != null && !zona.getValor().isEmpty()) {
                            try {
                                double valor = Double.parseDouble(zona.getValor());
                                log.info("Costo de envío encontrado en zona {}: ${}", zona.getNombre() != null ? zona.getNombre() : "desconocida", String.format("%.2f", valor));
                                return valor;
                            } catch (NumberFormatException e) {
                                log.warn("Valor de zona inválido: {}", zona.getValor());
                            }
                        }
                    }
                }
                
                // Verificar si está en la lista de CPs separados por comas
                String[] cpsLista = cps.split(",");
                for (String cp : cpsLista) {
                    String cpTrim = cp.trim();
                    if (cpTrim.equals(cpLimpio) || cpTrim.equals(String.valueOf(cpNumero))) {
                        // Zona encontrada
                        if (zona.getValor() != null && !zona.getValor().isEmpty()) {
                            try {
                                double valor = Double.parseDouble(zona.getValor());
                                log.info("Costo de envío encontrado en zona {}: ${}", zona.getNombre() != null ? zona.getNombre() : "desconocida", String.format("%.2f", valor));
                                return valor;
                            } catch (NumberFormatException e) {
                                log.warn("Valor de zona inválido: {}", zona.getValor());
                            }
                        }
                    }
                }
            }
            
            log.warn("No se encontró una zona para el CP: {}", codigoPostal);
            return 0.0;
        } catch (Exception e) {
            log.error("Error al calcular costo de envío desde lista de precios: {}", e.getMessage(), e);
            return 0.0;
        }
    }
    
    /**
     * Mapea estados de MercadoLibre a nuestros estados
     */
    public String mapearEstadoML(String mlStatus) {
        // Mapeo de estados de ML a nuestros estados
        switch (mlStatus.toLowerCase()) {
            case "ready_to_ship":
            case "pending":
                return "A retirar";
            case "shipped":
            case "in_transit":
                return "En camino al destinatario";
            case "delivered":
                return "Entregado";
            case "cancelled":
                return "Cancelado";
            case "rejected":
                return "Rechazado por el comprador";
            default:
                return "A retirar";
        }
    }
    
    /**
     * Parsea una fecha de MercadoLibre (ISO 8601) a LocalDateTime
     */
    private LocalDateTime parsearFechaML(String fechaML) {
        try {
            // ML usa formato ISO 8601 con timezone
            ZonedDateTime zonedDateTime = ZonedDateTime.parse(fechaML);
            return zonedDateTime.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception e) {
            log.warn("Error al parsear fecha de ML: {}", fechaML, e);
            return LocalDateTime.now();
        }
    }
    
    /**
     * Obtiene un shipment individual desde MercadoLibre por su ID
     * @param shipmentId ID del shipment en MercadoLibre
     * @param cliente Cliente vinculado con MercadoLibre
     * @return JsonNode con los datos del shipment
     */
    public JsonNode obtenerShipmentPorId(String shipmentId, Cliente cliente) throws Exception {
        // Refrescar token si es necesario
        String accessToken = refrescarTokenSiNecesario(cliente);
        String sellerId = cliente.getFlexIdVendedor();
        
        // Log del token para debugging
        log.info("=== TOKEN INFO ===");
        log.info("Token (primeros 20 chars): {}...", accessToken != null && accessToken.length() > 20 ? accessToken.substring(0, 20) : "null");
        log.info("Token completo length: {}", accessToken != null ? accessToken.length() : 0);
        log.info("Seller ID: {}", sellerId);
        log.info("Cliente ID: {}", cliente.getId());
        log.info("Cliente tiene access token: {}", cliente.getFlexAccessToken() != null && !cliente.getFlexAccessToken().isEmpty());
        log.info("Cliente tiene refresh token: {}", cliente.getFlexRefreshToken() != null && !cliente.getFlexRefreshToken().isEmpty());
        
        if (sellerId == null || sellerId.isEmpty()) {
            throw new RuntimeException("El cliente no tiene seller ID configurado");
        }
        
        log.info("Obteniendo shipment {} desde MercadoLibre para seller {}", shipmentId, sellerId);
        
        // Primero obtener el order_id desde /orders/search para tener todos los IDs disponibles
        Long orderId = null;
        Long buyerId = null;
        Long packId = null;
        try {
            String searchUrl = String.format("%s/orders/search?seller=%s&shipping.id=%s", ML_API_BASE, sellerId, shipmentId);
            URL url = new URL(searchUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                JsonNode jsonResponse = objectMapper.readTree(response.toString());
                conn.disconnect();
                
                if (jsonResponse.has("results") && jsonResponse.get("results").isArray() && jsonResponse.get("results").size() > 0) {
                    JsonNode order = jsonResponse.get("results").get(0);
                    if (order.has("id")) {
                        orderId = order.get("id").asLong();
                        log.info("Order ID extraído: {}", orderId);
                    }
                    if (order.has("buyer") && order.get("buyer").has("id")) {
                        buyerId = order.get("buyer").get("id").asLong();
                        log.info("Buyer ID extraído: {}", buyerId);
                    }
                    if (order.has("pack_id")) {
                        packId = order.get("pack_id").asLong();
                        log.info("Pack ID extraído: {}", packId);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error al obtener IDs desde /orders/search: {}", e.getMessage());
        }
        
        // Intentar TODOS los endpoints posibles con TODOS los IDs disponibles
        List<String> endpoints = new ArrayList<>();
        
        // Endpoints con shipment_id - PROBAR CON Y SIN x-format-new
        // Nota: El header x-format-new se agrega en el loop, pero también probamos variantes
        endpoints.add(String.format("%s/shipments/%s", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s?include=receiver_address", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s?include=destination", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s?include=all", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s?fields=id,receiver_address,destination,status", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s?seller_id=%s", ML_API_BASE, shipmentId, sellerId));
        endpoints.add(String.format("%s/shipments/%s?seller_id=%s&include=receiver_address", ML_API_BASE, shipmentId, sellerId));
        endpoints.add(String.format("%s/shipments/%s?seller_id=%s&include=destination", ML_API_BASE, shipmentId, sellerId));
        endpoints.add(String.format("%s/fulfillment/shipments/%s", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/fulfillment/shipments/%s?seller_id=%s", ML_API_BASE, shipmentId, sellerId));
        endpoints.add(String.format("%s/tracking?shipment_id=%s", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/tracking/shipments/%s", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s/tracking", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s/destination", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipments/%s/receiver_address", ML_API_BASE, shipmentId));
        // Endpoints de MercadoEnvios (diferente base URL)
        endpoints.add(String.format("https://api.mercadolibre.com/mercadolibre/shipments/%s", shipmentId));
        endpoints.add(String.format("https://api.mercadolibre.com/mercadolibre/shipments/%s?include=receiver_address", shipmentId));
        // Endpoint /shipment_labels según documentación (puede contener información de dirección)
        endpoints.add(String.format("%s/shipment_labels?shipment_ids=%s&response_type=pdf", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipment_labels?shipment_ids=%s&response_type=zpl", ML_API_BASE, shipmentId));
        endpoints.add(String.format("%s/shipment_labels?shipment_ids=%s", ML_API_BASE, shipmentId));
        
        // Variantes de /orders/search con diferentes parámetros para obtener más datos
        if (orderId != null) {
            endpoints.add(String.format("%s/orders/search?seller=%s&ids=%s", ML_API_BASE, sellerId, orderId));
            endpoints.add(String.format("%s/orders/search?seller=%s&ids=%s&include=shipping", ML_API_BASE, sellerId, orderId));
            endpoints.add(String.format("%s/orders/search?seller=%s&ids=%s&include=all", ML_API_BASE, sellerId, orderId));
            endpoints.add(String.format("%s/orders/search?seller=%s&order.id=%s", ML_API_BASE, sellerId, orderId));
            endpoints.add(String.format("%s/orders/search?seller=%s&order.id=%s&include=shipping", ML_API_BASE, sellerId, orderId));
        }
        
        // Endpoints con order_id (si lo tenemos)
        if (orderId != null) {
            endpoints.add(String.format("%s/orders/%s", ML_API_BASE, orderId));
            endpoints.add(String.format("%s/orders/%s?include=shipping", ML_API_BASE, orderId));
            endpoints.add(String.format("%s/orders/%s/shipments", ML_API_BASE, orderId));
            endpoints.add(String.format("%s/orders/%s/shipping", ML_API_BASE, orderId));
            endpoints.add(String.format("%s/orders/%s/shipping/receiver_address", ML_API_BASE, orderId));
            endpoints.add(String.format("%s/orders/%s/destination", ML_API_BASE, orderId));
            endpoints.add(String.format("%s/orders/%s/receiver_address", ML_API_BASE, orderId));
        }
        
        // Endpoints con pack_id (si lo tenemos)
        if (packId != null) {
            endpoints.add(String.format("%s/packs/%s", ML_API_BASE, packId));
            endpoints.add(String.format("%s/packs/%s/shipments", ML_API_BASE, packId));
            endpoints.add(String.format("%s/packs/%s/shipping", ML_API_BASE, packId));
        }
        
        // Endpoints con buyer_id (si lo tenemos)
        if (buyerId != null) {
            endpoints.add(String.format("%s/users/%s/addresses", ML_API_BASE, buyerId));
            endpoints.add(String.format("%s/users/%s/addresses?order_id=%s", ML_API_BASE, buyerId, orderId != null ? orderId : ""));
        }
        
        // Intentar todos los endpoints
        log.info("=== INTENTANDO {} ENDPOINTS POSIBLES ===", endpoints.size());
        for (int i = 0; i < endpoints.size(); i++) {
            String endpointUrl = endpoints.get(i);
            log.info("Intentando endpoint {}: {}", i + 1, endpointUrl);
            
            // Probar con y sin x-format-new
            String[] headersToTry = {
                "x-format-new: true",
                "x-format-new: false", 
                null // Sin header
            };
            
            for (String headerValue : headersToTry) {
                try {
                    URL url = new URL(endpointUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    conn.setRequestProperty("Accept", "application/json");
                    if (headerValue != null) {
                        String[] parts = headerValue.split(": ");
                        conn.setRequestProperty(parts[0], parts[1]);
                        log.debug("  Con header {}: {}", parts[0], parts[1]);
                    }
                    
                    int responseCode = conn.getResponseCode();
                    if (responseCode == 401) {
                        accessToken = refrescarTokenSiNecesario(cliente);
                        conn.disconnect();
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("GET");
                        conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                        conn.setRequestProperty("Accept", "application/json");
                        if (headerValue != null) {
                            String[] parts = headerValue.split(": ");
                            conn.setRequestProperty(parts[0], parts[1]);
                        }
                        responseCode = conn.getResponseCode();
                    }
                    
                    if (responseCode == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            response.append(line);
                        }
                        JsonNode data = objectMapper.readTree(response.toString());
                        conn.disconnect();
                        log.info("✓✓✓ ÉXITO en endpoint {}: {} (header: {})", i + 1, endpointUrl, headerValue != null ? headerValue : "ninguno");
                        log.info("Respuesta completa: {}", data.toString());
                        
                        // Si el endpoint es /shipments/{id} y tenemos order_id, agregarlo al JsonNode
                        if (endpointUrl.contains("/shipments/") && !endpointUrl.contains("/orders/") && orderId != null) {
                            if (data.isObject()) {
                                ObjectNode shipmentNode = (ObjectNode) data;
                                if (!shipmentNode.has("order_id")) {
                                    shipmentNode.put("order_id", orderId);
                                    log.info("✓ Order ID {} agregado al shipmentNode", orderId);
                                }
                            }
                        }
                        
                        // Si la respuesta es de /orders/search con ids, intentar obtener la orden completa
                        // porque /orders/search puede devolver datos parciales sin dirección
                        if (endpointUrl.contains("/orders/search") && endpointUrl.contains("ids=")) {
                            log.info("=== RESPUESTA PARCIAL DE /orders/search DETECTADA ===");
                            log.warn("⚠️  /orders/search devolvió datos parciales (solo shipping.id sin dirección)");
                            log.warn("⚠️  Esto indica que faltan permisos en el panel de desarrolladores de MercadoLibre");
                            log.warn("⚠️  Panel: https://developers.mercadolibre.com.ar/apps/{}/edit", cliente.getFlexIdVendedor());
                            log.warn("⚠️  Permisos necesarios:");
                            log.warn("⚠️    - 'Venta y envíos de un producto' -> 'Lectura y escritura'");
                            log.warn("⚠️    - 'Orders' -> 'Orders_v2' y 'Orders Feedback' deben estar activados");
                            
                            if (data.has("results") && data.get("results").isArray() && data.get("results").size() > 0) {
                                // Buscar la orden que contiene el shipmentId
                                JsonNode orderEncontrada = null;
                                for (JsonNode order : data.get("results")) {
                                    if (order.has("shipping")) {
                                        JsonNode shipping = order.get("shipping");
                                        // Verificar si shipping.id coincide
                                        if (shipping.has("id") && shipping.get("id").asText().equals(shipmentId)) {
                                            orderEncontrada = order;
                                            break;
                                        }
                                        // Verificar en shipping.shipments[]
                                        if (shipping.has("shipments") && shipping.get("shipments").isArray()) {
                                            for (JsonNode shipment : shipping.get("shipments")) {
                                                if (shipment.has("id") && shipment.get("id").asText().equals(shipmentId)) {
                                                    orderEncontrada = order;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                if (orderEncontrada == null && data.get("results").size() > 0) {
                                    // Si no encontramos la orden específica, usar la primera
                                    orderEncontrada = data.get("results").get(0);
                                    log.warn("No se encontró la orden específica para shipment {}, usando primera orden", shipmentId);
                                }
                                
                                if (orderEncontrada != null && orderEncontrada.has("id")) {
                                    Long orderIdFromResponse = orderEncontrada.get("id").asLong();
                                    log.info("Order ID encontrado en respuesta: {}, intentando obtener orden completa...", orderIdFromResponse);
                                    
                                    // Primero intentar construir desde la respuesta parcial (puede tener buyer info)
                                    log.info("Intentando extraer información de la respuesta parcial antes de obtener orden completa...");
                                    try {
                                        JsonNode shipmentParcial = construirShipmentDesdeOrden(orderEncontrada, Long.parseLong(shipmentId), cliente, accessToken);
                                        // Verificar si tiene dirección
                                        if (shipmentParcial.has("receiver_address")) {
                                            JsonNode receiverAddr = shipmentParcial.get("receiver_address");
                                            boolean tieneDireccion = false;
                                            if (receiverAddr.has("address_line") && !receiverAddr.get("address_line").asText().isEmpty()) {
                                                tieneDireccion = true;
                                            }
                                            if (receiverAddr.has("zip_code") && !receiverAddr.get("zip_code").asText().isEmpty()) {
                                                tieneDireccion = true;
                                            }
                                            if (tieneDireccion) {
                                                log.info("✓ Información suficiente encontrada en respuesta parcial, usando esta");
                                                return shipmentParcial;
                                            }
                                        }
                                    } catch (Exception e) {
                                        log.warn("Error al construir desde respuesta parcial: {}", e.getMessage());
                                    }
                                    
                                    // Si no tiene dirección, intentar obtener orden completa
                                    try {
                                        JsonNode orderCompleta = obtenerOrdenCompleta(orderIdFromResponse, cliente, accessToken);
                                        if (orderCompleta != null) {
                                            log.info("✓✓✓ Orden completa obtenida desde /orders/{}", orderIdFromResponse);
                                            log.info("Orden completa tiene shipping completo: {}", orderCompleta.has("shipping"));
                                            if (orderCompleta.has("shipping")) {
                                                log.info("Shipping completo: {}", orderCompleta.get("shipping").toString());
                                            }
                                            // Buscar el shipment específico en la orden completa
                                            if (orderCompleta.has("shipping")) {
                                                JsonNode shipping = orderCompleta.get("shipping");
                                                // Si shipping tiene shipments array, buscar el shipmentId
                                                if (shipping.has("shipments") && shipping.get("shipments").isArray()) {
                                                    for (JsonNode shipment : shipping.get("shipments")) {
                                                        if (shipment.has("id") && shipment.get("id").asText().equals(shipmentId)) {
                                                            log.info("✓ Shipment {} encontrado en orden completa, construyendo desde orden completa", shipmentId);
                                                            return construirShipmentDesdeShipmentEnOrden(orderCompleta, shipment);
                                                        }
                                                    }
                                                }
                                                // Si shipping.id coincide directamente
                                                if (shipping.has("id") && shipping.get("id").asText().equals(shipmentId)) {
                                                    log.info("✓ Shipping ID coincide, construyendo desde orden completa");
                                                    return construirShipmentDesdeOrden(orderCompleta, Long.parseLong(shipmentId), cliente, accessToken);
                                                }
                                            }
                                            // Si no encontramos el shipment específico, usar la orden completa de todas formas
                                            log.info("Usando orden completa aunque no encontramos el shipment específico");
                                            return construirShipmentDesdeOrden(orderCompleta, Long.parseLong(shipmentId), cliente, accessToken);
                                        }
                                    } catch (Exception e) {
                                        log.warn("No se pudo obtener orden completa: {}, usando respuesta parcial", e.getMessage());
                                        // Usar respuesta parcial como último recurso
                                        return construirShipmentDesdeOrden(orderEncontrada, Long.parseLong(shipmentId), cliente, accessToken);
                                    }
                                }
                            }
                        }
                        
                        return data;
                    } else {
                        log.debug("Endpoint {} devolvió código: {} (header: {})", i + 1, responseCode, headerValue != null ? headerValue : "ninguno");
                        if (conn.getErrorStream() != null && responseCode != 404) {
                            BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                            StringBuilder errorResponse = new StringBuilder();
                            String line;
                            while ((line = errorReader.readLine()) != null) {
                                errorResponse.append(line);
                            }
                            log.debug("Error response: {}", errorResponse.toString());
                        }
                        conn.disconnect();
                    }
                } catch (Exception e) {
                    log.debug("Error en endpoint {} (header: {}): {}", i + 1, headerValue != null ? headerValue : "ninguno", e.getMessage());
                }
            }
        }
        
        log.warn("Ninguno de los {} endpoints devolvió datos válidos", endpoints.size());
        
        // Intentar endpoint /shipment_labels como alternativa (según documentación)
        // Este endpoint puede devolver la información de dirección en la etiqueta
        try {
            String labelsUrl = String.format("%s/shipment_labels?shipment_ids=%s&response_type=pdf", ML_API_BASE, shipmentId);
            log.info("Intentando endpoint /shipment_labels (PDF): {}", labelsUrl);
            URL url = new URL(labelsUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("x-format-new", "true");
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 401) {
                accessToken = refrescarTokenSiNecesario(cliente);
                conn.disconnect();
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("x-format-new", "true");
                responseCode = conn.getResponseCode();
            }
            
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                JsonNode labelsData = objectMapper.readTree(response.toString());
                conn.disconnect();
                log.info("✓ Datos obtenidos desde /shipment_labels (PDF)");
                log.info("Labels data completo: {}", labelsData.toString());
                // Intentar extraer información de dirección de la respuesta
                return labelsData;
            } else {
                log.debug("/shipment_labels (PDF) devolvió código: {}", responseCode);
                conn.disconnect();
            }
        } catch (Exception e) {
            log.debug("Error al intentar /shipment_labels (PDF): {}", e.getMessage());
        }
        
        // Intentar también con response_type=zpl
        try {
            String labelsUrl = String.format("%s/shipment_labels?shipment_ids=%s&response_type=zpl", ML_API_BASE, shipmentId);
            log.info("Intentando endpoint /shipment_labels (ZPL): {}", labelsUrl);
            URL url = new URL(labelsUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("x-format-new", "true");
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 401) {
                accessToken = refrescarTokenSiNecesario(cliente);
                conn.disconnect();
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("x-format-new", "true");
                responseCode = conn.getResponseCode();
            }
            
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                JsonNode labelsData = objectMapper.readTree(response.toString());
                conn.disconnect();
                log.info("✓ Datos obtenidos desde /shipment_labels (ZPL)");
                log.info("Labels data completo: {}", labelsData.toString());
                return labelsData;
            } else {
                log.debug("/shipment_labels (ZPL) devolvió código: {}", responseCode);
                conn.disconnect();
            }
        } catch (Exception e) {
            log.debug("Error al intentar /shipment_labels (ZPL): {}", e.getMessage());
        }
        
        // Intentar primero el endpoint POST /tracking de MercadoEnvios (según documentación del usuario)
        try {
            String trackingUrl = "https://api.mercadolibre.com/tracking";
            log.info("Intentando endpoint POST /tracking de MercadoEnvios: {}", trackingUrl);
            URL url = new URL(trackingUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            
            // Body con el shipment_id
            String requestBody = String.format("{\"shipment_id\":%s}", shipmentId);
            try (java.io.OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.getBytes("utf-8");
                os.write(input, 0, input.length);
            }
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 401) {
                accessToken = refrescarTokenSiNecesario(cliente);
                conn.disconnect();
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                try (java.io.OutputStream os = conn.getOutputStream()) {
                    byte[] input = requestBody.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                responseCode = conn.getResponseCode();
            }
            
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                JsonNode trackingData = objectMapper.readTree(response.toString());
                conn.disconnect();
                log.info("✓ Datos obtenidos desde POST /tracking");
                log.info("Tracking data completo: {}", trackingData.toString());
                return trackingData;
            } else {
                log.warn("POST /tracking devolvió código: {}", responseCode);
                if (conn.getErrorStream() != null) {
                    BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                    StringBuilder errorResponse = new StringBuilder();
                    String line;
                    while ((line = errorReader.readLine()) != null) {
                        errorResponse.append(line);
                    }
                    log.warn("Error response: {}", errorResponse.toString());
                }
                conn.disconnect();
            }
        } catch (Exception e) {
            log.warn("Error al intentar POST /tracking: {}", e.getMessage());
        }
        
        // Intentar primero con el header x-format-new para /shipments/{id} (según documentación)
        try {
            String shipmentUrl = String.format("%s/shipments/%s", ML_API_BASE, shipmentId);
            log.info("Intentando endpoint con x-format-new: {}", shipmentUrl);
            URL url = new URL(shipmentUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("x-format-new", "true"); // Header según documentación
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 401) {
                accessToken = refrescarTokenSiNecesario(cliente);
                conn.disconnect();
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("x-format-new", "true");
                responseCode = conn.getResponseCode();
            }
            
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                JsonNode shipmentData = objectMapper.readTree(response.toString());
                conn.disconnect();
                log.info("✓ Shipment obtenido con x-format-new desde /shipments/{}", shipmentId);
                log.info("Shipment completo: {}", shipmentData.toString());
                return shipmentData;
            } else {
                log.warn("Endpoint con x-format-new devolvió código: {}", responseCode);
                if (conn.getErrorStream() != null) {
                    BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                    StringBuilder errorResponse = new StringBuilder();
                    String line;
                    while ((line = errorReader.readLine()) != null) {
                        errorResponse.append(line);
                    }
                    log.warn("Error response: {}", errorResponse.toString());
                }
                conn.disconnect();
            }
        } catch (Exception e) {
            log.warn("Error al intentar endpoint con x-format-new: {}", e.getMessage());
        }
        
        // Intentar múltiples endpoints de MercadoLibre API (fallback si los anteriores fallaron)
        // 1. Endpoint directo de shipments
        String[] endpointsFallback = {
            String.format("%s/shipments/%s", ML_API_BASE, shipmentId),
            String.format("%s/shipments/%s?seller_id=%s", ML_API_BASE, shipmentId, sellerId),
            String.format("%s/fulfillment/shipments/%s", ML_API_BASE, shipmentId),
            String.format("%s/fulfillment/shipments/%s?seller_id=%s", ML_API_BASE, shipmentId, sellerId),
            String.format("%s/orders/search?seller=%s&shipping.id=%s", ML_API_BASE, sellerId, shipmentId),
            String.format("%s/orders/search?seller=%s&q=%s", ML_API_BASE, sellerId, shipmentId)
        };
        
        for (int i = 0; i < endpointsFallback.length; i++) {
            String urlStr = endpointsFallback[i];
            log.info("Intentando endpoint {}: {}", i + 1, urlStr);
            
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("Content-Type", "application/json");
                
                int responseCode = conn.getResponseCode();
                
                if (responseCode == 401) {
                    // Token inválido, intentar refrescar
                    log.warn("Token inválido en endpoint {}, intentando refrescar...", i + 1);
                    accessToken = refrescarTokenSiNecesario(cliente);
                    conn.disconnect();
                    
                    // Reintentar la petición
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setRequestProperty("Content-Type", "application/json");
                    responseCode = conn.getResponseCode();
                }
                
                if (responseCode == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    
                    JsonNode shipmentData = objectMapper.readTree(response.toString());
                    conn.disconnect();
                    
                    // Si es una respuesta de orders/search, extraer el shipment
                    if (shipmentData.has("results") && shipmentData.get("results").isArray()) {
                        for (JsonNode order : shipmentData.get("results")) {
                            if (order.has("shipping")) {
                                JsonNode shipping = order.get("shipping");
                                // Buscar el shipment en shipping.id o shipping.shipments[]
                                if (shipping.has("id") && shipmentId.equals(shipping.get("id").asText())) {
                                    log.info("✓ Shipment {} encontrado en orden {} usando endpoint {}", 
                                        shipmentId, order.has("id") ? order.get("id").asLong() : "N/A", i + 1);
                                    return construirShipmentDesdeOrden(order, Long.parseLong(shipmentId), cliente, accessToken);
                                }
                                if (shipping.has("shipments") && shipping.get("shipments").isArray()) {
                                    for (JsonNode shipment : shipping.get("shipments")) {
                                        if (shipment.has("id") && shipmentId.equals(shipment.get("id").asText())) {
                                            log.info("✓ Shipment {} encontrado en orden {} usando endpoint {}", 
                                                shipmentId, order.has("id") ? order.get("id").asLong() : "N/A", i + 1);
                                            return construirShipmentDesdeShipmentEnOrden(order, shipment);
                                        }
                                    }
                                }
                            }
                        }
                        // Si llegamos aquí, no encontramos el shipment en los resultados
                        log.warn("Endpoint {} devolvió órdenes pero no contiene el shipment {}", i + 1, shipmentId);
                        continue;
                    }
                    
                    // Verificar que sea un shipment Flex
                    if (shipmentData.has("logistic_type")) {
                        String logisticType = shipmentData.get("logistic_type").asText();
                        if (!"flex".equalsIgnoreCase(logisticType) && !"fulfillment".equalsIgnoreCase(logisticType)) {
                            log.warn("Endpoint {} devolvió shipment pero no es Flex (tipo: {})", i + 1, logisticType);
                            continue;
                        }
                    }
                    
                    log.info("✓ Shipment {} obtenido exitosamente usando endpoint {}", shipmentId, i + 1);
                    return shipmentData;
                } else if (responseCode == 403) {
                    log.warn("Endpoint {} devolvió 403 (Forbidden) - sin permisos para este endpoint", i + 1);
                    if (conn.getErrorStream() != null) {
                        BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                        StringBuilder errorResponse = new StringBuilder();
                        String line;
                        while ((line = errorReader.readLine()) != null) {
                            errorResponse.append(line);
                        }
                        log.warn("Error response: {}", errorResponse.toString());
                    }
                    conn.disconnect();
                    continue; // Intentar siguiente endpoint
                } else if (responseCode == 404) {
                    log.warn("Endpoint {} devolvió 404 (Not Found)", i + 1);
                    conn.disconnect();
                    continue; // Intentar siguiente endpoint
                } else {
                    log.warn("Endpoint {} devolvió código: {}", i + 1, responseCode);
                    if (conn.getErrorStream() != null) {
                        BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                        StringBuilder errorResponse = new StringBuilder();
                        String line;
                        while ((line = errorReader.readLine()) != null) {
                            errorResponse.append(line);
                        }
                        log.warn("Error response: {}", errorResponse.toString());
                    }
                    conn.disconnect();
                    continue; // Intentar siguiente endpoint
                }
            } catch (Exception e) {
                log.warn("Error al intentar endpoint {}: {}", i + 1, e.getMessage());
                continue; // Intentar siguiente endpoint
            }
        }
        
        // Si todos los endpoints fallaron, intentar buscar en órdenes como último recurso
        log.warn("Todos los endpoints directos fallaron, intentando buscar en órdenes...");
        return buscarShipmentEnOrdenes(shipmentId, cliente, accessToken);
    }
    
    /**
     * Busca un shipment en las órdenes del cliente
     * Usa la misma lógica que obtenerEnviosFlex para asegurar consistencia
     */
    private JsonNode buscarShipmentEnOrdenes(String shipmentId, Cliente cliente, String accessToken) throws Exception {
        String sellerId = cliente.getFlexIdVendedor();
        if (sellerId == null || sellerId.isEmpty()) {
            throw new RuntimeException("El cliente no tiene seller ID configurado");
        }
        
        // Usar la misma URL que obtenerEnviosFlex (que sabemos que funciona)
        // Intentar buscar con diferentes parámetros para encontrar el shipment
        // Primero intentar sin filtros, luego con diferentes estados
        String[] urls = {
            String.format("%s/orders/search?seller=%s", ML_API_BASE, sellerId),
            String.format("%s/orders/search?seller=%s&order.status=paid", ML_API_BASE, sellerId),
            String.format("%s/orders/search?seller=%s&order.status=confirmed", ML_API_BASE, sellerId)
        };
        
        log.info("Buscando shipment {} en órdenes del seller {} (usando misma lógica que obtenerEnviosFlex)", shipmentId, sellerId);
        
        for (int urlIndex = 0; urlIndex < urls.length; urlIndex++) {
            String urlStr = urls[urlIndex];
            log.info("Intentando búsqueda {}: {}", urlIndex + 1, urlStr);
        
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                
                int responseCode = conn.getResponseCode();
                if (responseCode == 401) {
                    // Token inválido, intentar refrescar
                    log.warn("Token inválido, intentando refrescar...");
                    accessToken = refrescarTokenSiNecesario(cliente);
                    conn.disconnect();
                    
                    // Reintentar la petición
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    conn.setRequestProperty("Accept", "application/json");
                    responseCode = conn.getResponseCode();
                }
                
                if (responseCode != 200) {
                    log.warn("Búsqueda {} falló con código: {}", urlIndex + 1, responseCode);
                    if (conn.getErrorStream() != null) {
                        BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                        StringBuilder errorResponse = new StringBuilder();
                        String line;
                        while ((line = errorReader.readLine()) != null) {
                            errorResponse.append(line);
                        }
                        log.warn("Error response: {}", errorResponse.toString());
                    }
                    conn.disconnect();
                    continue; // Intentar siguiente URL
                }
                
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                
                JsonNode jsonResponse = objectMapper.readTree(response.toString());
                conn.disconnect();
                
                int totalOrdenes = jsonResponse.has("results") ? jsonResponse.get("results").size() : 0;
                log.info("Búsqueda {}: {} órdenes encontradas", urlIndex + 1, totalOrdenes);
                
                // Log completo de la respuesta para debugging
                log.info("=== RESPUESTA COMPLETA DE /orders/search ===");
                log.info("JSON completo: {}", jsonResponse.toString());
                
                // Buscar el shipment en las órdenes usando la misma lógica que obtenerEnviosFlex
                if (jsonResponse.has("results") && jsonResponse.get("results").isArray()) {
                    int ordenesRevisadas = 0;
                    for (JsonNode order : jsonResponse.get("results")) {
                        ordenesRevisadas++;
                        
                        // Log completo de cada orden
                        log.info("=== ORDEN {} ===", ordenesRevisadas);
                        log.info("Order completo: {}", order.toString());
                        
                        // Verificar si la orden tiene shipping
                        if (!order.has("shipping")) {
                            log.warn("Orden {} no tiene shipping", ordenesRevisadas);
                            continue;
                        }
                        
                        JsonNode shipping = order.get("shipping");
                        log.info("Shipping de orden {}: {}", ordenesRevisadas, shipping.toString());
                        
                        // Buscar en shipping.id (formato directo) - comparar como String y Long
                        if (shipping.has("id")) {
                            String shippingIdStr = shipping.get("id").asText();
                            if (shipmentId.equals(shippingIdStr)) {
                                log.info("✓ Shipment {} encontrado en orden {} (shipping.id) en búsqueda {}", 
                                    shipmentId, order.has("id") ? order.get("id").asLong() : "N/A", urlIndex + 1);
                                
                                // Si tenemos orderId, intentar obtener la orden completa desde /orders/{order_id}
                                // Esto puede tener más información de dirección
                                if (order.has("id")) {
                                    Long orderId = order.get("id").asLong();
                                    log.info("Intentando obtener orden completa desde /orders/{} para más información", orderId);
                                    try {
                                        JsonNode orderCompleta = obtenerOrdenCompleta(orderId, cliente, accessToken);
                                        if (orderCompleta != null) {
                                            log.info("✓ Orden completa obtenida, usando datos completos");
                                            return construirShipmentDesdeOrden(orderCompleta, Long.parseLong(shipmentId), cliente, accessToken);
                                        }
                                    } catch (Exception e) {
                                        log.warn("No se pudo obtener orden completa: {}, usando orden parcial", e.getMessage());
                                    }
                                }
                                
                                return construirShipmentDesdeOrden(order, Long.parseLong(shipmentId), cliente, accessToken);
                            }
                        }
                        
                        // Buscar en shipping.shipments[] (array de shipments) - esta es la estructura más común
                        if (shipping.has("shipments") && shipping.get("shipments").isArray()) {
                            JsonNode shipments = shipping.get("shipments");
                            for (JsonNode shipment : shipments) {
                                if (shipment.has("id")) {
                                    String shipmentIdStr = shipment.get("id").asText();
                                    if (shipmentId.equals(shipmentIdStr)) {
                                        log.info("✓ Shipment {} encontrado en orden {} (shipping.shipments[]) en búsqueda {}", 
                                            shipmentId, order.has("id") ? order.get("id").asLong() : "N/A", urlIndex + 1);
                                        
                                        // Si tenemos orderId, intentar obtener la orden completa desde /orders/{order_id}
                                        // Esto puede tener más información de dirección
                                        if (order.has("id")) {
                                            Long orderId = order.get("id").asLong();
                                            log.info("Intentando obtener orden completa desde /orders/{} para más información", orderId);
                                            try {
                                                JsonNode orderCompleta = obtenerOrdenCompleta(orderId, cliente, accessToken);
                                                if (orderCompleta != null) {
                                                    log.info("✓ Orden completa obtenida, usando datos completos");
                                                    return construirShipmentDesdeShipmentEnOrden(orderCompleta, shipment);
                                                }
                                            } catch (Exception e) {
                                                log.warn("No se pudo obtener orden completa: {}, usando orden parcial", e.getMessage());
                                            }
                                        }
                                        
                                        // Construir shipment desde el objeto shipment encontrado
                                        return construirShipmentDesdeShipmentEnOrden(order, shipment);
                                    }
                                }
                            }
                        }
                    }
                    
                    log.warn("Búsqueda {}: Shipment {} no encontrado después de revisar {} órdenes de {} totales", 
                        urlIndex + 1, shipmentId, ordenesRevisadas, totalOrdenes);
                } else {
                    log.warn("Búsqueda {}: Respuesta no tiene formato esperado", urlIndex + 1);
                }
            } catch (Exception e) {
                log.warn("Error en búsqueda {}: {}", urlIndex + 1, e.getMessage());
                // Continuar con siguiente búsqueda
            }
        }
        
        // Si llegamos aquí, ninguna búsqueda encontró el shipment
        log.error("✗ Shipment {} no encontrado después de intentar {} búsquedas diferentes", shipmentId, urls.length);
        throw new RuntimeException("Shipment " + shipmentId + " no encontrado en las órdenes del cliente después de múltiples búsquedas");
    }
    
    /**
     * Construye un objeto shipment desde un shipment dentro de una orden
     */
    private JsonNode construirShipmentDesdeShipmentEnOrden(JsonNode order, JsonNode shipment) {
        ObjectNode shipmentNode = objectMapper.createObjectNode();
        
        // Usar el shipment directamente si tiene todos los campos necesarios
        if (shipment.has("id")) {
            shipmentNode.put("id", shipment.get("id").asLong());
        }
        
        if (shipment.has("status")) {
            shipmentNode.put("status", shipment.get("status").asText());
        } else if (order.has("status")) {
            String orderStatus = order.get("status").asText();
            shipmentNode.put("status", mapearEstadoOrdenAShipment(orderStatus));
        } else {
            shipmentNode.put("status", "ready_to_ship");
        }
        
        if (shipment.has("date_created")) {
            shipmentNode.put("date_created", shipment.get("date_created").asText());
        } else if (order.has("date_created")) {
            shipmentNode.put("date_created", order.get("date_created").asText());
        }
        
        shipmentNode.put("logistic_type", "flex");
        
        // Receiver address desde el shipment o desde la orden
        ObjectNode receiverAddress = objectMapper.createObjectNode();
        if (shipment.has("receiver_address")) {
            receiverAddress.setAll((ObjectNode) shipment.get("receiver_address"));
        } else if (order.has("shipping") && order.get("shipping").has("receiver_address")) {
            receiverAddress.setAll((ObjectNode) order.get("shipping").get("receiver_address"));
        } else if (order.has("buyer")) {
            JsonNode buyer = order.get("buyer");
            if (buyer.has("nickname")) {
                receiverAddress.put("receiver_name", buyer.get("nickname").asText());
            }
        } else {
            receiverAddress.put("address_line", "");
            ObjectNode cityNode = objectMapper.createObjectNode();
            cityNode.put("name", "");
            receiverAddress.set("city", cityNode);
            receiverAddress.put("zip_code", "");
        }
        
        shipmentNode.set("receiver_address", receiverAddress);
        
        if (shipment.has("comment")) {
            shipmentNode.put("comment", shipment.get("comment").asText());
        } else if (order.has("comment")) {
            shipmentNode.put("comment", order.get("comment").asText());
        }
        
        return shipmentNode;
    }
    
    /**
     * Construye un objeto shipment desde una orden con TODA la información disponible
     * Si la orden tiene información limitada, intenta obtener más datos desde otros endpoints
     */
    private JsonNode construirShipmentDesdeOrden(JsonNode order, Long shipmentId, Cliente cliente, String accessToken) {
        log.info("Construyendo shipment desde orden completa");
        
        // Log completo de la orden para debugging
        log.info("=== ORDEN COMPLETA DESDE /orders/search ===");
        log.info("Order JSON completo: {}", order.toString());
        log.info("Order tiene 'id': {}", order.has("id"));
        log.info("Order tiene 'shipping': {}", order.has("shipping"));
        log.info("Order tiene 'buyer': {}", order.has("buyer"));
        log.info("Order tiene 'order_items': {}", order.has("order_items"));
        log.info("Order tiene 'total_amount': {}", order.has("total_amount"));
        
        // Si la orden tiene order_id, intentar obtener la orden completa desde /orders/{order_id}
        Long orderId = null;
        if (order.has("id")) {
            orderId = order.get("id").asLong();
            log.info("Order ID encontrado: {}, intentando obtener orden completa desde /orders/{}/shipments", orderId, orderId);
            
            try {
                JsonNode orderCompleta = obtenerOrdenCompleta(orderId, cliente, accessToken);
                if (orderCompleta != null) {
                    log.info("✓ Orden completa obtenida, usando datos completos");
                    log.info("Order completa JSON: {}", orderCompleta.toString());
                    order = orderCompleta;
                }
            } catch (Exception e) {
                log.warn("No se pudo obtener orden completa: {}", e.getMessage());
            }
        }
        
        ObjectNode shipmentNode = objectMapper.createObjectNode();
        shipmentNode.put("id", shipmentId);
        
        // Estado del shipment
        if (order.has("status")) {
            String orderStatus = order.get("status").asText();
            shipmentNode.put("status", mapearEstadoOrdenAShipment(orderStatus));
        } else {
            shipmentNode.put("status", "ready_to_ship");
        }
        
        // Fecha de creación
        if (order.has("date_created")) {
            shipmentNode.put("date_created", order.get("date_created").asText());
        }
        
        shipmentNode.put("logistic_type", "flex");
        
        // Construir receiver_address con TODA la información disponible
        ObjectNode receiverAddress = objectMapper.createObjectNode();
        JsonNode shipping = order.has("shipping") ? order.get("shipping") : null;
        
        // Log completo de shipping para debugging
        if (shipping != null) {
            log.info("=== SHIPPING INFO ===");
            log.info("Shipping completo: {}", shipping.toString());
            if (shipping.has("receiver_address")) {
                log.info("Shipping.receiver_address existe: {}", shipping.get("receiver_address").toString());
            } else {
                log.warn("Shipping NO tiene receiver_address");
            }
            if (shipping.has("receiver_name")) {
                log.info("Shipping.receiver_name: {}", shipping.get("receiver_name").asText());
            }
            if (shipping.has("receiver_phone")) {
                log.info("Shipping.receiver_phone: {}", shipping.get("receiver_phone").asText());
            }
        }
        
        // Buscar dirección en payments (puede estar ahí según algunos casos)
        if (order.has("payments") && order.get("payments").isArray()) {
            log.info("=== BUSCANDO EN PAYMENTS ===");
            for (JsonNode payment : order.get("payments")) {
                log.info("Payment: {}", payment.toString());
                // Los payments pueden tener información de shipping
            }
        }
        
        // Buscar en todos los campos posibles de la orden
        log.info("=== BUSCANDO DIRECCIÓN EN TODOS LOS CAMPOS ===");
        final JsonNode orderFinal = order; // Hacer final para usar en lambda
        orderFinal.fieldNames().forEachRemaining(key -> {
            if (key.toLowerCase().contains("address") || key.toLowerCase().contains("destination") || 
                key.toLowerCase().contains("receiver") || key.toLowerCase().contains("shipping")) {
                log.info("Campo relacionado con dirección encontrado: {} = {}", key, orderFinal.get(key).toString());
            }
        });
        
        // Buscar específicamente en destination.shipping_address (según documentación)
        if (order.has("destination")) {
            JsonNode destination = order.get("destination");
            log.info("=== DESTINATION INFO ===");
            log.info("Destination completo: {}", destination.toString());
            if (destination.has("shipping_address")) {
                JsonNode shippingAddress = destination.get("shipping_address");
                log.info("✓ destination.shipping_address encontrado: {}", shippingAddress.toString());
                // Copiar todos los campos de shipping_address a receiver_address
                if (shippingAddress.has("address_line")) {
                    receiverAddress.put("address_line", shippingAddress.get("address_line").asText());
                }
                if (shippingAddress.has("street_name")) {
                    receiverAddress.put("street_name", shippingAddress.get("street_name").asText());
                }
                if (shippingAddress.has("street_number")) {
                    receiverAddress.put("street_number", shippingAddress.get("street_number").asText());
                }
                if (shippingAddress.has("zip_code")) {
                    receiverAddress.put("zip_code", shippingAddress.get("zip_code").asText());
                }
                if (shippingAddress.has("city")) {
                    receiverAddress.set("city", shippingAddress.get("city"));
                }
                if (shippingAddress.has("state")) {
                    receiverAddress.set("state", shippingAddress.get("state"));
                }
                if (shippingAddress.has("receiver_name")) {
                    receiverAddress.put("receiver_name", shippingAddress.get("receiver_name").asText());
                }
                if (shippingAddress.has("receiver_phone")) {
                    receiverAddress.put("receiver_phone", shippingAddress.get("receiver_phone").asText());
                }
                log.info("✓ Dirección copiada desde destination.shipping_address");
            }
        }
        
        // Prioridad 1: receiver_address de shipping (si tiene datos)
        if (shipping != null && shipping.has("receiver_address")) {
            JsonNode shippingReceiverAddress = shipping.get("receiver_address");
            // Verificar si tiene datos reales antes de copiar
            boolean hasData = false;
            if (shippingReceiverAddress.has("address_line") && !shippingReceiverAddress.get("address_line").asText().isEmpty()) {
                hasData = true;
            }
            if (shippingReceiverAddress.has("zip_code") && !shippingReceiverAddress.get("zip_code").asText().isEmpty()) {
                hasData = true;
            }
            if (shippingReceiverAddress.has("city") && shippingReceiverAddress.get("city").has("name") && 
                !shippingReceiverAddress.get("city").get("name").asText().isEmpty()) {
                hasData = true;
            }
            
            if (hasData) {
                receiverAddress.setAll((ObjectNode) shippingReceiverAddress);
                log.info("Receiver address copiado desde shipping.receiver_address (tiene datos)");
            } else {
                log.warn("Shipping.receiver_address existe pero está vacío, buscando en otros lugares");
            }
        }
        
        // Prioridad 2: Información del buyer (nombre completo)
        if (order.has("buyer")) {
            JsonNode buyer = order.get("buyer");
            log.info("=== BUYER INFO ===");
            log.info("Buyer completo: {}", buyer.toString());
            
            // Si el buyer solo tiene nickname, intentar obtener información completa desde /users/{user_id}
            if (buyer.has("id") && (!buyer.has("first_name") || buyer.get("first_name").asText().isEmpty())) {
                Long buyerId = buyer.get("id").asLong();
                log.info("Buyer solo tiene nickname, intentando obtener información completa desde /users/{}", buyerId);
                try {
                    JsonNode buyerInfo = obtenerInformacionComprador(buyerId, accessToken);
                    if (buyerInfo != null && buyerInfo.has("first_name")) {
                        // Usar información del buyer completo si está disponible
                        buyer = buyerInfo; // Reemplazar buyer con información completa
                        log.info("✓ Información completa del buyer obtenida");
                    }
                } catch (Exception e) {
                    log.warn("No se pudo obtener información completa del buyer: {}", e.getMessage());
                }
            }
            
            // Construir nombre completo
            StringBuilder fullName = new StringBuilder();
            if (buyer.has("first_name") && !buyer.get("first_name").asText().isEmpty()) {
                fullName.append(buyer.get("first_name").asText());
            }
            if (buyer.has("last_name") && !buyer.get("last_name").asText().isEmpty()) {
                if (fullName.length() > 0) fullName.append(" ");
                fullName.append(buyer.get("last_name").asText());
            }
            if (fullName.length() > 0) {
                receiverAddress.put("receiver_name", fullName.toString());
                log.info("Nombre completo desde buyer: {}", fullName.toString());
            } else if (buyer.has("nickname") && !buyer.get("nickname").asText().isEmpty()) {
                receiverAddress.put("receiver_name", buyer.get("nickname").asText());
                log.info("Nombre desde buyer.nickname: {}", buyer.get("nickname").asText());
            }
        }
        
        // Si shipping existe, completar información faltante desde múltiples fuentes
        if (shipping != null) {
            // Nombre del destinatario desde shipping.receiver_name
            if (!receiverAddress.has("receiver_name") || receiverAddress.get("receiver_name").asText().isEmpty()) {
                if (shipping.has("receiver_name") && !shipping.get("receiver_name").asText().isEmpty()) {
                    receiverAddress.put("receiver_name", shipping.get("receiver_name").asText());
                    log.info("Nombre desde shipping.receiver_name: {}", shipping.get("receiver_name").asText());
                }
            }
            
            // Teléfono desde múltiples lugares
            if (!receiverAddress.has("receiver_phone") || receiverAddress.get("receiver_phone").asText().isEmpty()) {
                if (shipping.has("receiver_phone") && !shipping.get("receiver_phone").asText().isEmpty()) {
                    receiverAddress.put("receiver_phone", shipping.get("receiver_phone").asText());
                    log.info("Teléfono desde shipping.receiver_phone: {}", shipping.get("receiver_phone").asText());
                } else if (shipping.has("receiver_address") && shipping.get("receiver_address").has("receiver_phone")) {
                    String phone = shipping.get("receiver_address").get("receiver_phone").asText();
                    if (!phone.isEmpty()) {
                        receiverAddress.put("receiver_phone", phone);
                        log.info("Teléfono desde shipping.receiver_address.receiver_phone: {}", phone);
                    }
                }
            }
            
            // Dirección completa - buscar en múltiples lugares
            if (!receiverAddress.has("address_line") || receiverAddress.get("address_line").asText().isEmpty()) {
                StringBuilder addressLine = new StringBuilder();
                
                // 1. Desde shipping.receiver_address
                if (shipping.has("receiver_address")) {
                    JsonNode addr = shipping.get("receiver_address");
                    if (addr.has("address_line") && !addr.get("address_line").asText().isEmpty()) {
                        addressLine.append(addr.get("address_line").asText());
                    }
                    if (addr.has("street_name") && !addr.get("street_name").asText().isEmpty()) {
                        if (addressLine.length() > 0) addressLine.append(" ");
                        addressLine.append(addr.get("street_name").asText());
                    }
                    if (addr.has("street_number") && !addr.get("street_number").asText().isEmpty()) {
                        if (addressLine.length() > 0) addressLine.append(" ");
                        addressLine.append(addr.get("street_number").asText());
                    }
                }
                
                // 2. Si aún está vacío, buscar en shipping directamente
                if (addressLine.length() == 0) {
                    if (shipping.has("address_line") && !shipping.get("address_line").asText().isEmpty()) {
                        addressLine.append(shipping.get("address_line").asText());
                    }
                }
                
                if (addressLine.length() > 0) {
                    receiverAddress.put("address_line", addressLine.toString());
                    log.info("Dirección construida: {}", addressLine.toString());
                }
            }
            
            // Código postal
            if (!receiverAddress.has("zip_code") || receiverAddress.get("zip_code").asText().isEmpty()) {
                if (shipping.has("receiver_address") && shipping.get("receiver_address").has("zip_code")) {
                    String zip = shipping.get("receiver_address").get("zip_code").asText();
                    if (!zip.isEmpty()) {
                        receiverAddress.put("zip_code", zip);
                        log.info("CP desde shipping.receiver_address.zip_code: {}", zip);
                    }
                }
            }
            
            // Ciudad
            if (!receiverAddress.has("city") || !receiverAddress.get("city").has("name") || 
                receiverAddress.get("city").get("name").asText().isEmpty()) {
                if (shipping.has("receiver_address") && shipping.get("receiver_address").has("city")) {
                    JsonNode city = shipping.get("receiver_address").get("city");
                    ObjectNode cityNode = objectMapper.createObjectNode();
                    if (city.has("name") && !city.get("name").asText().isEmpty()) {
                        cityNode.put("name", city.get("name").asText());
                        receiverAddress.set("city", cityNode);
                        log.info("Ciudad desde shipping.receiver_address.city: {}", city.get("name").asText());
                    }
                }
            }
        }
        
        // Valores por defecto si falta información
        if (!receiverAddress.has("address_line") || receiverAddress.get("address_line").asText().isEmpty()) {
            receiverAddress.put("address_line", "");
        }
        if (!receiverAddress.has("city")) {
            ObjectNode cityNode = objectMapper.createObjectNode();
            cityNode.put("name", "");
            receiverAddress.set("city", cityNode);
        }
        if (!receiverAddress.has("zip_code")) {
            receiverAddress.put("zip_code", "");
        }
        if (!receiverAddress.has("receiver_name")) {
            receiverAddress.put("receiver_name", "");
        }
        if (!receiverAddress.has("receiver_phone")) {
            receiverAddress.put("receiver_phone", "");
        }
        
        shipmentNode.set("receiver_address", receiverAddress);
        
        // Observaciones/comentarios
        if (order.has("comment")) {
            shipmentNode.put("comment", order.get("comment").asText());
        }
        
        // Información adicional de la orden que puede ser útil
        // ID de la orden (IDML)
        if (order.has("id")) {
            shipmentNode.put("order_id", order.get("id").asLong());
            log.debug("Order ID encontrado: {}", order.get("id").asLong());
        }
        
        // Valor total (puede estar en diferentes lugares)
        if (order.has("total_amount")) {
            shipmentNode.put("total_amount", order.get("total_amount").asDouble());
            log.debug("Total amount desde order.total_amount: {}", order.get("total_amount").asDouble());
        } else if (order.has("order_items") && order.get("order_items").isArray() && order.get("order_items").size() > 0) {
            // Intentar calcular desde order_items
            double total = 0.0;
            for (JsonNode item : order.get("order_items")) {
                if (item.has("unit_price")) {
                    double price = item.get("unit_price").asDouble();
                    int quantity = item.has("quantity") ? item.get("quantity").asInt() : 1;
                    total += price * quantity;
                }
            }
            if (total > 0) {
                shipmentNode.put("total_amount", total);
                log.debug("Total amount calculado desde order_items: {}", total);
            }
        }
        
        // Costo de envío (puede estar en múltiples lugares)
        if (shipping != null) {
            log.info("=== BUSCANDO COSTO DE ENVÍO ===");
            log.info("Shipping tiene 'cost': {}", shipping.has("cost"));
            log.info("Shipping tiene 'shipping_cost': {}", shipping.has("shipping_cost"));
            log.info("Shipping tiene 'costs': {}", shipping.has("costs"));
            
            if (shipping.has("cost") && shipping.get("cost").asDouble() > 0) {
                shipmentNode.put("shipping_cost", shipping.get("cost").asDouble());
                log.info("Shipping cost desde shipping.cost: {}", shipping.get("cost").asDouble());
            } else if (shipping.has("shipping_cost") && shipping.get("shipping_cost").asDouble() > 0) {
                shipmentNode.put("shipping_cost", shipping.get("shipping_cost").asDouble());
                log.info("Shipping cost desde shipping.shipping_cost: {}", shipping.get("shipping_cost").asDouble());
            } else if (order.has("shipping_cost") && order.get("shipping_cost").asDouble() > 0) {
                shipmentNode.put("shipping_cost", order.get("shipping_cost").asDouble());
                log.info("Shipping cost desde order.shipping_cost: {}", order.get("shipping_cost").asDouble());
            } else if (shipping.has("costs") && shipping.get("costs").isArray() && shipping.get("costs").size() > 0) {
                // Puede ser un array de costos
                double totalCost = 0.0;
                for (JsonNode cost : shipping.get("costs")) {
                    if (cost.has("cost")) {
                        totalCost += cost.get("cost").asDouble();
                    }
                }
                if (totalCost > 0) {
                    shipmentNode.put("shipping_cost", totalCost);
                    log.info("Shipping cost calculado desde shipping.costs[]: {}", totalCost);
                }
            } else {
                log.warn("No se encontró costo de envío en ningún lugar");
            }
            
            // Método de envío
            if (shipping.has("method")) {
                shipmentNode.put("shipping_method", shipping.get("method").asText());
                log.debug("Shipping method: {}", shipping.get("method").asText());
            } else if (shipping.has("shipping_method")) {
                shipmentNode.put("shipping_method", shipping.get("shipping_method").asText());
                log.debug("Shipping method desde shipping.shipping_method: {}", shipping.get("shipping_method").asText());
            }
        }
        
        // Peso y dimensiones (si están disponibles)
        if (order.has("order_items") && order.get("order_items").isArray() && order.get("order_items").size() > 0) {
            double totalWeight = 0.0;
            int totalQuantity = 0;
            for (JsonNode item : order.get("order_items")) {
                if (item.has("quantity")) {
                    totalQuantity += item.get("quantity").asInt();
                }
                // El peso puede estar en diferentes lugares según la API
                if (item.has("weight")) {
                    totalWeight += item.get("weight").asDouble();
                }
            }
            if (totalWeight > 0) {
                shipmentNode.put("weight", totalWeight);
                log.debug("Peso total calculado: {}", totalWeight);
            }
            if (totalQuantity > 0) {
                shipmentNode.put("quantity", totalQuantity);
                log.debug("Cantidad total de bultos: {}", totalQuantity);
            }
        }
        
        log.info("Shipment construido con información completa. Order ID: {}, Total: {}, Shipping Cost: {}", 
            shipmentNode.has("order_id") ? shipmentNode.get("order_id").asLong() : "N/A",
            shipmentNode.has("total_amount") ? shipmentNode.get("total_amount").asDouble() : "N/A",
            shipmentNode.has("shipping_cost") ? shipmentNode.get("shipping_cost").asDouble() : "N/A");
        log.debug("Shipment completo: {}", shipmentNode.toString());
        return shipmentNode;
    }
    
    /**
     * Obtiene la orden completa desde /orders/{order_id}
     * Esto puede tener más información que la versión limitada de /orders/search
     */
    private JsonNode obtenerOrdenCompleta(Long orderId, Cliente cliente, String accessToken) throws Exception {
        // Intentar primero /orders/{order_id}/shipments según documentación
        String shipmentsUrl = String.format("%s/orders/%s/shipments", ML_API_BASE, orderId);
        log.info("Intentando obtener shipments desde /orders/{}/shipments: {}", orderId, shipmentsUrl);
        
        try {
            URL url = new URL(shipmentsUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 401) {
                accessToken = refrescarTokenSiNecesario(cliente);
                conn.disconnect();
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                conn.setRequestProperty("Accept", "application/json");
                responseCode = conn.getResponseCode();
            }
            
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                
                JsonNode shipmentsData = objectMapper.readTree(response.toString());
                conn.disconnect();
                log.info("✓ Shipments obtenidos desde /orders/{}/shipments", orderId);
                log.info("Shipments data: {}", shipmentsData.toString());
                
                // Si es un array, devolver el primero (o buscar el que coincida con nuestro shipmentId)
                if (shipmentsData.isArray() && shipmentsData.size() > 0) {
                    return shipmentsData.get(0); // Devolver el primer shipment
                } else if (shipmentsData.has("shipments") && shipmentsData.get("shipments").isArray()) {
                    JsonNode shipmentsArray = shipmentsData.get("shipments");
                    if (shipmentsArray.size() > 0) {
                        return shipmentsArray.get(0);
                    }
                }
            } else {
                log.warn("No se pudo obtener shipments desde /orders/{}/shipments: código {}", orderId, responseCode);
                if (conn.getErrorStream() != null) {
                    BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                    StringBuilder errorResponse = new StringBuilder();
                    String line;
                    while ((line = errorReader.readLine()) != null) {
                        errorResponse.append(line);
                    }
                    log.warn("Error response: {}", errorResponse.toString());
                }
                conn.disconnect();
            }
        } catch (Exception e) {
            log.warn("Error al obtener shipments desde /orders/{}/shipments: {}", orderId, e.getMessage());
        }
        
        // Si falla, intentar /orders/{order_id} directamente con diferentes variantes
        String[] urlVariants = {
            String.format("%s/orders/%s", ML_API_BASE, orderId),
            String.format("%s/orders/%s?include=shipping", ML_API_BASE, orderId),
            String.format("%s/orders/%s?include=all", ML_API_BASE, orderId),
            String.format("%s/orders/%s?include=receiver_address", ML_API_BASE, orderId),
            String.format("%s/orders/%s?include=destination", ML_API_BASE, orderId)
        };
        
        String[] headersToTry = {
            null,
            "x-format-new: true"
        };
        
        for (String urlStr : urlVariants) {
            for (String headerValue : headersToTry) {
                log.info("Intentando obtener orden completa {} desde {} (header: {})", orderId, urlStr, headerValue != null ? headerValue : "ninguno");
                
                try {
                    URL url = new URL(urlStr);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    conn.setRequestProperty("Accept", "application/json");
                    if (headerValue != null) {
                        String[] parts = headerValue.split(": ");
                        conn.setRequestProperty(parts[0], parts[1]);
                    }
                    
                    int responseCode = conn.getResponseCode();
                    if (responseCode == 401) {
                        // Token inválido, intentar refrescar
                        log.warn("Token inválido, intentando refrescar...");
                        accessToken = refrescarTokenSiNecesario(cliente);
                        conn.disconnect();
                        
                        // Reintentar
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("GET");
                        conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                        conn.setRequestProperty("Accept", "application/json");
                        if (headerValue != null) {
                            String[] parts = headerValue.split(": ");
                            conn.setRequestProperty(parts[0], parts[1]);
                        }
                        responseCode = conn.getResponseCode();
                    }
                    
                    if (responseCode == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            response.append(line);
                        }
                        
                        JsonNode orderCompleta = objectMapper.readTree(response.toString());
                        conn.disconnect();
                        log.info("✓✓✓ Orden completa obtenida desde {} (header: {})", urlStr, headerValue != null ? headerValue : "ninguno");
                        log.info("Orden completa tiene shipping: {}", orderCompleta.has("shipping"));
                        if (orderCompleta.has("shipping")) {
                            log.info("Shipping completo: {}", orderCompleta.get("shipping").toString());
                            // Verificar si tiene receiver_address o destination
                            JsonNode shipping = orderCompleta.get("shipping");
                            if (shipping.has("receiver_address")) {
                                log.info("✓✓✓ Shipping tiene receiver_address: {}", shipping.get("receiver_address").toString());
                            }
                            if (shipping.has("destination")) {
                                log.info("✓✓✓ Shipping tiene destination: {}", shipping.get("destination").toString());
                            }
                        }
                        if (orderCompleta.has("destination")) {
                            log.info("✓✓✓ Orden tiene destination: {}", orderCompleta.get("destination").toString());
                        }
                        return orderCompleta;
                    } else {
                        log.debug("No se pudo obtener orden completa desde {}: código {} (header: {})", urlStr, responseCode, headerValue != null ? headerValue : "ninguno");
                        if (conn.getErrorStream() != null && responseCode != 404) {
                            BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                            StringBuilder errorResponse = new StringBuilder();
                            String line;
                            while ((line = errorReader.readLine()) != null) {
                                errorResponse.append(line);
                            }
                            log.debug("Error response: {}", errorResponse.toString());
                        }
                        conn.disconnect();
                    }
                } catch (Exception e) {
                    log.debug("Error al obtener orden completa desde {}: {}", urlStr, e.getMessage());
                }
            }
        }
        
        log.warn("No se pudo obtener orden completa desde ningún endpoint para orderId {}", orderId);
        return null;
    }
    
    /**
     * Obtiene información del comprador desde /users/{user_id}
     * Esto puede tener nombre completo, dirección, etc.
     */
    private JsonNode obtenerInformacionComprador(Long buyerId, String accessToken) throws Exception {
        String urlStr = String.format("%s/users/%s", ML_API_BASE, buyerId);
        log.info("Obteniendo información del comprador {} desde {}", buyerId, urlStr);
        
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                
                JsonNode buyerInfo = objectMapper.readTree(response.toString());
                conn.disconnect();
                log.info("✓ Información del comprador obtenida: {}", buyerInfo.toString());
                return buyerInfo;
            } else {
                log.warn("No se pudo obtener información del comprador: código {}", responseCode);
                conn.disconnect();
            }
        } catch (Exception e) {
            log.warn("Error al obtener información del comprador: {}", e.getMessage());
        }
        
        return null;
    }
    
    /**
     * Extrae el ID del shipment de MercadoLibre desde diferentes formatos de QR
     * @param qrData Datos del QR (puede ser "FLEX_123456", "123456", o un link)
     * @return ID del shipment (solo números)
     */
    public String extraerShipmentIdDelQR(String qrData) {
        if (qrData == null || qrData.trim().isEmpty()) {
            throw new RuntimeException("QR data vacío");
        }
        
        String qrClean = qrData.trim();
        log.debug("Extrayendo shipment ID del QR: {}", qrClean);
        
        // Formato 0: JSON con "id" y "sender_id" (formato de QR de MercadoLibre Flex)
        try {
            JsonNode qrJson = objectMapper.readTree(qrClean);
            if (qrJson.has("id")) {
                String id = qrJson.get("id").asText();
                log.debug("QR formato JSON, ID extraído: {}", id);
                return id;
            }
        } catch (Exception e) {
            // No es JSON, continuar con otros formatos
            log.debug("QR no es JSON válido, intentando otros formatos");
        }
        
        // Formato 1: "FLEX_123456"
        if (qrClean.startsWith("FLEX_")) {
            String id = qrClean.substring(5);
            log.debug("QR formato FLEX_, ID extraído: {}", id);
            return id;
        }
        
        // Formato 2: Link de MercadoLibre (buscar shipment_id o similar)
        if (qrClean.contains("shipment") || qrClean.contains("shipments")) {
            // Intentar extraer ID de un link
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(?:shipment[s]?[/=]|id=)(\\d+)");
            java.util.regex.Matcher matcher = pattern.matcher(qrClean);
            if (matcher.find()) {
                String id = matcher.group(1);
                log.debug("QR formato link, ID extraído: {}", id);
                return id;
            }
        }
        
        // Formato 3: Solo números (ID directo)
        if (qrClean.matches("\\d+")) {
            log.debug("QR formato numérico directo, ID: {}", qrClean);
            return qrClean;
        }
        
        // Formato 4: URL completa de MercadoLibre (ej: https://www.mercadolibre.com.ar/...)
        // Intentar extraer cualquier número largo que pueda ser un ID
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\b(\\d{8,})\\b");
        java.util.regex.Matcher matcher = pattern.matcher(qrClean);
        if (matcher.find()) {
            String id = matcher.group(1);
            log.debug("QR formato URL, ID extraído: {}", id);
            return id;
        }
        
        log.warn("No se pudo extraer el ID del shipment del QR: {}", qrClean);
        throw new RuntimeException("No se pudo extraer el ID del shipment del QR: " + qrClean);
    }
    
    /**
     * Extrae el sender_id del QR (si está disponible)
     * @param qrData Datos del QR
     * @return sender_id o null si no está disponible
     */
    public String extraerSenderIdDelQR(String qrData) {
        if (qrData == null || qrData.trim().isEmpty()) {
            return null;
        }
        
        String qrClean = qrData.trim();
        try {
            JsonNode qrJson = objectMapper.readTree(qrClean);
            if (qrJson.has("sender_id")) {
                String senderId = qrJson.get("sender_id").asText();
                log.debug("Sender ID extraído del QR: {}", senderId);
                return senderId;
            }
        } catch (Exception e) {
            // No es JSON o no tiene sender_id
            log.debug("QR no contiene sender_id o no es JSON válido");
        }
        
        return null;
    }
    
    /**
     * Crea un objeto shipment desde los datos del QR cuando no se puede obtener desde la API
     * Esto es necesario porque algunos shipments pueden no estar disponibles en /orders/search
     * pero el QR contiene la información suficiente para crear el shipment
     */
    public JsonNode crearShipmentDesdeQR(String qrData, String shipmentId, Cliente cliente) {
        log.info("Creando shipment {} desde datos del QR para cliente {}", shipmentId, cliente.getId());
        
        ObjectNode shipmentNode = objectMapper.createObjectNode();
        
        // ID del shipment
        shipmentNode.put("id", Long.parseLong(shipmentId));
        
        // Estado por defecto: "ready_to_ship" (A retirar)
        shipmentNode.put("status", "ready_to_ship");
        
        // Fecha de creación: ahora
        shipmentNode.put("date_created", java.time.ZonedDateTime.now().toString());
        
        // Tipo logístico: Flex
        shipmentNode.put("logistic_type", "flex");
        
        // Receiver address: vacío por ahora (se completará cuando se obtenga más información)
        ObjectNode receiverAddress = objectMapper.createObjectNode();
        receiverAddress.put("address_line", "");
        receiverAddress.put("zip_code", "");
        ObjectNode cityNode = objectMapper.createObjectNode();
        cityNode.put("name", "");
        receiverAddress.set("city", cityNode);
        receiverAddress.put("receiver_name", "");
        receiverAddress.put("receiver_phone", "");
        shipmentNode.set("receiver_address", receiverAddress);
        
        // QR Data completo
        shipmentNode.put("qr_data", qrData);
        
        log.info("Shipment creado desde QR: ID={}, Status=ready_to_ship, LogisticType=flex", shipmentId);
        
        return shipmentNode;
    }
    
    /**
     * Mapea el estado de una orden a un estado de shipment
     */
    private String mapearEstadoOrdenAShipment(String orderStatus) {
        // Mapeo de estados de orden a estados de shipment
        switch (orderStatus.toLowerCase()) {
            case "paid":
            case "confirmed":
                return "ready_to_ship";
            case "shipped":
                return "in_transit";
            case "delivered":
                return "delivered";
            case "cancelled":
                return "cancelled";
            default:
                return "ready_to_ship";
        }
    }
}

