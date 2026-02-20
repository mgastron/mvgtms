package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.EnvioDTO;
import com.zetallegue.tms.dto.EnvioFilterDTO;
import com.zetallegue.tms.dto.HistorialEnvioDTO;
import com.zetallegue.tms.dto.ObservacionEnvioDTO;
import com.zetallegue.tms.dto.ImagenEnvioDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.service.EnvioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/envios")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class EnvioController {

    private final EnvioService envioService;
    private final com.zetallegue.tms.service.EnvioServiceTiendaNube envioServiceTiendaNube;
    private final com.zetallegue.tms.service.EnvioServiceVtex envioServiceVtex;
    private final com.zetallegue.tms.service.EnvioServiceShopify envioServiceShopify;

    @GetMapping
    public ResponseEntity<PageResponseDTO<EnvioDTO>> buscarEnvios(EnvioFilterDTO filter) {
        PageResponseDTO<EnvioDTO> response = envioService.buscarEnvios(filter);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/exportar")
    public ResponseEntity<List<EnvioDTO>> exportarEnvios(EnvioFilterDTO filter) {
        // Para exportación, obtener todos los envíos sin paginación
        List<EnvioDTO> envios = envioService.buscarTodosLosEnvios(filter);
        return ResponseEntity.ok(envios);
    }

    @GetMapping("/recientes")
    public ResponseEntity<List<EnvioDTO>> obtenerEnviosRecientes() {
        List<EnvioDTO> envios = envioService.obtenerEnviosUltimaSemana();
        return ResponseEntity.ok(envios);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EnvioDTO> obtenerEnvioPorId(@PathVariable Long id) {
        EnvioDTO envio = envioService.obtenerEnvioPorId(id);
        return ResponseEntity.ok(envio);
    }

    @GetMapping("/tracking/{token}")
    public ResponseEntity<EnvioDTO> obtenerEnvioPorToken(@PathVariable String token) {
        EnvioDTO envio = envioService.obtenerEnvioPorToken(token);
        if (envio == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(envio);
    }

    @GetMapping("/buscar-por-tracking/{tracking}")
    public ResponseEntity<Map<String, String>> buscarPorTracking(@PathVariable String tracking) {
        java.util.Optional<com.zetallegue.tms.model.Envio> envioOpt = envioService.findByTracking(tracking);
        if (envioOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        com.zetallegue.tms.model.Envio envio = envioOpt.get();
        String trackingToken = envio.getTrackingToken();
        if (trackingToken == null || trackingToken.trim().isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("trackingToken", trackingToken));
    }

    @PostMapping
    public ResponseEntity<EnvioDTO> crearEnvio(@RequestBody EnvioDTO envioDTO) {
        EnvioDTO envio = envioService.crearEnvio(envioDTO);
        return ResponseEntity.ok(envio);
    }

    @PostMapping("/masivos")
    public ResponseEntity<List<EnvioDTO>> crearEnviosMasivos(@RequestBody List<EnvioDTO> enviosDTO) {
        List<EnvioDTO> envios = envioService.crearEnviosMasivos(enviosDTO);
        return ResponseEntity.ok(envios);
    }

    @PostMapping("/crear-desde-tiendanube")
    public ResponseEntity<?> crearEnvioDesdeTiendaNube(@RequestBody CrearEnvioTiendaNubeRequest request) {
        try {
            log.info("=== RECIBIDA PETICIÓN CREAR ENVÍO DESDE TIENDA NUBE ===");
            
            if (request == null) {
                log.error("Request body es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Request body es requerido"));
            }
            
            if (request.getClienteId() == null) {
                log.error("Cliente ID es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Cliente ID es requerido"));
            }
            
            if (request.getPedido() == null) {
                log.error("Pedido es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Pedido es requerido"));
            }
            
            log.info("Cliente ID: {}", request.getClienteId());
            log.info("Pedido recibido (primeros 500 caracteres): {}", 
                request.getPedido().toString().length() > 500 
                    ? request.getPedido().toString().substring(0, 500) + "..." 
                    : request.getPedido().toString());
            
            EnvioDTO envio = envioServiceTiendaNube.crearEnvioDesdeTiendaNube(request.getPedido(), request.getClienteId());
            log.info("Envío creado exitosamente - ID: {}, Tracking: {}, Origen: {}, FechaLlegue: {}", 
                envio.getId(), envio.getTracking(), envio.getOrigen(), envio.getFechaLlegue());
            return ResponseEntity.ok(envio);
        } catch (Exception e) {
            log.error("Error al crear envío desde Tienda Nube: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error desconocido"));
        }
    }

    @PostMapping("/crear-desde-vtex")
    public ResponseEntity<?> crearEnvioDesdeVtex(@RequestBody CrearEnvioVtexRequest request) {
        try {
            log.info("=== RECIBIDA PETICIÓN CREAR ENVÍO DESDE VTEX ===");
            
            if (request == null) {
                log.error("Request body es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Request body es requerido"));
            }
            
            if (request.getClienteId() == null) {
                log.error("Cliente ID es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Cliente ID es requerido"));
            }
            
            if (request.getPedido() == null) {
                log.error("Pedido es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Pedido es requerido"));
            }
            
            log.info("Cliente ID: {}", request.getClienteId());
            log.info("Pedido recibido (primeros 500 caracteres): {}", 
                request.getPedido().toString().length() > 500 
                    ? request.getPedido().toString().substring(0, 500) + "..." 
                    : request.getPedido().toString());
            
            EnvioDTO envio = envioServiceVtex.crearEnvioDesdeVtex(request.getPedido(), request.getClienteId());
            log.info("Envío creado exitosamente - ID: {}, Tracking: {}, Origen: {}, FechaLlegue: {}", 
                envio.getId(), envio.getTracking(), envio.getOrigen(), envio.getFechaLlegue());
            return ResponseEntity.ok(envio);
        } catch (Exception e) {
            log.error("Error al crear envío desde VTEX: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error desconocido"));
        }
    }

    @PostMapping("/crear-desde-shopify")
    public ResponseEntity<?> crearEnvioDesdeShopify(@RequestBody CrearEnvioShopifyRequest request) {
        try {
            log.info("=== RECIBIDA PETICIÓN CREAR ENVÍO DESDE SHOPIFY ===");
            
            if (request == null) {
                log.error("Request body es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Request body es requerido"));
            }
            
            if (request.getClienteId() == null) {
                log.error("Cliente ID es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Cliente ID es requerido"));
            }
            
            if (request.getPedido() == null) {
                log.error("Pedido es null");
                return ResponseEntity.badRequest().body(Map.of("error", "Pedido es requerido"));
            }
            
            log.info("Cliente ID: {}", request.getClienteId());
            log.info("Pedido recibido (primeros 500 caracteres): {}", 
                request.getPedido().toString().length() > 500 
                    ? request.getPedido().toString().substring(0, 500) + "..." 
                    : request.getPedido().toString());
            
            EnvioDTO envio = envioServiceShopify.crearEnvioDesdeShopify(request.getPedido(), request.getClienteId());
            log.info("Envío creado exitosamente - ID: {}, Tracking: {}, Origen: {}, FechaLlegue: {}", 
                envio.getId(), envio.getTracking(), envio.getOrigen(), envio.getFechaLlegue());
            return ResponseEntity.ok(envio);
        } catch (Exception e) {
            log.error("Error al crear envío desde Shopify: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error desconocido"));
        }
    }

    public static class CrearEnvioTiendaNubeRequest {
        private com.fasterxml.jackson.databind.JsonNode pedido;
        private Long clienteId;

        public com.fasterxml.jackson.databind.JsonNode getPedido() { return pedido; }
        public void setPedido(com.fasterxml.jackson.databind.JsonNode pedido) { this.pedido = pedido; }
        public Long getClienteId() { return clienteId; }
        public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    }

    public static class CrearEnvioVtexRequest {
        private com.fasterxml.jackson.databind.JsonNode pedido;
        private Long clienteId;

        public com.fasterxml.jackson.databind.JsonNode getPedido() { return pedido; }
        public void setPedido(com.fasterxml.jackson.databind.JsonNode pedido) { this.pedido = pedido; }
        public Long getClienteId() { return clienteId; }
        public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    }

    public static class CrearEnvioShopifyRequest {
        private com.fasterxml.jackson.databind.JsonNode pedido;
        private Long clienteId;

        public com.fasterxml.jackson.databind.JsonNode getPedido() { return pedido; }
        public void setPedido(com.fasterxml.jackson.databind.JsonNode pedido) { this.pedido = pedido; }
        public Long getClienteId() { return clienteId; }
        public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    }

    @PutMapping("/{id}")
    public ResponseEntity<EnvioDTO> actualizarEnvio(@PathVariable Long id, @RequestBody EnvioDTO envioDTO) {
        EnvioDTO envio = envioService.actualizarEnvio(id, envioDTO);
        return ResponseEntity.ok(envio);
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<EnvioDTO> actualizarEstado(
            @PathVariable Long id,
            @RequestBody ActualizarEstadoRequest request) {
        EnvioDTO envio = envioService.actualizarEstado(
                id,
                request.getEstado(),
                request.getUsuarioNombre(),
                request.getObservaciones(),
                request.getFoto(),
                request.getRolRecibio(),
                request.getNombreRecibio(),
                request.getDniRecibio()
        );
        return ResponseEntity.ok(envio);
    }

    // Clase interna para el request
    public static class ActualizarEstadoRequest {
        private String estado;
        private String usuarioNombre;
        private String observaciones;
        private String foto;
        private String rolRecibio;
        private String nombreRecibio;
        private String dniRecibio;

        public String getEstado() { return estado; }
        public void setEstado(String estado) { this.estado = estado; }
        public String getUsuarioNombre() { return usuarioNombre; }
        public void setUsuarioNombre(String usuarioNombre) { this.usuarioNombre = usuarioNombre; }
        public String getObservaciones() { return observaciones; }
        public void setObservaciones(String observaciones) { this.observaciones = observaciones; }
        public String getFoto() { return foto; }
        public void setFoto(String foto) { this.foto = foto; }
        public String getRolRecibio() { return rolRecibio; }
        public void setRolRecibio(String rolRecibio) { this.rolRecibio = rolRecibio; }
        public String getNombreRecibio() { return nombreRecibio; }
        public void setNombreRecibio(String nombreRecibio) { this.nombreRecibio = nombreRecibio; }
        public String getDniRecibio() { return dniRecibio; }
        public void setDniRecibio(String dniRecibio) { this.dniRecibio = dniRecibio; }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarEnvio(@PathVariable Long id) {
        envioService.eliminarEnvio(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/qr/{qrData}")
    public ResponseEntity<EnvioDTO> buscarEnvioPorQR(@PathVariable String qrData) {
        log.info("=== BUSCAR ENVÍO POR QR ===");
        log.info("QR Data: {}", qrData);
        try {
            EnvioDTO envio = envioService.buscarEnvioPorQR(qrData);
            if (envio == null) {
                log.warn("Envío no encontrado para QR: {}", qrData);
                return ResponseEntity.notFound().build();
            }
            log.info("Envío encontrado: ID {}", envio.getId());
            return ResponseEntity.ok(envio);
        } catch (Exception e) {
            log.error("Error al buscar envío por QR: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/colectar")
    public ResponseEntity<EnvioDTO> colectarEnvio(
            @PathVariable Long id,
            @RequestBody(required = false) String usuarioNombre) {
        try {
            EnvioDTO envio = envioService.colectarEnvio(id, usuarioNombre != null ? usuarioNombre : "Usuario");
            return ResponseEntity.ok(envio);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @PostMapping("/colectar-flex")
    public ResponseEntity<?> colectarEnvioFlex(
            @RequestBody(required = false) ColectarFlexRequest request) {
        log.info("=== RECIBIDA PETICIÓN COLECTAR-FLEX ===");
        
        if (request == null) {
            log.error("Request body es null");
            return ResponseEntity.badRequest().body(Map.of("error", "Request body es requerido"));
        }
        
        log.info("QR Data recibido: {}", request.getQrData());
        log.info("Usuario: {}", request.getUsuarioNombre());
        
        if (request.getQrData() == null || request.getQrData().trim().isEmpty()) {
            log.error("QR Data está vacío");
            return ResponseEntity.badRequest().body(Map.of("error", "QR data es requerido"));
        }
        
        try {
            EnvioDTO envio = envioService.colectarEnvioFlex(
                request.getQrData(), 
                request.getUsuarioNombre() != null ? request.getUsuarioNombre() : "Usuario"
            );
            log.info("Envío colectado exitosamente: ID {}", envio.getId());
            return ResponseEntity.ok(envio);
        } catch (RuntimeException e) {
            log.error("Error al colectar envío Flex: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error inesperado al colectar envío Flex: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Error interno del servidor: " + e.getMessage()));
        }
    }
    
    @PostMapping("/subir-flex-manual")
    public ResponseEntity<?> subirFlexManual(
            @RequestBody(required = false) SubirFlexManualRequest request) {
        log.info("=== RECIBIDA PETICIÓN SUBIR FLEX MANUAL ===");
        
        if (request == null) {
            log.error("Request body es null");
            return ResponseEntity.badRequest().body(Map.of("error", "Request body es requerido"));
        }
        
        log.info("Seller ID recibido: {}", request.getSellerId());
        log.info("Shipment ID recibido: {}", request.getShipmentId());
        
        if (request.getSellerId() == null || request.getSellerId().trim().isEmpty()) {
            log.error("Seller ID está vacío");
            return ResponseEntity.badRequest().body(Map.of("error", "Seller ID es requerido"));
        }
        
        if (request.getShipmentId() == null || request.getShipmentId().trim().isEmpty()) {
            log.error("Shipment ID está vacío");
            return ResponseEntity.badRequest().body(Map.of("error", "Shipment ID es requerido"));
        }
        
        try {
            EnvioDTO envio = envioService.subirFlexManual(
                request.getSellerId(),
                request.getShipmentId(),
                request.getUsuarioNombre() != null ? request.getUsuarioNombre() : "Usuario"
            );
            log.info("Envío Flex subido exitosamente: ID {}", envio.getId());
            return ResponseEntity.ok(envio);
        } catch (RuntimeException e) {
            log.error("Error al subir envío Flex manual: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error inesperado al subir envío Flex manual: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Error interno del servidor"));
        }
    }
    
    // Clase interna para el request
    public static class ColectarFlexRequest {
        private String qrData;
        private String usuarioNombre;

        public String getQrData() { return qrData; }
        public void setQrData(String qrData) { this.qrData = qrData; }
        public String getUsuarioNombre() { return usuarioNombre; }
        public void setUsuarioNombre(String usuarioNombre) { this.usuarioNombre = usuarioNombre; }
    }
    
    // Clase interna para el request de subida manual
    public static class SubirFlexManualRequest {
        private String sellerId;
        private String shipmentId;
        private String usuarioNombre;

        public String getSellerId() { return sellerId; }
        public void setSellerId(String sellerId) { this.sellerId = sellerId; }
        public String getShipmentId() { return shipmentId; }
        public void setShipmentId(String shipmentId) { this.shipmentId = shipmentId; }
        public String getUsuarioNombre() { return usuarioNombre; }
        public void setUsuarioNombre(String usuarioNombre) { this.usuarioNombre = usuarioNombre; }
    }

    @GetMapping("/{id}/historial")
    public ResponseEntity<List<HistorialEnvioDTO>> obtenerHistorialEnvio(@PathVariable Long id) {
        List<HistorialEnvioDTO> historial = envioService.obtenerHistorialEnvio(id);
        return ResponseEntity.ok(historial);
    }
    
    @GetMapping("/{id}/observaciones")
    public ResponseEntity<List<ObservacionEnvioDTO>> obtenerObservacionesEnvio(@PathVariable Long id) {
        List<ObservacionEnvioDTO> observaciones = envioService.obtenerObservacionesEnvio(id);
        return ResponseEntity.ok(observaciones);
    }
    
    @GetMapping("/{id}/imagenes")
    public ResponseEntity<List<ImagenEnvioDTO>> obtenerImagenesEnvio(@PathVariable Long id) {
        List<ImagenEnvioDTO> imagenes = envioService.obtenerImagenesEnvio(id);
        return ResponseEntity.ok(imagenes);
    }

    @GetMapping("/chofer/{choferId}/ruta")
    public ResponseEntity<List<EnvioDTO>> obtenerEnviosParaRuta(@PathVariable Long choferId) {
        List<EnvioDTO> envios = envioService.obtenerEnviosParaRuta(choferId);
        return ResponseEntity.ok(envios);
    }

    @PostMapping("/{id}/asignar")
    public ResponseEntity<?> asignarEnvio(
            @PathVariable Long id,
            @RequestBody AsignarEnvioRequest request) {
        log.info("POST /asignar envioId={} choferId={} choferNombre={} usuarioAsignador={}",
                id, request.getChoferId(), request.getChoferNombre(), request.getUsuarioAsignador());
        try {
            EnvioDTO envio = envioService.asignarEnvio(
                    id,
                    request.getChoferId(),
                    request.getChoferNombre(),
                    request.getUsuarioAsignador(),
                    request.getOrigen() != null ? request.getOrigen() : "WEB"
            );
            log.info("Asignación OK envioId={} choferNombre={}", id, request.getChoferNombre());
            return ResponseEntity.ok(envio);
        } catch (Exception e) {
            Throwable cause = e.getCause();
            String msg = e.getMessage();
            if (msg == null || msg.isEmpty()) {
                msg = cause != null && cause.getMessage() != null ? cause.getMessage() : "Error al asignar";
            }
            // Marcar respuesta para confirmar que es el backend nuevo (si ves "[backend v2]" en el alert, el deploy está vivo)
            if ("Error al asignar".equals(msg)) {
                msg = "Error al asignar [backend v2]";
            }
            log.error("Error al asignar envío id={} choferId={} choferNombre={} | exception={} message={}",
                    id, request.getChoferId(), request.getChoferNombre(), e.getClass().getSimpleName(), msg, e);
            return ResponseEntity.badRequest().body(java.util.Map.of("message", msg));
        }
    }

    /** Para verificar que el backend desplegado es el nuevo: abrí en el navegador https://api.mvgtms.com.ar/api/envios/deploy-version */
    @GetMapping("/deploy-version")
    public ResponseEntity<Map<String, String>> deployVersion() {
        return ResponseEntity.ok(java.util.Map.of("version", "asignar-v2", "texto", "Si ves esto, el backend con logs y fix de asignar está desplegado."));
    }

    @PostMapping("/verificar-existentes")
    public ResponseEntity<Map<String, Boolean>> verificarEnviosExistentes(@RequestBody List<VerificarEnvioRequest> requests) {
        Map<String, Boolean> resultados = envioService.verificarEnviosExistentes(requests);
        return ResponseEntity.ok(resultados);
    }

    @PostMapping("/buscar-por-pedido")
    public ResponseEntity<EnvioDTO> buscarEnvioPorPedido(@RequestBody BuscarEnvioPorPedidoRequest request) {
        EnvioDTO envio = envioService.buscarEnvioPorPedido(
            request.getCliente(),
            request.getFechaVenta(),
            request.getDestinatario(),
            request.getOrigen()
        );
        if (envio == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(envio);
    }

    // Clase interna para el request
    public static class AsignarEnvioRequest {
        private Long choferId;
        private String choferNombre;
        private String usuarioAsignador;
        private String origen; // "APP" o "WEB"

        public Long getChoferId() { return choferId; }
        public void setChoferId(Long choferId) { this.choferId = choferId; }
        public String getChoferNombre() { return choferNombre; }
        public void setChoferNombre(String choferNombre) { this.choferNombre = choferNombre; }
        public String getUsuarioAsignador() { return usuarioAsignador; }
        public void setUsuarioAsignador(String usuarioAsignador) { this.usuarioAsignador = usuarioAsignador; }
        public String getOrigen() { return origen; }
        public void setOrigen(String origen) { this.origen = origen; }
    }

    // Clase interna para verificar envíos existentes
    public static class VerificarEnvioRequest {
        private String pedidoKey; // "clienteId-numeroPedido"
        private String cliente; // "codigo - nombre"
        private String fechaVenta; // ISO-8601 format
        private String destinatario;
        private String origen; // "TiendaNube" o "Vtex"

        public String getPedidoKey() { return pedidoKey; }
        public void setPedidoKey(String pedidoKey) { this.pedidoKey = pedidoKey; }
        public String getCliente() { return cliente; }
        public void setCliente(String cliente) { this.cliente = cliente; }
        public String getFechaVenta() { return fechaVenta; }
        public void setFechaVenta(String fechaVenta) { this.fechaVenta = fechaVenta; }
        public String getDestinatario() { return destinatario; }
        public void setDestinatario(String destinatario) { this.destinatario = destinatario; }
        public String getOrigen() { return origen; }
        public void setOrigen(String origen) { this.origen = origen; }
    }

    // Clase interna para buscar envío por pedido
    public static class BuscarEnvioPorPedidoRequest {
        private String cliente; // "codigo - nombre"
        private String fechaVenta; // Formato original de Tienda Nube
        private String destinatario;
        private String origen; // "TiendaNube" o "Vtex"

        public String getCliente() { return cliente; }
        public void setCliente(String cliente) { this.cliente = cliente; }
        public String getFechaVenta() { return fechaVenta; }
        public void setFechaVenta(String fechaVenta) { this.fechaVenta = fechaVenta; }
        public String getDestinatario() { return destinatario; }
        public void setDestinatario(String destinatario) { this.destinatario = destinatario; }
        public String getOrigen() { return origen; }
        public void setOrigen(String origen) { this.origen = origen; }
    }
}

