package com.zetallegue.tms.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.zetallegue.tms.dto.ClienteDTO;
import com.zetallegue.tms.dto.ClienteFilterDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.service.ClienteService;
import com.zetallegue.tms.service.TiendaNubeService;
import com.zetallegue.tms.service.VtexService;
import com.zetallegue.tms.service.ShopifyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clientes")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ClienteController {

    private final ClienteService clienteService;
    private final TiendaNubeService tiendaNubeService;
    private final VtexService vtexService;
    private final ShopifyService shopifyService;

    @GetMapping
    public ResponseEntity<PageResponseDTO<ClienteDTO>> buscarClientes(
            @RequestParam(required = false) String codigo,
            @RequestParam(required = false) String nombreFantasia,
            @RequestParam(required = false) String razonSocial,
            @RequestParam(required = false) String numeroDocumento,
            @RequestParam(required = false, defaultValue = "todos") String habilitado,
            @RequestParam(required = false) String integraciones,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "10") Integer size
    ) {
        ClienteFilterDTO filter = new ClienteFilterDTO();
        filter.setCodigo(codigo);
        filter.setNombreFantasia(nombreFantasia);
        filter.setRazonSocial(razonSocial);
        filter.setNumeroDocumento(numeroDocumento);
        filter.setHabilitado(habilitado);
        filter.setIntegraciones(integraciones);
        filter.setPage(page);
        filter.setSize(size);
        PageResponseDTO<ClienteDTO> response = clienteService.buscarClientes(filter);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteDTO> obtenerCliente(@PathVariable Long id) {
        ClienteDTO cliente = clienteService.obtenerClientePorId(id);
        return ResponseEntity.ok(cliente);
    }

    @PostMapping
    public ResponseEntity<ClienteDTO> crearCliente(@Valid @RequestBody ClienteDTO clienteDTO) {
        ClienteDTO cliente = clienteService.crearCliente(clienteDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(cliente);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClienteDTO> actualizarCliente(
            @PathVariable Long id,
            @Valid @RequestBody ClienteDTO clienteDTO
    ) {
        ClienteDTO cliente = clienteService.actualizarCliente(id, clienteDTO);
        return ResponseEntity.ok(cliente);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarCliente(@PathVariable Long id) {
        clienteService.eliminarCliente(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/toggle-habilitado")
    public ResponseEntity<ClienteDTO> toggleHabilitado(@PathVariable Long id) {
        ClienteDTO cliente = clienteService.toggleHabilitado(id);
        return ResponseEntity.ok(cliente);
    }

    @GetMapping("/{id}/flex/link-vinculacion")
    public ResponseEntity<LinkVinculacionResponse> generarLinkVinculacion(
            @PathVariable Long id,
            @RequestParam(required = false) String baseUrl) {
        String link = clienteService.generarLinkVinculacionFlex(id, baseUrl);
        return ResponseEntity.ok(new LinkVinculacionResponse(link));
    }

    @GetMapping("/{id}/flex/auth-url")
    public ResponseEntity<AuthUrlResponse> generarUrlAutorizacion(
            @PathVariable Long id,
            @RequestParam String token,
            @RequestParam(defaultValue = "false") boolean fulfillment) {
        String authUrl = clienteService.generarUrlAutorizacionFlex(id, token, fulfillment);
        return ResponseEntity.ok(new AuthUrlResponse(authUrl));
    }

    @GetMapping("/flex/callback")
    public ResponseEntity<CallbackResponse> procesarCallback(
            @RequestParam String code,
            @RequestParam String state) {
        try {
            ClienteDTO cliente = clienteService.procesarCallbackFlex(code, state);
            return ResponseEntity.ok(new CallbackResponse("Cuenta vinculada exitosamente", cliente));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new CallbackResponse("Error: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}/tiendanube/link-vinculacion")
    public ResponseEntity<LinkVinculacionResponse> generarLinkVinculacionTiendaNube(
            @PathVariable Long id,
            @RequestParam(required = false) String baseUrl) {
        String link = clienteService.generarLinkVinculacionTiendaNube(id, baseUrl);
        return ResponseEntity.ok(new LinkVinculacionResponse(link));
    }

    @GetMapping("/{id}/tiendanube/auth-url")
    public ResponseEntity<AuthUrlResponse> generarUrlAutorizacionTiendaNube(
            @PathVariable Long id,
            @RequestParam String token) {
        String authUrl = clienteService.generarUrlAutorizacionTiendaNube(id, token);
        return ResponseEntity.ok(new AuthUrlResponse(authUrl));
    }

    @GetMapping("/tiendanube/callback")
    public ResponseEntity<CallbackResponse> procesarCallbackTiendaNube(
            @RequestParam String code,
            @RequestParam String state) {
        try {
            ClienteDTO cliente = clienteService.procesarCallbackTiendaNube(code, state);
            return ResponseEntity.ok(new CallbackResponse("Cuenta vinculada exitosamente", cliente));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new CallbackResponse("Error: " + e.getMessage(), null));
        }
    }

    @GetMapping("/tiendanube/pedidos")
    public ResponseEntity<List<JsonNode>> obtenerPedidosTiendaNube(
            @RequestParam(required = false) Long clienteId) {
        try {
            List<JsonNode> pedidos;
            if (clienteId != null) {
                // Obtener pedidos de un cliente específico
                pedidos = tiendaNubeService.obtenerPedidosTiendaNube(clienteId);
            } else {
                // Obtener pedidos de todos los clientes vinculados
                pedidos = tiendaNubeService.obtenerTodosLosPedidosTiendaNube();
            }
            return ResponseEntity.ok(pedidos);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/vtex/pedidos")
    public ResponseEntity<List<JsonNode>> obtenerPedidosVtex(
            @RequestParam(required = false) Long clienteId) {
        try {
            List<JsonNode> pedidos;
            if (clienteId != null) {
                // Obtener pedidos de un cliente específico
                pedidos = vtexService.obtenerPedidosVtex(clienteId);
            } else {
                // Obtener pedidos de todos los clientes vinculados
                pedidos = vtexService.obtenerTodosLosPedidosVtex();
            }
            return ResponseEntity.ok(pedidos);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/shopify/pedidos")
    public ResponseEntity<List<JsonNode>> obtenerPedidosShopify(
            @RequestParam(required = false) Long clienteId) {
        try {
            List<JsonNode> pedidos;
            if (clienteId != null) {
                // Obtener pedidos de un cliente específico
                pedidos = shopifyService.obtenerPedidosShopify(clienteId);
            } else {
                // Obtener pedidos de todos los clientes vinculados
                pedidos = shopifyService.obtenerTodosLosPedidosShopify();
            }
            return ResponseEntity.ok(pedidos);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/{id}/shopify/link-vinculacion")
    public ResponseEntity<LinkVinculacionResponse> generarLinkVinculacionShopify(
            @PathVariable Long id,
            @RequestParam(required = false) String baseUrl) {
        String link = clienteService.generarLinkVinculacionShopify(id, baseUrl);
        return ResponseEntity.ok(new LinkVinculacionResponse(link));
    }

    @GetMapping("/{id}/shopify/auth-url")
    public ResponseEntity<AuthUrlResponse> generarUrlAutorizacionShopify(
            @PathVariable Long id,
            @RequestParam String token) {
        String authUrl = clienteService.generarUrlAutorizacionShopify(id, token);
        return ResponseEntity.ok(new AuthUrlResponse(authUrl));
    }

    @GetMapping("/shopify/callback")
    public ResponseEntity<CallbackResponse> procesarCallbackShopify(
            @RequestParam String code,
            @RequestParam String state,
            @RequestParam String shop,
            @RequestParam String hmac,
            @RequestParam(required = false) String timestamp,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            // Obtener todos los parámetros de la query string para validar HMAC
            java.util.Map<String, String> params = new java.util.HashMap<>();
            request.getParameterMap().forEach((key, values) -> {
                if (!key.equals("hmac") && !key.equals("signature")) {
                    if (values != null && values.length > 0) {
                        params.put(key, values[0]);
                    }
                }
            });
            
            ClienteDTO cliente = clienteService.procesarCallbackShopify(code, state, shop, hmac, params);
            return ResponseEntity.ok(new CallbackResponse("Cuenta vinculada exitosamente", cliente));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new CallbackResponse("Error: " + e.getMessage(), null));
        }
    }

    public static class LinkVinculacionResponse {
        private String link;

        public LinkVinculacionResponse(String link) {
            this.link = link;
        }

        public String getLink() {
            return link;
        }

        public void setLink(String link) {
            this.link = link;
        }
    }

    public static class AuthUrlResponse {
        private String authUrl;

        public AuthUrlResponse(String authUrl) {
            this.authUrl = authUrl;
        }

        public String getAuthUrl() {
            return authUrl;
        }

        public void setAuthUrl(String authUrl) {
            this.authUrl = authUrl;
        }
    }

    public static class CallbackResponse {
        private String message;
        private ClienteDTO cliente;

        public CallbackResponse(String message, ClienteDTO cliente) {
            this.message = message;
            this.cliente = cliente;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public ClienteDTO getCliente() {
            return cliente;
        }

        public void setCliente(ClienteDTO cliente) {
            this.cliente = cliente;
        }
    }
}

