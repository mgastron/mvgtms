package com.zetallegue.tms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.repository.ClienteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TiendaNubeService {

    private final ClienteRepository clienteRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // Base URL de la API de Tienda Nube
    private static final String TIENDANUBE_API_BASE = "https://api.tiendanube.com/v1";
    
    /**
     * Obtiene los pedidos de Tienda Nube para un cliente específico
     * @param clienteId ID del cliente
     * @return Lista de pedidos en formato JSON
     */
    @Transactional(readOnly = true)
    public List<JsonNode> obtenerPedidosTiendaNube(Long clienteId) throws Exception {
        Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getTiendanubeAccessToken() == null || cliente.getTiendanubeAccessToken().isEmpty()) {
            throw new RuntimeException("El cliente no tiene token de acceso de Tienda Nube");
        }
        
        String storeId = cliente.getTiendanubeStoreId();
        if (storeId == null || storeId.isEmpty()) {
            throw new RuntimeException("El cliente no tiene Store ID configurado");
        }
        
        log.info("Obteniendo pedidos de Tienda Nube para cliente {} (store: {})", clienteId, storeId);
        
        // Endpoint para obtener pedidos según documentación: GET /v1/{store_id}/orders
        String urlStr = String.format(
            "%s/%s/orders",
            TIENDANUBE_API_BASE,
            storeId
        );
        
        log.info("Consultando endpoint: {}", urlStr);
        
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        // Tienda Nube usa "Authentication" no "Authorization" según su documentación
        conn.setRequestProperty("Authentication", "bearer " + cliente.getTiendanubeAccessToken());
        conn.setRequestProperty("User-Agent", "TMS-Llegue (contacto@zetallegue.com)");
        conn.setRequestProperty("Accept", "application/json");
        
        int responseCode = conn.getResponseCode();
        
        if (responseCode != 200) {
            // Leer mensaje de error
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
            StringBuilder errorResponse = new StringBuilder();
            String line;
            while ((line = errorReader.readLine()) != null) {
                errorResponse.append(line);
            }
            errorReader.close();
            
            log.error("Error al obtener pedidos de Tienda Nube: {} - {}", responseCode, errorResponse.toString());
            throw new RuntimeException("Error al obtener pedidos de Tienda Nube: " + responseCode + " - " + errorResponse.toString());
        }
        
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            response.append(line);
        }
        reader.close();
        conn.disconnect();
        
        String responseBody = response.toString();
        log.info("Respuesta de Tienda Nube API (primeros 1000 caracteres): {}", 
            responseBody.length() > 1000 ? responseBody.substring(0, 1000) + "..." : responseBody);
        
        // Log completo del primer pedido para debug
        JsonNode jsonResponseTemp = objectMapper.readTree(responseBody);
        if (jsonResponseTemp.isArray() && jsonResponseTemp.size() > 0) {
            log.info("Estructura completa del primer pedido: {}", jsonResponseTemp.get(0).toString());
        }
        
        JsonNode jsonResponse = objectMapper.readTree(responseBody);
        
        log.info("Estructura de la respuesta JSON: {}", jsonResponse.getNodeType());
        if (jsonResponse.isObject()) {
            java.util.Iterator<String> fieldNames = jsonResponse.fieldNames();
            java.util.ArrayList<String> fieldList = new java.util.ArrayList<>();
            while (fieldNames.hasNext()) {
                fieldList.add(fieldNames.next());
            }
            log.info("Campos en la respuesta: {}", fieldList.isEmpty() ? "ninguno" : String.join(", ", fieldList));
        }
        
        // Procesar respuesta - puede ser un array directamente o un objeto con un array
        List<JsonNode> pedidos = new ArrayList<>();
        
        if (jsonResponse.isArray()) {
            // Si la respuesta es directamente un array de pedidos
            log.info("La respuesta es un array directo con {} elementos", jsonResponse.size());
            for (JsonNode pedido : jsonResponse) {
                pedidos.add(pedido);
            }
        } else if (jsonResponse.has("orders")) {
            // Si la respuesta tiene un campo "orders"
            log.info("La respuesta tiene campo 'orders'");
            JsonNode ordersArray = jsonResponse.get("orders");
            if (ordersArray.isArray()) {
                log.info("El campo 'orders' es un array con {} elementos", ordersArray.size());
                for (JsonNode pedido : ordersArray) {
                    pedidos.add(pedido);
                }
            }
        } else if (jsonResponse.has("results")) {
            // Si la respuesta tiene un campo "results"
            log.info("La respuesta tiene campo 'results'");
            JsonNode resultsArray = jsonResponse.get("results");
            if (resultsArray.isArray()) {
                log.info("El campo 'results' es un array con {} elementos", resultsArray.size());
                for (JsonNode pedido : resultsArray) {
                    pedidos.add(pedido);
                }
            }
        } else {
            log.warn("La respuesta no tiene estructura reconocida. Tipo: {}, Contenido: {}", 
                jsonResponse.getNodeType(), 
                responseBody.length() > 200 ? responseBody.substring(0, 200) + "..." : responseBody);
        }
        
        log.info("Se obtuvieron {} pedidos de Tienda Nube para cliente {}", pedidos.size(), clienteId);
        
        return pedidos;
    }
    
    /**
     * Obtiene todos los pedidos de todos los clientes vinculados con Tienda Nube
     * @return Lista de pedidos agrupados por cliente
     */
    @Transactional(readOnly = true)
    public List<JsonNode> obtenerTodosLosPedidosTiendaNube() throws Exception {
        List<Cliente> clientesVinculados = clienteRepository.findByTiendanubeAccessTokenIsNotNull();
        
        log.info("=== OBTENIENDO PEDIDOS TIENDA NUBE ===");
        log.info("Clientes vinculados encontrados: {}", clientesVinculados.size());
        
        List<JsonNode> todosLosPedidos = new ArrayList<>();
        
        for (Cliente cliente : clientesVinculados) {
            log.info("Procesando cliente ID: {}, Nombre: {}, Store ID: {}, Tiene Token: {}", 
                cliente.getId(), 
                cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : cliente.getCodigo(),
                cliente.getTiendanubeStoreId(),
                cliente.getTiendanubeAccessToken() != null && !cliente.getTiendanubeAccessToken().isEmpty());
            
            // Si tiene token pero no store_id, intentar obtenerlo de /v1/store
            if (cliente.getTiendanubeAccessToken() != null && 
                !cliente.getTiendanubeAccessToken().isEmpty() &&
                (cliente.getTiendanubeStoreId() == null || cliente.getTiendanubeStoreId().isEmpty())) {
                
                log.info("Cliente {} tiene token pero no store_id, intentando obtenerlo de /v1/store", cliente.getId());
                try {
                    String storeInfoUrl = "https://api.tiendanube.com/v1/store";
                    URL storeUrl = new URL(storeInfoUrl);
                    HttpURLConnection storeConn = (HttpURLConnection) storeUrl.openConnection();
                    storeConn.setRequestMethod("GET");
                    // Tienda Nube usa "Authentication" no "Authorization" según su documentación
                    storeConn.setRequestProperty("Authentication", "bearer " + cliente.getTiendanubeAccessToken());
                    storeConn.setRequestProperty("User-Agent", "TMS-Llegue (contacto@zetallegue.com)");
                    
                    int storeResponseCode = storeConn.getResponseCode();
                    if (storeResponseCode == 200) {
                        BufferedReader storeReader = new BufferedReader(new InputStreamReader(storeConn.getInputStream()));
                        StringBuilder storeResponse = new StringBuilder();
                        String line;
                        while ((line = storeReader.readLine()) != null) {
                            storeResponse.append(line);
                        }
                        storeReader.close();
                        
                        JsonNode storeInfo = objectMapper.readTree(storeResponse.toString());
                        log.info("Información de la tienda recibida: {}", storeInfo.toString());
                        
                        String storeId = null;
                        if (storeInfo.has("id")) {
                            storeId = storeInfo.get("id").asText();
                        } else if (storeInfo.has("store_id")) {
                            storeId = storeInfo.get("store_id").asText();
                        } else if (storeInfo.has("shop_id")) {
                            storeId = storeInfo.get("shop_id").asText();
                        }
                        
                        if (storeId != null && !storeId.isEmpty()) {
                            cliente.setTiendanubeStoreId(storeId);
                            clienteRepository.save(cliente);
                            log.info("Store ID {} guardado para cliente {}", storeId, cliente.getId());
                        } else {
                            log.warn("No se pudo obtener el store_id de la respuesta de /v1/store para cliente {}", cliente.getId());
                        }
                    } else {
                        log.warn("Error al obtener información de la tienda para cliente {}: código {}", cliente.getId(), storeResponseCode);
                    }
                    storeConn.disconnect();
                } catch (Exception e) {
                    log.error("Error al obtener store_id para cliente {}: {}", cliente.getId(), e.getMessage());
                }
            }
            
            if (cliente.getTiendanubeAccessToken() != null && 
                !cliente.getTiendanubeAccessToken().isEmpty() &&
                cliente.getTiendanubeStoreId() != null &&
                !cliente.getTiendanubeStoreId().isEmpty()) {
                
                try {
                    log.info("Obteniendo pedidos para cliente {} (Store ID: {})", cliente.getId(), cliente.getTiendanubeStoreId());
                    List<JsonNode> pedidosCliente = obtenerPedidosTiendaNube(cliente.getId());
                    log.info("Pedidos obtenidos para cliente {}: {}", cliente.getId(), pedidosCliente.size());
                    
                    // Agregar información del cliente a cada pedido
                    for (JsonNode pedido : pedidosCliente) {
                        // Crear un objeto que incluya el pedido y el cliente
                        com.fasterxml.jackson.databind.node.ObjectNode pedidoConCliente = objectMapper.createObjectNode();
                        pedidoConCliente.set("pedido", pedido);
                        pedidoConCliente.put("clienteId", cliente.getId());
                        // Construir clienteNombre en el mismo formato que se guarda en los envíos: "codigo - nombre"
                        String clienteNombreCompleto = cliente.getCodigo() + " - " + (cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : cliente.getRazonSocial());
                        pedidoConCliente.put("clienteNombre", clienteNombreCompleto);
                        pedidoConCliente.put("tiendanubeUrl", cliente.getTiendanubeUrl() != null ? cliente.getTiendanubeUrl() : "");
                        pedidoConCliente.put("tiendanubeMetodoEnvio", cliente.getTiendanubeMetodoEnvio() != null ? cliente.getTiendanubeMetodoEnvio() : "");
                        
                        todosLosPedidos.add(pedidoConCliente);
                    }
                } catch (Exception e) {
                    log.error("Error al obtener pedidos para cliente {}: {}", cliente.getId(), e.getMessage(), e);
                    // Continuar con el siguiente cliente
                }
            } else {
                log.warn("Cliente {} no tiene token o store_id configurado correctamente", cliente.getId());
            }
        }
        
        log.info("Total de pedidos obtenidos de todos los clientes: {}", todosLosPedidos.size());
        
        return todosLosPedidos;
    }
}

