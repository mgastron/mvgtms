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
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class VtexService {

    private final ClienteRepository clienteRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Obtiene los pedidos de VTEX para un cliente específico
     * @param clienteId ID del cliente
     * @return Lista de pedidos en formato JSON
     */
    @Transactional(readOnly = true)
    public List<JsonNode> obtenerPedidosVtex(Long clienteId) throws Exception {
        Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getVtexKey() == null || cliente.getVtexKey().isEmpty()) {
            throw new RuntimeException("El cliente no tiene Key de VTEX configurada");
        }
        
        if (cliente.getVtexToken() == null || cliente.getVtexToken().isEmpty()) {
            throw new RuntimeException("El cliente no tiene Token de VTEX configurado");
        }
        
        String accountName = extraerAccountName(cliente.getVtexUrl());
        if (accountName == null || accountName.isEmpty()) {
            throw new RuntimeException("El cliente no tiene Account Name de VTEX configurado (URL inválida)");
        }
        
        log.info("Obteniendo pedidos de VTEX para cliente {} (account: {})", clienteId, accountName);
        
        // Endpoint para obtener pedidos según documentación VTEX: GET /api/oms/pvt/orders
        // Filtramos por status "invoiced" y "ready-for-handling" que son los que están listos para envío
        String urlStr = String.format(
            "https://%s.vtexcommercestable.com.br/api/oms/pvt/orders?f_status=invoiced,ready-for-handling&per_page=100",
            accountName
        );
        
        log.info("Consultando endpoint: {}", urlStr);
        
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        
        // VTEX usa autenticación básica con Key:Token
        String auth = cliente.getVtexKey() + ":" + cliente.getVtexToken();
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
        conn.setRequestProperty("Authorization", "Basic " + encodedAuth);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("Content-Type", "application/json");
        
        int responseCode = conn.getResponseCode();
        
        if (responseCode != 200) {
            String errorMessage = "Error al obtener pedidos de VTEX. Código: " + responseCode;
            if (conn.getErrorStream() != null) {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line);
                }
                errorMessage += " - " + errorResponse.toString();
            }
            log.error(errorMessage);
            throw new RuntimeException(errorMessage);
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
        log.info("Respuesta de VTEX recibida (primeros 500 caracteres): {}", 
            responseBody.length() > 500 ? responseBody.substring(0, 500) + "..." : responseBody);
        
        JsonNode jsonResponse = objectMapper.readTree(responseBody);
        List<JsonNode> pedidos = new ArrayList<>();
        
        // La API de VTEX devuelve los pedidos en un array directo o en un campo "list"
        if (jsonResponse.isArray()) {
            log.info("La respuesta es un array con {} elementos", jsonResponse.size());
            for (JsonNode pedido : jsonResponse) {
                pedidos.add(pedido);
            }
        } else if (jsonResponse.has("list")) {
            log.info("La respuesta tiene campo 'list'");
            JsonNode listArray = jsonResponse.get("list");
            if (listArray.isArray()) {
                log.info("El campo 'list' es un array con {} elementos", listArray.size());
                for (JsonNode pedido : listArray) {
                    pedidos.add(pedido);
                }
            }
        } else if (jsonResponse.has("items")) {
            log.info("La respuesta tiene campo 'items'");
            JsonNode itemsArray = jsonResponse.get("items");
            if (itemsArray.isArray()) {
                log.info("El campo 'items' es un array con {} elementos", itemsArray.size());
                for (JsonNode pedido : itemsArray) {
                    pedidos.add(pedido);
                }
            }
        } else {
            log.warn("La respuesta no tiene estructura reconocida. Tipo: {}, Contenido: {}", 
                jsonResponse.getNodeType(), 
                responseBody.length() > 200 ? responseBody.substring(0, 200) + "..." : responseBody);
        }
        
        log.info("Se obtuvieron {} pedidos de VTEX para cliente {}", pedidos.size(), clienteId);
        
        return pedidos;
    }
    
    /**
     * Obtiene todos los pedidos de todos los clientes vinculados con VTEX
     * @return Lista de pedidos agrupados por cliente
     */
    @Transactional(readOnly = true)
    public List<JsonNode> obtenerTodosLosPedidosVtex() throws Exception {
        List<Cliente> clientesVinculados = clienteRepository.findByVtexKeyIsNotNull();
        
        log.info("=== OBTENIENDO PEDIDOS VTEX ===");
        log.info("Clientes vinculados encontrados: {}", clientesVinculados.size());
        
        List<JsonNode> todosLosPedidos = new ArrayList<>();
        
        for (Cliente cliente : clientesVinculados) {
            log.info("Procesando cliente ID: {}, Nombre: {}, Account: {}, Tiene Key: {}, Tiene Token: {}", 
                cliente.getId(), 
                cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : cliente.getCodigo(),
                extraerAccountName(cliente.getVtexUrl()),
                cliente.getVtexKey() != null && !cliente.getVtexKey().isEmpty(),
                cliente.getVtexToken() != null && !cliente.getVtexToken().isEmpty());
            
            if (cliente.getVtexKey() != null && 
                !cliente.getVtexKey().isEmpty() &&
                cliente.getVtexToken() != null &&
                !cliente.getVtexToken().isEmpty() &&
                cliente.getVtexUrl() != null &&
                !cliente.getVtexUrl().isEmpty()) {
                
                try {
                    log.info("Obteniendo pedidos para cliente {} (Account: {})", cliente.getId(), extraerAccountName(cliente.getVtexUrl()));
                    List<JsonNode> pedidosCliente = obtenerPedidosVtex(cliente.getId());
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
                        pedidoConCliente.put("vtexUrl", cliente.getVtexUrl() != null ? cliente.getVtexUrl() : "");
                        pedidoConCliente.put("vtexMetodoEnvio", cliente.getVtexIdLogistica() != null ? cliente.getVtexIdLogistica() : "");
                        
                        todosLosPedidos.add(pedidoConCliente);
                    }
                } catch (Exception e) {
                    log.error("Error al obtener pedidos de VTEX para cliente {}: {}", cliente.getId(), e.getMessage(), e);
                }
            } else {
                log.warn("Cliente {} no tiene credenciales completas de VTEX, se omite", cliente.getId());
            }
        }
        
        log.info("=== TOTAL PEDIDOS VTEX OBTENIDOS: {} ===", todosLosPedidos.size());
        return todosLosPedidos;
    }
    
    /**
     * Extrae el account name de la URL de VTEX
     * Ejemplo: "https://mitienda.vtexcommercestable.com.br" -> "mitienda"
     */
    private String extraerAccountName(String vtexUrl) {
        if (vtexUrl == null || vtexUrl.isEmpty()) {
            return null;
        }
        
        try {
            // Remover protocolo si existe
            String url = vtexUrl.replace("https://", "").replace("http://", "");
            
            // Si contiene .vtexcommercestable.com.br, extraer la parte antes del punto
            if (url.contains(".vtexcommercestable.com.br")) {
                return url.split("\\.")[0];
            }
            
            // Si no, intentar extraer de otra forma
            if (url.contains("/")) {
                return url.split("/")[0].split("\\.")[0];
            }
            
            return url.split("\\.")[0];
        } catch (Exception e) {
            log.warn("Error al extraer account name de URL: {}", vtexUrl);
            return null;
        }
    }
}

