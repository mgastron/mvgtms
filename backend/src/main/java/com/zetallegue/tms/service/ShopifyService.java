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
public class ShopifyService {

    private final ClienteRepository clienteRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // Versión de API de Shopify (usando 2024-01 que es estable)
    private static final String SHOPIFY_API_VERSION = "2024-01";
    
    /**
     * Extrae el shop name de la URL de Shopify
     * Ejemplo: https://mi-tienda.myshopify.com -> mi-tienda
     */
    private String extraerShopName(String shopifyUrl) {
        if (shopifyUrl == null || shopifyUrl.trim().isEmpty()) {
            return null;
        }
        
        try {
            // Remover protocolo si existe
            String url = shopifyUrl.trim();
            if (url.startsWith("http://")) {
                url = url.substring(7);
            } else if (url.startsWith("https://")) {
                url = url.substring(8);
            }
            
            // Remover www. si existe
            if (url.startsWith("www.")) {
                url = url.substring(4);
            }
            
            // Extraer el shop name (antes de .myshopify.com)
            if (url.contains(".myshopify.com")) {
                return url.split("\\.myshopify\\.com")[0];
            }
            
            // Si no tiene .myshopify.com, asumir que es solo el shop name
            if (url.contains("/")) {
                return url.split("/")[0];
            }
            
            return url;
        } catch (Exception e) {
            log.warn("Error al extraer shop name de URL: {}", shopifyUrl, e);
            return null;
        }
    }
    
    /**
     * Obtiene los pedidos de Shopify para un cliente específico
     * @param clienteId ID del cliente
     * @return Lista de pedidos en formato JSON
     */
    @Transactional(readOnly = true)
    public List<JsonNode> obtenerPedidosShopify(Long clienteId) throws Exception {
        Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getShopifyClaveUnica() == null || cliente.getShopifyClaveUnica().isEmpty()) {
            throw new RuntimeException("El cliente no tiene Access Token de Shopify configurado");
        }
        
        String shopName = extraerShopName(cliente.getShopifyUrl());
        if (shopName == null || shopName.isEmpty()) {
            throw new RuntimeException("El cliente no tiene Shop Name de Shopify configurado (URL inválida)");
        }
        
        log.info("Obteniendo pedidos de Shopify para cliente {} (shop: {})", clienteId, shopName);
        
        // Endpoint para obtener pedidos según documentación Shopify: GET /admin/api/{version}/orders.json
        // Filtramos por status "open" y "fulfilled" que son los que están listos para envío
        String urlStr = String.format(
            "https://%s.myshopify.com/admin/api/%s/orders.json?status=open&status=fulfilled&limit=250",
            shopName,
            SHOPIFY_API_VERSION
        );
        
        log.info("Consultando endpoint: {}", urlStr);
        
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        
        // Shopify usa X-Shopify-Access-Token para autenticación con Private App
        conn.setRequestProperty("X-Shopify-Access-Token", cliente.getShopifyClaveUnica());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        
        int responseCode = conn.getResponseCode();
        
        if (responseCode != 200) {
            // Leer mensaje de error
            String errorMessage = "Error al obtener pedidos de Shopify. Código: " + responseCode;
            if (conn.getErrorStream() != null) {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line);
                }
                errorMessage += " - " + errorResponse.toString();
                errorReader.close();
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
        log.info("Respuesta de Shopify API (primeros 1000 caracteres): {}", 
            responseBody.length() > 1000 ? responseBody.substring(0, 1000) + "..." : responseBody);
        
        // Parsear respuesta JSON
        JsonNode jsonResponse = objectMapper.readTree(responseBody);
        
        // Shopify devuelve los pedidos en un array dentro de "orders"
        List<JsonNode> pedidos = new ArrayList<>();
        if (jsonResponse.has("orders") && jsonResponse.get("orders").isArray()) {
            for (JsonNode pedido : jsonResponse.get("orders")) {
                pedidos.add(pedido);
            }
        }
        
        log.info("Pedidos obtenidos de Shopify para cliente {}: {}", clienteId, pedidos.size());
        
        // Log completo del primer pedido para debug
        if (pedidos.size() > 0) {
            log.info("Estructura completa del primer pedido: {}", pedidos.get(0).toString());
        }
        
        return pedidos;
    }
    
    /**
     * Obtiene todos los pedidos de Shopify de todos los clientes vinculados
     * @return Lista de pedidos con información del cliente
     */
    @Transactional(readOnly = true)
    public List<JsonNode> obtenerTodosLosPedidosShopify() {
        List<JsonNode> todosLosPedidos = new ArrayList<>();
        
        // Obtener todos los clientes con Shopify configurado
        List<Cliente> clientes = clienteRepository.findAll().stream()
            .filter(c -> c.getShopifyUrl() != null && !c.getShopifyUrl().trim().isEmpty())
            .filter(c -> c.getShopifyClaveUnica() != null && !c.getShopifyClaveUnica().trim().isEmpty())
            .filter(c -> c.getHabilitado() != null && c.getHabilitado())
            .toList();
        
        log.info("Clientes con Shopify configurado: {}", clientes.size());
        
        for (Cliente cliente : clientes) {
            try {
                log.info("Obteniendo pedidos para cliente {} (Shop: {})", cliente.getId(), extraerShopName(cliente.getShopifyUrl()));
                List<JsonNode> pedidosCliente = obtenerPedidosShopify(cliente.getId());
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
                    pedidoConCliente.put("shopifyUrl", cliente.getShopifyUrl());
                    pedidoConCliente.put("shopifyMetodoEnvio", cliente.getShopifyMetodoEnvio());
                    pedidoConCliente.put("shopifyUrl", cliente.getShopifyUrl() != null ? cliente.getShopifyUrl() : "");
                    
                    todosLosPedidos.add(pedidoConCliente);
                }
            } catch (Exception e) {
                log.error("Error al obtener pedidos para cliente {}: {}", cliente.getId(), e.getMessage(), e);
                // Continuar con el siguiente cliente
            }
        }
        
        log.info("Total de pedidos obtenidos de todos los clientes: {}", todosLosPedidos.size());
        
        return todosLosPedidos;
    }
}

