package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.ClienteDTO;
import com.zetallegue.tms.dto.ClienteFilterDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.repository.ClienteRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.core.env.Environment;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final MercadoLibreService mercadoLibreService;
    private final EnvioService envioService;
    private final Environment environment;

    @Transactional(readOnly = true)
    public PageResponseDTO<ClienteDTO> buscarClientes(ClienteFilterDTO filter) {
        Specification<Cliente> spec = buildSpecification(filter);
        Pageable pageable = PageRequest.of(filter.getPage(), filter.getSize());
        Page<Cliente> page = clienteRepository.findAll(spec, pageable);

        List<ClienteDTO> content = page.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        return new PageResponseDTO<>(
                content,
                page.getTotalPages(),
                page.getTotalElements(),
                filter.getPage(),
                filter.getSize()
        );
    }

    @Transactional(readOnly = true)
    public ClienteDTO obtenerClientePorId(Long id) {
        Cliente cliente = clienteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + id));
        return toDTO(cliente);
    }

    @Transactional
    public ClienteDTO crearCliente(ClienteDTO clienteDTO) {
        if (clienteRepository.existsByCodigo(clienteDTO.getCodigo())) {
            throw new RuntimeException("Ya existe un cliente con el código: " + clienteDTO.getCodigo());
        }

        Cliente cliente = toEntity(clienteDTO);
        cliente = clienteRepository.save(cliente);
        return toDTO(cliente);
    }

    @Transactional
    public ClienteDTO actualizarCliente(Long id, ClienteDTO clienteDTO) {
        Cliente cliente = clienteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + id));

        // Verificar si el código ya existe en otro cliente
        if (!cliente.getCodigo().equals(clienteDTO.getCodigo()) &&
            clienteRepository.existsByCodigo(clienteDTO.getCodigo())) {
            throw new RuntimeException("Ya existe un cliente con el código: " + clienteDTO.getCodigo());
        }

        cliente.setCodigo(clienteDTO.getCodigo());
        cliente.setNombreFantasia(clienteDTO.getNombreFantasia());
        cliente.setRazonSocial(clienteDTO.getRazonSocial());
        cliente.setNumeroDocumento(clienteDTO.getNumeroDocumento());
        cliente.setHabilitado(clienteDTO.getHabilitado());
        cliente.setIntegraciones(clienteDTO.getIntegraciones());
        
        // Si se está desvinculando Flex (flexIdVendedor es null o vacío), limpiar todos los campos relacionados
        if (clienteDTO.getFlexIdVendedor() == null || clienteDTO.getFlexIdVendedor().trim().isEmpty()) {
            cliente.setFlexIdVendedor(null);
            cliente.setFlexUsername(null);
            cliente.setFlexAccessToken(null);
            cliente.setFlexRefreshToken(null);
            cliente.setFlexTokenExpiresAt(null);
        } else {
            // Si se está vinculando o actualizando, usar los valores del DTO
            cliente.setFlexIdVendedor(clienteDTO.getFlexIdVendedor());
            cliente.setFlexUsername(clienteDTO.getFlexUsername());
            // Solo actualizar tokens si vienen en el DTO (no sobrescribir si son null)
            if (clienteDTO.getFlexAccessToken() != null) {
                cliente.setFlexAccessToken(clienteDTO.getFlexAccessToken());
            }
            if (clienteDTO.getFlexRefreshToken() != null) {
                cliente.setFlexRefreshToken(clienteDTO.getFlexRefreshToken());
            }
            if (clienteDTO.getFlexTokenExpiresAt() != null) {
                cliente.setFlexTokenExpiresAt(clienteDTO.getFlexTokenExpiresAt());
            }
        }
        cliente.setTiendanubeUrl(clienteDTO.getTiendanubeUrl());
        // Solo actualizar tokens de Tienda Nube si vienen en el DTO (no sobrescribir si son null)
        if (clienteDTO.getTiendanubeAccessToken() != null) {
            cliente.setTiendanubeAccessToken(clienteDTO.getTiendanubeAccessToken());
        }
        if (clienteDTO.getTiendanubeRefreshToken() != null) {
            cliente.setTiendanubeRefreshToken(clienteDTO.getTiendanubeRefreshToken());
        }
        if (clienteDTO.getTiendanubeTokenExpiresAt() != null) {
            cliente.setTiendanubeTokenExpiresAt(clienteDTO.getTiendanubeTokenExpiresAt());
        }
        if (clienteDTO.getTiendanubeStoreId() != null) {
            cliente.setTiendanubeStoreId(clienteDTO.getTiendanubeStoreId());
        }
        if (clienteDTO.getTiendanubeMetodoEnvio() != null) {
            cliente.setTiendanubeMetodoEnvio(clienteDTO.getTiendanubeMetodoEnvio());
        }
        cliente.setShopifyUrl(clienteDTO.getShopifyUrl());
        cliente.setShopifyClaveUnica(clienteDTO.getShopifyClaveUnica());
        cliente.setShopifyMetodoEnvio(clienteDTO.getShopifyMetodoEnvio());
        cliente.setVtexUrl(clienteDTO.getVtexUrl());
        cliente.setVtexKey(clienteDTO.getVtexKey());
        cliente.setVtexToken(clienteDTO.getVtexToken());
        cliente.setVtexIdLogistica(clienteDTO.getVtexIdLogistica());
        cliente.setListaPreciosId(clienteDTO.getListaPreciosId());

        cliente = clienteRepository.save(cliente);
        return toDTO(cliente);
    }

    @Transactional
    public void eliminarCliente(Long id) {
        if (!clienteRepository.existsById(id)) {
            throw new RuntimeException("Cliente no encontrado con id: " + id);
        }
        clienteRepository.deleteById(id);
    }

    @Transactional
    public ClienteDTO toggleHabilitado(Long id) {
        Cliente cliente = clienteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + id));
        cliente.setHabilitado(!cliente.getHabilitado());
        cliente = clienteRepository.save(cliente);
        return toDTO(cliente);
    }

    @Transactional
    public String generarLinkVinculacionTiendaNube(Long clienteId, String baseUrlParam) {
        // Validar que el cliente existe
        if (!clienteRepository.existsById(clienteId)) {
            throw new RuntimeException("Cliente no encontrado con id: " + clienteId);
        }
        
        Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getTiendanubeUrl() == null || cliente.getTiendanubeUrl().trim().isEmpty()) {
            throw new RuntimeException("El cliente debe tener una URL de Tienda Nube configurada");
        }
        
        // Generar un token único para esta solicitud de vinculación
        String token = clienteId + "_" + java.util.UUID.randomUUID().toString();
        
        // Construir el link de autorización
        String baseUrl = baseUrlParam;
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = System.getenv("FRONTEND_BASE_URL");
        }
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = "http://localhost:3000";
        }
        
        // Construir la URL de autorización de Tienda Nube
        // TODO: Investigar la URL correcta de OAuth de Tienda Nube
        // Por ahora, generamos un link que apunta a nuestra página de autorización
        String authUrl = baseUrl + "/auth/tiendanube?token=" + token + "&clienteId=" + clienteId;
        
        log.info("Link de vinculación Tienda Nube generado para cliente {}: {}", clienteId, authUrl);
        
        return authUrl;
    }

    @Transactional(readOnly = true)
    public String generarUrlAutorizacionTiendaNube(Long clienteId, String token) {
        // Validar que el cliente existe
        if (!clienteRepository.existsById(clienteId)) {
            throw new RuntimeException("Cliente no encontrado con id: " + clienteId);
        }
        
        Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getTiendanubeUrl() == null || cliente.getTiendanubeUrl().trim().isEmpty()) {
            throw new RuntimeException("El cliente debe tener una URL de Tienda Nube configurada");
        }
        
        // Obtener credenciales de Tienda Nube desde configuración
        // Prioridad: Variables de entorno > application.properties
        String clientId = System.getenv("TIENDANUBE_CLIENT_ID");
        if (clientId == null || clientId.isEmpty()) {
            // Leer desde application.properties como fallback
            clientId = environment.getProperty("tiendanube.client.id");
        }
        if (clientId == null || clientId.isEmpty()) {
            throw new RuntimeException("TIENDANUBE_CLIENT_ID no configurado. Por favor, configure las credenciales de Tienda Nube en variables de entorno (TIENDANUBE_CLIENT_ID) o application.properties (tiendanube.client.id).");
        }
        
        String redirectUri = System.getenv("TIENDANUBE_REDIRECT_URI");
        if (redirectUri == null || redirectUri.isEmpty()) {
            // Leer desde application.properties como fallback
            redirectUri = environment.getProperty("tiendanube.redirect.uri");
        }
        if (redirectUri == null || redirectUri.isEmpty()) {
            // Intentar construir desde la URL base del frontend
            String frontendBaseUrl = System.getenv("FRONTEND_BASE_URL");
            if (frontendBaseUrl == null || frontendBaseUrl.isEmpty()) {
                frontendBaseUrl = environment.getProperty("frontend.base.url");
            }
            if (frontendBaseUrl == null || frontendBaseUrl.isEmpty()) {
                // Intentar extraer de la URL del túnel si está configurada
                String mercadolibreRedirectUri = System.getenv("MERCADOLIBRE_REDIRECT_URI");
                if (mercadolibreRedirectUri == null || mercadolibreRedirectUri.isEmpty()) {
                    mercadolibreRedirectUri = environment.getProperty("mercadolibre.redirect.uri");
                }
                if (mercadolibreRedirectUri != null && !mercadolibreRedirectUri.isEmpty()) {
                    try {
                        java.net.URL url = new java.net.URL(mercadolibreRedirectUri);
                        frontendBaseUrl = url.getProtocol() + "://" + url.getHost();
                    } catch (Exception e) {
                        frontendBaseUrl = "http://localhost:3000";
                    }
                } else {
                    frontendBaseUrl = "http://localhost:3000";
                }
            }
            redirectUri = frontendBaseUrl + "/auth/tiendanube/callback";
        }
        
        // Construir la URL de autorización de Tienda Nube
        // La URL debe ser: {tiendanubeUrl}/admin/apps/{appId}/authorize
        // Ejemplo: https://mitienda.mitiendanube.com/admin/apps/25636/authorize
        String tiendanubeUrl = cliente.getTiendanubeUrl().trim();
        
        // Asegurar que la URL no termine con /
        if (tiendanubeUrl.endsWith("/")) {
            tiendanubeUrl = tiendanubeUrl.substring(0, tiendanubeUrl.length() - 1);
        }
        
        // Construir la URL de autorización usando la URL de la tienda del cliente
        String baseAuthUrl = tiendanubeUrl + "/admin/apps/" + clientId + "/authorize";
        
        // Scopes necesarios para Tienda Nube
        // TODO: Verificar los scopes correctos según la documentación de Tienda Nube
        String scopes = "read_orders write_orders read_products read_customers";
        
        // Construir la URL con los parámetros OAuth
        String redirectUriEncoded = java.net.URLEncoder.encode(redirectUri, StandardCharsets.UTF_8);
        
        log.info("=== CONFIGURACIÓN DE AUTORIZACIÓN TIENDA NUBE ===");
        log.info("Client ID: {}", clientId);
        log.info("Redirect URI (sin codificar): {}", redirectUri);
        log.info("Redirect URI (codificado): {}", redirectUriEncoded);
        log.info("State: {}", token);
        log.info("Scopes: {}", scopes);
        log.info("IMPORTANTE: El redirect_uri debe coincidir EXACTAMENTE con el configurado en el Portal de Socios");
        log.info("Portal: https://partners.tiendanube.com/applications/details/{}", clientId);
        
        String authUrl = String.format(
            "%s?response_type=code&client_id=%s&redirect_uri=%s&state=%s&scope=%s",
            baseAuthUrl,
            clientId,
            redirectUriEncoded,
            token,
            scopes
        );
        
        log.info("URL de autorización Tienda Nube generada para cliente {}: {}", clienteId, authUrl);
        
        return authUrl;
    }

    @Transactional
    public String generarLinkVinculacionFlex(Long clienteId, String baseUrlParam) {
        // Validar que el cliente existe
        if (!clienteRepository.existsById(clienteId)) {
            throw new RuntimeException("Cliente no encontrado con id: " + clienteId);
        }
        
        // Generar un token único para esta solicitud de vinculación
        // Incluimos el clienteId en el token para poder recuperarlo después
        String token = clienteId + "_" + java.util.UUID.randomUUID().toString();
        
        // Construir el link de autorización
        // Prioridad: Parámetro > Variable de entorno > Extraer de redirect_uri > localhost
        String baseUrl = baseUrlParam;
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = System.getenv("FRONTEND_BASE_URL");
        }
        
        if (baseUrl == null || baseUrl.isEmpty()) {
            // Intentar extraer de la URL de redirect (sin el path)
            String redirectUri = System.getenv("MERCADOLIBRE_REDIRECT_URI");
            if (redirectUri != null && !redirectUri.isEmpty()) {
                try {
                    java.net.URL url = new java.net.URL(redirectUri);
                    baseUrl = url.getProtocol() + "://" + url.getHost();
                    // Si tiene puerto, agregarlo (aunque Cloudflare no lo usa)
                    if (url.getPort() != -1 && url.getPort() != 80 && url.getPort() != 443) {
                        baseUrl += ":" + url.getPort();
                    }
                } catch (Exception e) {
                    // Si falla, usar localhost como fallback
                    baseUrl = "http://localhost:3000";
                }
            } else {
                baseUrl = "http://localhost:3000";
            }
        }
        
        String link = baseUrl + "/auth/mercadolibre?clienteId=" + clienteId + "&token=" + token;
        
        return link;
    }

    @Transactional(readOnly = true)
    public String generarUrlAutorizacionFlex(Long clienteId, String token, boolean fulfillment) {
        // Validar que el cliente existe
        if (!clienteRepository.existsById(clienteId)) {
            throw new RuntimeException("Cliente no encontrado con id: " + clienteId);
        }
        
        // Obtener credenciales de MercadoLibre desde configuración
        // Prioridad: Variables de entorno > application.properties
        String clientId = System.getenv("MERCADOLIBRE_CLIENT_ID");
        if (clientId == null || clientId.isEmpty()) {
            // Leer desde application.properties si está configurado
            // Por ahora usamos el Client ID que vimos: 5552011749820676
            clientId = "5552011749820676";
        }
        
        String redirectUri = System.getenv("MERCADOLIBRE_REDIRECT_URI");
        if (redirectUri == null || redirectUri.isEmpty()) {
            // URL del túnel Cloudflare (actualizar cuando cambie)
            redirectUri = "https://outcome-supreme-preview-invest.trycloudflare.com/auth/mercadolibre/callback";
        }
        
        // Construir la URL de autorización de MercadoLibre
        // Para Argentina, usar auth.mercadolibre.com.ar
        String baseAuthUrl = "https://auth.mercadolibre.com.ar/authorization";
        
        // Scopes necesarios para Flex
        // IMPORTANTE: Estos scopes deben coincidir con los permisos activados en el panel de desarrolladores
        // Panel: https://developers.mercadolibre.com.ar/apps/{APP_ID}/edit
        // Permisos necesarios:
        // - "Venta y envíos de un producto" -> "Lectura y escritura" (para acceder a shipments y orders)
        // - "Orders" -> "Orders_v2" y "Orders Feedback" deben estar activados
        StringBuilder scopes = new StringBuilder();
        scopes.append("offline_access"); // Para obtener refresh token
        scopes.append(" read"); // Lectura básica
        scopes.append(" write"); // Escritura
        scopes.append(" shipments"); // Scope específico para shipments
        if (fulfillment) {
            scopes.append(" fulfillment"); // Fulfillment si está marcado
        }
        
        String scopesString = scopes.toString().trim();
        log.info("=== SCOPES SOLICITADOS EN URL DE AUTORIZACIÓN ===");
        log.info("Scopes: {}", scopesString);
        log.info("IMPORTANTE: Estos scopes deben coincidir con los permisos activados en el panel de desarrolladores");
        log.info("Panel: https://developers.mercadolibre.com.ar/apps/{}/edit", clientId);
        log.info("Permisos necesarios:");
        log.info("  - 'Venta y envíos de un producto' -> 'Lectura y escritura'");
        log.info("  - 'Orders' -> 'Orders_v2' y 'Orders Feedback' deben estar activados");
        
        String authUrl = String.format(
            "%s?response_type=code&client_id=%s&redirect_uri=%s&state=%s&scope=%s",
            baseAuthUrl,
            clientId,
            java.net.URLEncoder.encode(redirectUri, java.nio.charset.StandardCharsets.UTF_8),
            token,
            scopesString
        );
        
        return authUrl;
    }

    @Transactional
    public ClienteDTO procesarCallbackFlex(String code, String state) {
        try {
            // Extraer clienteId del state (formato: clienteId_token)
            Long clienteId;
            try {
                String[] parts = state.split("_", 2);
                if (parts.length < 1) {
                    throw new RuntimeException("State inválido: no contiene clienteId");
                }
                clienteId = Long.parseLong(parts[0]);
            } catch (NumberFormatException e) {
                throw new RuntimeException("State inválido: no se puede extraer clienteId", e);
            }
            
            Cliente cliente = clienteRepository.findById(clienteId)
                    .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
            
            // Obtener credenciales
            // Prioridad: Variables de entorno > application.properties
            String clientId = System.getenv("MERCADOLIBRE_CLIENT_ID");
            if (clientId == null || clientId.isEmpty()) {
                clientId = "5552011749820676"; // Client ID de la aplicación
            }
            
            String clientSecret = System.getenv("MERCADOLIBRE_CLIENT_SECRET");
            if (clientSecret == null || clientSecret.isEmpty()) {
                // Leer desde application.properties como fallback
                // En producción, siempre usar variables de entorno
                clientSecret = "8gCzwpun6ny443pfdq7fJH00xa3PSFZW";
            }
            
            String redirectUri = System.getenv("MERCADOLIBRE_REDIRECT_URI");
            if (redirectUri == null || redirectUri.isEmpty()) {
                redirectUri = "https://outcome-supreme-preview-invest.trycloudflare.com/auth/mercadolibre/callback";
            }
            
            // Intercambiar código por tokens
            String tokenUrl = "https://api.mercadolibre.com/oauth/token";
            
            String requestBody = String.format(
                "grant_type=authorization_code&client_id=%s&client_secret=%s&code=%s&redirect_uri=%s",
                clientId,
                clientSecret,
                code,
                java.net.URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
            );
            
            URL url = new URL(tokenUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setDoOutput(true);
            
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line);
                }
                throw new RuntimeException("Error al intercambiar código por tokens: " + responseCode + " - " + errorResponse.toString());
            }
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            
            ObjectMapper mapper = new ObjectMapper();
            JsonNode jsonResponse = mapper.readTree(response.toString());
            
            String accessToken = jsonResponse.get("access_token").asText();
            String refreshToken = jsonResponse.get("refresh_token") != null ? jsonResponse.get("refresh_token").asText() : null;
            int expiresIn = jsonResponse.get("expires_in").asInt();
            
            // Validar que tenemos refresh token (crítico para renovación automática)
            if (refreshToken == null || refreshToken.isEmpty()) {
                log.error("⚠️⚠️⚠️ ADVERTENCIA CRÍTICA: MercadoLibre NO devolvió refresh_token para cliente {}", clienteId);
                log.error("⚠️ Esto puede ocurrir si:");
                log.error("⚠️   1. El scope 'offline_access' no fue incluido en la URL de autorización");
                log.error("⚠️   2. El usuario canceló la autorización antes de completarla");
                log.error("⚠️   3. Hay un problema con la configuración de la aplicación en MercadoLibre");
                log.error("⚠️ Respuesta completa de MercadoLibre: {}", jsonResponse.toString());
                throw new RuntimeException("No se recibió refresh_token de MercadoLibre. " +
                    "Esto es crítico porque sin refresh_token no se podrán renovar los tokens automáticamente. " +
                    "Verifique que el scope 'offline_access' esté incluido en la URL de autorización.");
            }
            
            log.info("✓✓✓ Refresh token recibido correctamente (longitud: {})", refreshToken.length());
            log.info("✓✓✓ Access token recibido correctamente (longitud: {})", accessToken.length());
            
            // Obtener información del usuario de MercadoLibre
            String userInfoUrl = "https://api.mercadolibre.com/users/me?access_token=" + accessToken;
            URL userUrl = new URL(userInfoUrl);
            HttpURLConnection userConn = (HttpURLConnection) userUrl.openConnection();
            userConn.setRequestMethod("GET");
            
            int userResponseCode = userConn.getResponseCode();
            if (userResponseCode == 200) {
                BufferedReader userReader = new BufferedReader(new InputStreamReader(userConn.getInputStream()));
                StringBuilder userResponse = new StringBuilder();
                while ((line = userReader.readLine()) != null) {
                    userResponse.append(line);
                }
                
                JsonNode userInfo = mapper.readTree(userResponse.toString());
                Long sellerId = userInfo.get("id") != null ? userInfo.get("id").asLong() : null;
                String username = userInfo.get("nickname") != null ? userInfo.get("nickname").asText() : null;
                
                // Calcular fecha de expiración
                java.time.LocalDateTime expiresAt = java.time.LocalDateTime.now().plusSeconds(expiresIn);
                
                // Actualizar el cliente con los tokens
                cliente.setFlexAccessToken(accessToken);
                cliente.setFlexRefreshToken(refreshToken);
                cliente.setFlexTokenExpiresAt(expiresAt);
                cliente.setFlexIdVendedor(sellerId != null ? sellerId.toString() : null);
                cliente.setFlexUsername(username);
                cliente = clienteRepository.save(cliente);
                
                // Verificar que se guardó correctamente
                Cliente clienteVerificado = clienteRepository.findById(clienteId).orElse(null);
                if (clienteVerificado != null) {
                    boolean tieneRefreshToken = clienteVerificado.getFlexRefreshToken() != null && 
                                                !clienteVerificado.getFlexRefreshToken().isEmpty();
                    log.info("✓✓✓ Verificación post-guardado: Cliente {} tiene refresh token: {}", clienteId, tieneRefreshToken);
                    if (!tieneRefreshToken) {
                        log.error("⚠️⚠️⚠️ ERROR CRÍTICO: El refresh token NO se guardó en la base de datos para cliente {}", clienteId);
                    }
                }
                
                // Sincronizar automáticamente los envíos de la última semana (en background)
                // No bloqueamos la respuesta, la sincronización se hace de forma asíncrona
                final Long finalClienteId = clienteId;
                System.out.println("=== INICIANDO SINCRONIZACIÓN AUTOMÁTICA PARA CLIENTE " + finalClienteId + " ===");
                new Thread(() -> {
                    try {
                        System.out.println("Thread de sincronización iniciado para cliente " + finalClienteId);
                        // Sincronización automática deshabilitada
                        // Los envíos Flex se obtienen al escanear el QR, no se sincronizan automáticamente
                        // sincronizarEnviosAutomaticamente(finalClienteId);
                        System.out.println("=== SINCRONIZACIÓN AUTOMÁTICA COMPLETADA PARA CLIENTE " + finalClienteId + " ===");
                    } catch (Exception e) {
                        // No fallar la vinculación si la sincronización falla
                        // Solo loguear el error
                        System.err.println("=== ERROR EN SINCRONIZACIÓN AUTOMÁTICA PARA CLIENTE " + finalClienteId + " ===");
                        System.err.println("Error: " + e.getMessage());
                        e.printStackTrace();
                    }
                }).start();
                
                return toDTO(cliente);
            } else {
                throw new RuntimeException("Error al obtener información del usuario: " + userResponseCode);
            }
            
        } catch (Exception e) {
            throw new RuntimeException("Error al procesar callback de MercadoLibre: " + e.getMessage(), e);
        }
    }
    
    /**
     * Sincroniza automáticamente los envíos de la última semana para un cliente
     * NOTA: Actualmente deshabilitado - los envíos Flex se obtienen al escanear el QR
     */
    @SuppressWarnings("unused")
    private void sincronizarEnviosAutomaticamente(Long clienteId) throws Exception {
        try {
            System.out.println("=== SINCRONIZACIÓN AUTOMÁTICA INICIADA ===");
            System.out.println("Cliente ID: " + clienteId);
            
            // Obtener el cliente primero
            Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
            
            System.out.println("Cliente encontrado: " + cliente.getNombreFantasia());
            System.out.println("Flex ID Vendedor: " + cliente.getFlexIdVendedor());
            System.out.println("Flex Access Token: " + (cliente.getFlexAccessToken() != null ? "Presente" : "Ausente"));
            
            // Obtener envíos de la última semana
            System.out.println("Obteniendo envíos desde MercadoLibre...");
            List<com.fasterxml.jackson.databind.JsonNode> enviosML = mercadoLibreService.obtenerEnviosFlex(clienteId);
            System.out.println("Envíos obtenidos de ML: " + enviosML.size());
            
            int nuevos = 0;
            int actualizados = 0;
            int filtrados = 0;
            
            java.time.LocalDateTime unaSemanaAtras = java.time.LocalDateTime.now().minusDays(7);
            System.out.println("Filtrando envíos desde: " + unaSemanaAtras);
            
            for (com.fasterxml.jackson.databind.JsonNode envioML : enviosML) {
                try {
                    com.zetallegue.tms.dto.EnvioDTO envioDTO = mercadoLibreService.mapearEnvioFlex(envioML, cliente);
                    
                    // Filtrar solo envíos de la última semana
                    if (envioDTO.getFecha() != null && envioDTO.getFecha().isBefore(unaSemanaAtras)) {
                        filtrados++;
                        System.out.println("Envío filtrado (muy antiguo): " + envioDTO.getTracking() + " - Fecha: " + envioDTO.getFecha());
                        continue; // Saltar envíos más antiguos
                    }
                    
                    System.out.println("Procesando envío: " + envioDTO.getTracking() + " - Fecha: " + envioDTO.getFecha());
                    
                    // Verificar si el envío ya existe
                    java.util.Optional<com.zetallegue.tms.model.Envio> envioExistenteOpt = 
                        envioService.findByTracking(envioDTO.getTracking());
                    
                    if (envioExistenteOpt.isPresent()) {
                        com.zetallegue.tms.model.Envio envioExistente = envioExistenteOpt.get();
                        if (!envioExistente.getEliminado()) {
                            envioService.actualizarEnvio(envioExistente.getId(), envioDTO);
                            actualizados++;
                            System.out.println("  -> Actualizado");
                        } else {
                            envioService.crearEnvio(envioDTO);
                            nuevos++;
                            System.out.println("  -> Creado (anterior eliminado)");
                        }
                    } else {
                        envioService.crearEnvio(envioDTO);
                        nuevos++;
                        System.out.println("  -> Creado (nuevo)");
                    }
                } catch (Exception e) {
                    System.err.println("Error al procesar envío durante sincronización automática: " + e.getMessage());
                    e.printStackTrace();
                }
            }
            
            System.out.println("=== SINCRONIZACIÓN AUTOMÁTICA COMPLETADA ===");
            System.out.println("Total obtenidos de ML: " + enviosML.size());
            System.out.println("Filtrados (muy antiguos): " + filtrados);
            System.out.println("Nuevos: " + nuevos);
            System.out.println("Actualizados: " + actualizados);
        } catch (Exception e) {
            System.err.println("=== ERROR EN SINCRONIZACIÓN AUTOMÁTICA ===");
            System.err.println("Cliente ID: " + clienteId);
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    private Specification<Cliente> buildSpecification(ClienteFilterDTO filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filter.getCodigo() != null && !filter.getCodigo().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("codigo")),
                        "%" + filter.getCodigo().toLowerCase() + "%"
                ));
            }

            if (filter.getNombreFantasia() != null && !filter.getNombreFantasia().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("nombreFantasia")),
                        "%" + filter.getNombreFantasia().toLowerCase() + "%"
                ));
            }

            if (filter.getRazonSocial() != null && !filter.getRazonSocial().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("razonSocial")),
                        "%" + filter.getRazonSocial().toLowerCase() + "%"
                ));
            }

            if (filter.getNumeroDocumento() != null && !filter.getNumeroDocumento().trim().isEmpty()) {
                predicates.add(cb.like(
                        root.get("numeroDocumento"),
                        "%" + filter.getNumeroDocumento() + "%"
                ));
            }

            if (filter.getHabilitado() != null && !filter.getHabilitado().equals("todos")) {
                Boolean habilitado = filter.getHabilitado().equals("habilitado");
                predicates.add(cb.equal(root.get("habilitado"), habilitado));
            }

            if (filter.getIntegraciones() != null && !filter.getIntegraciones().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("integraciones")),
                        "%" + filter.getIntegraciones().toLowerCase() + "%"
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private ClienteDTO toDTO(Cliente cliente) {
        ClienteDTO dto = new ClienteDTO();
        dto.setId(cliente.getId());
        dto.setCodigo(cliente.getCodigo());
        dto.setNombreFantasia(cliente.getNombreFantasia());
        dto.setRazonSocial(cliente.getRazonSocial());
        dto.setNumeroDocumento(cliente.getNumeroDocumento());
        dto.setHabilitado(cliente.getHabilitado());
        dto.setIntegraciones(cliente.getIntegraciones());
        dto.setFlexIdVendedor(cliente.getFlexIdVendedor());
        dto.setFlexUsername(cliente.getFlexUsername());
        dto.setFlexAccessToken(cliente.getFlexAccessToken());
        dto.setFlexRefreshToken(cliente.getFlexRefreshToken());
        dto.setFlexTokenExpiresAt(cliente.getFlexTokenExpiresAt());
        dto.setTiendanubeUrl(cliente.getTiendanubeUrl());
        dto.setTiendanubeAccessToken(cliente.getTiendanubeAccessToken());
        dto.setTiendanubeRefreshToken(cliente.getTiendanubeRefreshToken());
        dto.setTiendanubeTokenExpiresAt(cliente.getTiendanubeTokenExpiresAt());
        dto.setTiendanubeStoreId(cliente.getTiendanubeStoreId());
        dto.setTiendanubeMetodoEnvio(cliente.getTiendanubeMetodoEnvio());
        dto.setShopifyUrl(cliente.getShopifyUrl());
        dto.setShopifyClaveUnica(cliente.getShopifyClaveUnica());
        dto.setShopifyMetodoEnvio(cliente.getShopifyMetodoEnvio());
        dto.setVtexUrl(cliente.getVtexUrl());
        dto.setVtexKey(cliente.getVtexKey());
        dto.setVtexToken(cliente.getVtexToken());
        dto.setVtexIdLogistica(cliente.getVtexIdLogistica());
        dto.setListaPreciosId(cliente.getListaPreciosId());
        return dto;
    }

    private Cliente toEntity(ClienteDTO dto) {
        Cliente cliente = new Cliente();
        cliente.setCodigo(dto.getCodigo());
        cliente.setNombreFantasia(dto.getNombreFantasia());
        cliente.setRazonSocial(dto.getRazonSocial());
        cliente.setNumeroDocumento(dto.getNumeroDocumento());
        cliente.setHabilitado(dto.getHabilitado() != null ? dto.getHabilitado() : true);
        cliente.setIntegraciones(dto.getIntegraciones());
        cliente.setFlexIdVendedor(dto.getFlexIdVendedor());
        cliente.setFlexUsername(dto.getFlexUsername());
        cliente.setFlexAccessToken(dto.getFlexAccessToken());
        cliente.setFlexRefreshToken(dto.getFlexRefreshToken());
        cliente.setFlexTokenExpiresAt(dto.getFlexTokenExpiresAt());
        cliente.setTiendanubeUrl(dto.getTiendanubeUrl());
        cliente.setTiendanubeAccessToken(dto.getTiendanubeAccessToken());
        cliente.setTiendanubeRefreshToken(dto.getTiendanubeRefreshToken());
        cliente.setTiendanubeTokenExpiresAt(dto.getTiendanubeTokenExpiresAt());
        cliente.setTiendanubeStoreId(dto.getTiendanubeStoreId());
        cliente.setTiendanubeMetodoEnvio(dto.getTiendanubeMetodoEnvio());
        cliente.setShopifyUrl(dto.getShopifyUrl());
        cliente.setShopifyClaveUnica(dto.getShopifyClaveUnica());
        cliente.setShopifyMetodoEnvio(dto.getShopifyMetodoEnvio());
        cliente.setVtexUrl(dto.getVtexUrl());
        cliente.setVtexKey(dto.getVtexKey());
        cliente.setVtexToken(dto.getVtexToken());
        cliente.setVtexIdLogistica(dto.getVtexIdLogistica());
        cliente.setListaPreciosId(dto.getListaPreciosId());
        return cliente;
    }

    @Transactional
    public ClienteDTO procesarCallbackTiendaNube(String code, String state) {
        try {
            // Extraer clienteId del state (formato: clienteId_token)
            Long clienteId;
            try {
                String[] parts = state.split("_", 2);
                if (parts.length < 1) {
                    throw new RuntimeException("State inválido: no contiene clienteId");
                }
                clienteId = Long.parseLong(parts[0]);
            } catch (NumberFormatException e) {
                throw new RuntimeException("State inválido: no se puede extraer clienteId", e);
            }
            
            Cliente cliente = clienteRepository.findById(clienteId)
                    .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
            
            if (cliente.getTiendanubeUrl() == null || cliente.getTiendanubeUrl().trim().isEmpty()) {
                throw new RuntimeException("El cliente debe tener una URL de Tienda Nube configurada");
            }
            
            // Obtener credenciales de Tienda Nube desde configuración
            // Prioridad: Variables de entorno > application.properties
            String clientId = System.getenv("TIENDANUBE_CLIENT_ID");
            if (clientId == null || clientId.isEmpty()) {
                clientId = environment.getProperty("tiendanube.client.id");
            }
            if (clientId == null || clientId.isEmpty()) {
                throw new RuntimeException("TIENDANUBE_CLIENT_ID no configurado. Por favor, configure las credenciales de Tienda Nube en variables de entorno (TIENDANUBE_CLIENT_ID) o application.properties (tiendanube.client.id).");
            }
            
            String clientSecret = System.getenv("TIENDANUBE_CLIENT_SECRET");
            if (clientSecret == null || clientSecret.isEmpty()) {
                clientSecret = environment.getProperty("tiendanube.client.secret");
            }
            if (clientSecret == null || clientSecret.isEmpty()) {
                throw new RuntimeException("TIENDANUBE_CLIENT_SECRET no configurado. Por favor, configure las credenciales de Tienda Nube en variables de entorno (TIENDANUBE_CLIENT_SECRET) o application.properties (tiendanube.client.secret).");
            }
            
            String redirectUri = System.getenv("TIENDANUBE_REDIRECT_URI");
            if (redirectUri == null || redirectUri.isEmpty()) {
                redirectUri = environment.getProperty("tiendanube.redirect.uri");
            }
            if (redirectUri == null || redirectUri.isEmpty()) {
                // Intentar construir desde la URL base del frontend
                String frontendBaseUrl = System.getenv("FRONTEND_BASE_URL");
                if (frontendBaseUrl == null || frontendBaseUrl.isEmpty()) {
                    frontendBaseUrl = environment.getProperty("frontend.base.url");
                }
                if (frontendBaseUrl == null || frontendBaseUrl.isEmpty()) {
                    // Intentar extraer de la URL del túnel si está configurada
                    String mercadolibreRedirectUri = System.getenv("MERCADOLIBRE_REDIRECT_URI");
                    if (mercadolibreRedirectUri == null || mercadolibreRedirectUri.isEmpty()) {
                        mercadolibreRedirectUri = environment.getProperty("mercadolibre.redirect.uri");
                    }
                    if (mercadolibreRedirectUri != null && !mercadolibreRedirectUri.isEmpty()) {
                        try {
                            java.net.URL url = new java.net.URL(mercadolibreRedirectUri);
                            frontendBaseUrl = url.getProtocol() + "://" + url.getHost();
                        } catch (Exception e) {
                            frontendBaseUrl = "http://localhost:3000";
                        }
                    } else {
                        frontendBaseUrl = "http://localhost:3000";
                    }
                }
                redirectUri = frontendBaseUrl + "/auth/tiendanube/callback";
            }
            
            // Intercambiar código por tokens
            // Según la documentación de Tienda Nube, el request debe ser JSON y NO incluir redirect_uri
            String tokenUrl = "https://www.tiendanube.com/apps/authorize/token";
            
            // Construir el JSON request body según el formato de Tienda Nube
            ObjectMapper mapper = new ObjectMapper();
            java.util.Map<String, String> requestData = new java.util.HashMap<>();
            requestData.put("client_id", clientId);
            requestData.put("client_secret", clientSecret);
            requestData.put("grant_type", "authorization_code");
            requestData.put("code", code);
            // NOTA: Tienda Nube NO requiere redirect_uri en el token exchange
            
            String requestBody = mapper.writeValueAsString(requestData);
            
            log.info("Intercambiando código por tokens en Tienda Nube...");
            log.info("Token URL: {}", tokenUrl);
            log.info("Request body: {}", requestBody.replace(clientSecret, "***"));
            
            URL url = new URL(tokenUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
            
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line);
                }
                throw new RuntimeException("Error al intercambiar código por tokens: " + responseCode + " - " + errorResponse.toString());
            }
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            
            log.info("Respuesta de Tienda Nube (token exchange): {}", response.toString().replace(clientSecret, "***"));
            
            // Usar el mapper ya declarado arriba
            JsonNode jsonResponse = mapper.readTree(response.toString());
            
            String accessToken = jsonResponse.get("access_token").asText();
            String refreshToken = jsonResponse.get("refresh_token") != null ? jsonResponse.get("refresh_token").asText() : null;
            int expiresIn = jsonResponse.get("expires_in") != null ? jsonResponse.get("expires_in").asInt() : 3600;
            
            // El user_id en la respuesta del token exchange es el store_id según la documentación de Tienda Nube
            String storeId = null;
            if (jsonResponse.has("user_id")) {
                storeId = jsonResponse.get("user_id").asText();
                log.info("Store ID obtenido del token exchange (user_id): {}", storeId);
            } else {
                // Fallback: intentar obtenerlo de /v1/store si no está en la respuesta del token
                log.warn("No se encontró user_id en la respuesta del token, intentando obtenerlo de /v1/store");
                String storeInfoUrl = "https://api.tiendanube.com/v1/store";
                URL storeUrl = new URL(storeInfoUrl);
                HttpURLConnection storeConn = (HttpURLConnection) storeUrl.openConnection();
                storeConn.setRequestMethod("GET");
                // Tienda Nube usa "Authentication" no "Authorization" según su documentación
                storeConn.setRequestProperty("Authentication", "bearer " + accessToken);
                storeConn.setRequestProperty("User-Agent", "TMS-Llegue (contacto@zetallegue.com)");
                
                log.info("Obteniendo información de la tienda desde: {}", storeInfoUrl);
                
                int storeResponseCode = storeConn.getResponseCode();
                if (storeResponseCode == 200) {
                    BufferedReader storeReader = new BufferedReader(new InputStreamReader(storeConn.getInputStream()));
                    StringBuilder storeResponse = new StringBuilder();
                    while ((line = storeReader.readLine()) != null) {
                        storeResponse.append(line);
                    }
                    
                    JsonNode storeInfo = mapper.readTree(storeResponse.toString());
                    log.info("Información de la tienda recibida: {}", storeInfo.toString());
                    // La API de Tienda Nube puede devolver el ID en diferentes campos
                    if (storeInfo.has("id")) {
                        storeId = storeInfo.get("id").asText();
                    } else if (storeInfo.has("store_id")) {
                        storeId = storeInfo.get("store_id").asText();
                    } else if (storeInfo.has("shop_id")) {
                        storeId = storeInfo.get("shop_id").asText();
                    } else {
                        java.util.Iterator<String> fieldNames = storeInfo.fieldNames();
                        java.util.ArrayList<String> fieldList = new java.util.ArrayList<>();
                        while (fieldNames.hasNext()) {
                            fieldList.add(fieldNames.next());
                        }
                        log.warn("No se encontró el ID de la tienda en la respuesta. Campos disponibles: {}", 
                            fieldList.isEmpty() ? "ninguno" : String.join(", ", fieldList));
                    }
                } else {
                    log.warn("Error al obtener información de la tienda: código de respuesta {}", storeResponseCode);
                }
            }
            
            // Calcular fecha de expiración
            java.time.LocalDateTime expiresAt = java.time.LocalDateTime.now().plusSeconds(expiresIn);
            
            // Actualizar el cliente con los tokens
            cliente.setTiendanubeAccessToken(accessToken);
            if (refreshToken != null && !refreshToken.isEmpty()) {
                cliente.setTiendanubeRefreshToken(refreshToken);
            }
            cliente.setTiendanubeTokenExpiresAt(expiresAt);
            if (storeId != null) {
                cliente.setTiendanubeStoreId(storeId);
            }
            cliente = clienteRepository.save(cliente);
            
            log.info("Cuenta de Tienda Nube vinculada exitosamente para cliente {}", clienteId);
            
            return toDTO(cliente);
        } catch (Exception e) {
            log.error("Error al procesar callback de Tienda Nube: {}", e.getMessage(), e);
            throw new RuntimeException("Error al vincular cuenta de Tienda Nube: " + e.getMessage(), e);
        }
    }

    /**
     * Genera el link de vinculación para Shopify
     */
    @Transactional
    public String generarLinkVinculacionShopify(Long clienteId, String baseUrlParam) {
        // Validar que el cliente existe
        if (!clienteRepository.existsById(clienteId)) {
            throw new RuntimeException("Cliente no encontrado con id: " + clienteId);
        }
        
        Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getShopifyUrl() == null || cliente.getShopifyUrl().trim().isEmpty()) {
            throw new RuntimeException("El cliente debe tener una URL de Shopify configurada");
        }
        
        // Generar un token único para esta solicitud de vinculación
        String token = clienteId + "_" + java.util.UUID.randomUUID().toString();
        
        // Construir el link de autorización
        String baseUrl = baseUrlParam;
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = System.getenv("FRONTEND_BASE_URL");
        }
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = "http://localhost:3000";
        }
        
        // Construir la URL de autorización de Shopify
        String authUrl = baseUrl + "/auth/shopify?token=" + token + "&clienteId=" + clienteId;
        
        log.info("Link de vinculación Shopify generado para cliente {}: {}", clienteId, authUrl);
        
        return authUrl;
    }

    /**
     * Genera la URL de autorización para Shopify OAuth
     */
    @Transactional(readOnly = true)
    public String generarUrlAutorizacionShopify(Long clienteId, String token) {
        Cliente cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        if (cliente.getShopifyUrl() == null || cliente.getShopifyUrl().trim().isEmpty()) {
            throw new RuntimeException("El cliente debe tener una URL de Shopify configurada");
        }
        
        // Obtener credenciales de Shopify desde configuración
        String clientId = System.getenv("SHOPIFY_CLIENT_ID");
        if (clientId == null || clientId.isEmpty()) {
            clientId = environment.getProperty("shopify.client.id");
        }
        if (clientId == null || clientId.isEmpty()) {
            throw new RuntimeException("SHOPIFY_CLIENT_ID no configurado. Configure las credenciales en application.properties (shopify.client.id).");
        }
        
        String redirectUri = System.getenv("SHOPIFY_REDIRECT_URI");
        if (redirectUri == null || redirectUri.isEmpty()) {
            redirectUri = environment.getProperty("shopify.redirect.uri");
        }
        if (redirectUri == null || redirectUri.isEmpty()) {
            throw new RuntimeException("SHOPIFY_REDIRECT_URI no configurado. Configure en application.properties (shopify.redirect.uri).");
        }
        
        // Extraer shop name de la URL
        String shopName = extraerShopName(cliente.getShopifyUrl());
        if (shopName == null || shopName.isEmpty()) {
            throw new RuntimeException("No se pudo extraer el shop name de la URL: " + cliente.getShopifyUrl());
        }
        
        // Construir la URL de autorización de Shopify
        // Formato: https://{shop}.myshopify.com/admin/oauth/authorize
        String authUrl = String.format("https://%s.myshopify.com/admin/oauth/authorize", shopName);
        
        // Scopes necesarios (deben coincidir con los configurados en la versión de la app)
        String scopes = "read_orders,read_customers,read_shipping,read_fulfillments";
        
        // Construir la URL con los parámetros OAuth
        String redirectUriEncoded = java.net.URLEncoder.encode(redirectUri, StandardCharsets.UTF_8);
        String scopesEncoded = java.net.URLEncoder.encode(scopes, StandardCharsets.UTF_8);
        String state = clienteId + "_" + token; // Formato: clienteId_token
        
        String fullAuthUrl = String.format(
            "%s?client_id=%s&scope=%s&redirect_uri=%s&state=%s",
            authUrl,
            clientId,
            scopesEncoded,
            redirectUriEncoded,
            state
        );
        
        log.info("URL de autorización Shopify generada para cliente {}: {}", clienteId, fullAuthUrl);
        
        return fullAuthUrl;
    }

    /**
     * Extrae el shop name de la URL de Shopify
     */
    private String extraerShopName(String shopifyUrl) {
        if (shopifyUrl == null || shopifyUrl.trim().isEmpty()) {
            return null;
        }
        
        try {
            String url = shopifyUrl.trim();
            if (url.startsWith("http://")) {
                url = url.substring(7);
            } else if (url.startsWith("https://")) {
                url = url.substring(8);
            }
            
            if (url.startsWith("www.")) {
                url = url.substring(4);
            }
            
            if (url.contains(".myshopify.com")) {
                return url.split("\\.myshopify\\.com")[0];
            }
            
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
     * Procesa el callback de OAuth de Shopify
     */
    @Transactional
    public ClienteDTO procesarCallbackShopify(String code, String state, String shop, String hmac, java.util.Map<String, String> params) {
        try {
            // Validar HMAC (seguridad de Shopify)
            if (!validarHmacShopify(params, hmac)) {
                throw new RuntimeException("HMAC inválido - posible ataque de seguridad");
            }
            
            // Extraer clienteId del state (formato: clienteId_token)
            Long clienteId;
            try {
                String[] parts = state.split("_", 2);
                if (parts.length < 1) {
                    throw new RuntimeException("State inválido: no contiene clienteId");
                }
                clienteId = Long.parseLong(parts[0]);
            } catch (NumberFormatException e) {
                throw new RuntimeException("State inválido: no se puede extraer clienteId", e);
            }
            
            Cliente cliente = clienteRepository.findById(clienteId)
                    .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
            
            // Obtener credenciales de Shopify
            String clientId = System.getenv("SHOPIFY_CLIENT_ID");
            if (clientId == null || clientId.isEmpty()) {
                clientId = environment.getProperty("shopify.client.id");
            }
            if (clientId == null || clientId.isEmpty()) {
                throw new RuntimeException("SHOPIFY_CLIENT_ID no configurado");
            }
            
            String clientSecret = System.getenv("SHOPIFY_CLIENT_SECRET");
            if (clientSecret == null || clientSecret.isEmpty()) {
                clientSecret = environment.getProperty("shopify.client.secret");
            }
            if (clientSecret == null || clientSecret.isEmpty()) {
                throw new RuntimeException("SHOPIFY_CLIENT_SECRET no configurado");
            }
            
            String redirectUri = System.getenv("SHOPIFY_REDIRECT_URI");
            if (redirectUri == null || redirectUri.isEmpty()) {
                redirectUri = environment.getProperty("shopify.redirect.uri");
            }
            if (redirectUri == null || redirectUri.isEmpty()) {
                throw new RuntimeException("SHOPIFY_REDIRECT_URI no configurado");
            }
            
            // Intercambiar código por access token
            String tokenUrl = String.format("https://%s/admin/oauth/access_token", shop);
            
            // Construir el request body (Shopify usa form-urlencoded, no JSON)
            String requestBody = String.format(
                "client_id=%s&client_secret=%s&code=%s",
                java.net.URLEncoder.encode(clientId, StandardCharsets.UTF_8),
                java.net.URLEncoder.encode(clientSecret, StandardCharsets.UTF_8),
                java.net.URLEncoder.encode(code, StandardCharsets.UTF_8)
            );
            
            log.info("Intercambiando código por access token en Shopify...");
            log.info("Token URL: {}", tokenUrl);
            log.info("Shop: {}", shop);
            
            URL url = new URL(tokenUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setDoOutput(true);
            
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }
            
            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line);
                }
                throw new RuntimeException("Error al intercambiar código por tokens: " + responseCode + " - " + errorResponse.toString());
            }
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            
            log.info("Respuesta de Shopify (token exchange): {}", response.toString().replace(clientSecret, "***"));
            
            ObjectMapper mapper = new ObjectMapper();
            JsonNode jsonResponse = mapper.readTree(response.toString());
            
            String accessToken = jsonResponse.get("access_token").asText();
            
            // Actualizar el cliente con el access token
            cliente.setShopifyClaveUnica(accessToken);
            cliente = clienteRepository.save(cliente);
            
            log.info("Cuenta de Shopify vinculada exitosamente para cliente {}", clienteId);
            
            return toDTO(cliente);
        } catch (Exception e) {
            log.error("Error al procesar callback de Shopify: {}", e.getMessage(), e);
            throw new RuntimeException("Error al vincular cuenta de Shopify: " + e.getMessage(), e);
        }
    }

    /**
     * Valida el HMAC de Shopify para seguridad
     * Shopify calcula el HMAC usando todos los parámetros (excepto hmac y signature) ordenados alfabéticamente
     */
    private boolean validarHmacShopify(java.util.Map<String, String> params, String hmac) {
        if (hmac == null || hmac.isEmpty()) {
            log.warn("HMAC no proporcionado en el callback de Shopify");
            return false;
        }
        
        // Obtener el client secret
        String clientSecret = System.getenv("SHOPIFY_CLIENT_SECRET");
        if (clientSecret == null || clientSecret.isEmpty()) {
            clientSecret = environment.getProperty("shopify.client.secret");
        }
        if (clientSecret == null || clientSecret.isEmpty()) {
            log.warn("SHOPIFY_CLIENT_SECRET no configurado, no se puede validar HMAC");
            return false;
        }
        
        try {
            // Ordenar parámetros alfabéticamente por nombre
            java.util.List<String> sortedKeys = new java.util.ArrayList<>(params.keySet());
            java.util.Collections.sort(sortedKeys);
            
            // Construir el mensaje: "code=XXX&shop=YYY&state=ZZZ&timestamp=AAA"
            StringBuilder messageBuilder = new StringBuilder();
            for (int i = 0; i < sortedKeys.size(); i++) {
                if (i > 0) {
                    messageBuilder.append("&");
                }
                String key = sortedKeys.get(i);
                String value = params.get(key);
                // Codificar el valor según Shopify (URL encoding)
                messageBuilder.append(key).append("=").append(java.net.URLEncoder.encode(value, StandardCharsets.UTF_8));
            }
            String message = messageBuilder.toString();
            
            log.debug("Mensaje para validar HMAC: {}", message);
            
            // Calcular HMAC-SHA256
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            javax.crypto.spec.SecretKeySpec secretKeySpec = new javax.crypto.spec.SecretKeySpec(
                clientSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            
            // Convertir bytes a hexadecimal
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            String calculatedHmac = hexString.toString();
            
            boolean isValid = calculatedHmac.equals(hmac.toLowerCase());
            if (!isValid) {
                log.warn("HMAC no coincide. Calculado: {}, Recibido: {}, Mensaje: {}", calculatedHmac, hmac, message);
            } else {
                log.info("HMAC validado correctamente");
            }
            return isValid;
        } catch (Exception e) {
            log.error("Error al validar HMAC de Shopify: {}", e.getMessage(), e);
            return false;
        }
    }
}

