package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.EnvioDTO;
import com.zetallegue.tms.dto.EnvioFilterDTO;
import com.zetallegue.tms.dto.HistorialEnvioDTO;
import com.zetallegue.tms.dto.ObservacionEnvioDTO;
import com.zetallegue.tms.dto.ImagenEnvioDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.service.EnvioService;
import com.zetallegue.tms.service.PodPdfService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/envios")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class EnvioController {

    private final EnvioService envioService;
    private final PodPdfService podPdfService;
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

    @GetMapping("/buscar-por-id-nx/{idNx}")
    public ResponseEntity<Map<String, String>> buscarPorIdNx(@PathVariable String idNx) {
        java.util.Optional<com.zetallegue.tms.model.Envio> envioOpt = envioService.findForBuscadorPorIdNx(idNx);
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

    @PatchMapping("/{id}/geolocalizacion")
    public ResponseEntity<EnvioDTO> actualizarGeolocalizacion(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Double lat = body.get("lat") != null ? ((Number) body.get("lat")).doubleValue() : null;
        Double lng = body.get("lng") != null ? ((Number) body.get("lng")).doubleValue() : null;
        String direccion = body.get("direccion") != null ? body.get("direccion").toString() : null;
        String usuarioNombre = body.get("usuarioNombre") != null ? body.get("usuarioNombre").toString() : null;
        if (lat == null || lng == null) {
            return ResponseEntity.badRequest().build();
        }
        EnvioDTO envio = envioService.actualizarGeolocalizacion(id, lat, lng, direccion, usuarioNombre);
        return ResponseEntity.ok(envio);
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<?> actualizarEstado(
            @PathVariable Long id,
            @RequestBody ActualizarEstadoRequest request) {
        try {
            EnvioDTO envio = envioService.actualizarEstado(
                    id,
                    request.getEstado(),
                    request.getUsuarioNombre(),
                    request.getObservaciones(),
                    request.getFoto(),
                    request.getRolRecibio(),
                    request.getNombreRecibio(),
                    request.getDniRecibio(),
                    request.getLatitud(),
                    request.getLongitud(),
                    request.getDestinoLat(),
                    request.getDestinoLng(),
                    request.getUbicacionDireccion()
            );
            return ResponseEntity.ok(envio);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : "Error al actualizar estado"
            ));
        }
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
        private Double latitud;
        private Double longitud;
        private Double destinoLat;
        private Double destinoLng;
        private String ubicacionDireccion;

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
        public Double getLatitud() { return latitud; }
        public void setLatitud(Double latitud) { this.latitud = latitud; }
        public Double getLongitud() { return longitud; }
        public void setLongitud(Double longitud) { this.longitud = longitud; }
        public Double getDestinoLat() { return destinoLat; }
        public void setDestinoLat(Double destinoLat) { this.destinoLat = destinoLat; }
        public Double getDestinoLng() { return destinoLng; }
        public void setDestinoLng(Double destinoLng) { this.destinoLng = destinoLng; }
        public String getUbicacionDireccion() { return ubicacionDireccion; }
        public void setUbicacionDireccion(String ubicacionDireccion) { this.ubicacionDireccion = ubicacionDireccion; }
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

    @PostMapping("/{id}/retirar")
    public ResponseEntity<EnvioDTO> retirarEnvio(
            @PathVariable Long id,
            @RequestBody(required = false) String usuarioNombre) {
        try {
            EnvioDTO envio = envioService.retirarEnvio(id, usuarioNombre != null ? usuarioNombre : "Usuario");
            return ResponseEntity.ok(envio);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /** Retiro + adjudicar al chofer y pasar a En camino (sin estado intermedio Retirado). */
    @PostMapping("/{id}/retirar-en-ruta")
    public ResponseEntity<?> retirarYAdjudicarEnCamino(
            @PathVariable Long id,
            @RequestBody RetirarEnRutaRequest request) {
        try {
            if (request == null || request.getChoferId() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "choferId es requerido"));
            }
            EnvioDTO envio = envioService.retirarYAdjudicarEnCamino(
                    id,
                    request.getChoferId(),
                    request.getChoferNombre(),
                    request.getUsuarioNombre() != null ? request.getUsuarioNombre() : "Usuario"
            );
            return ResponseEntity.ok(envio);
        } catch (RuntimeException e) {
            log.error("Error retirar-en-ruta id={}: {}", id, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Error"));
        }
    }
    
    @PostMapping("/retirar-flex")
    public ResponseEntity<?> retirarEnvioFlex(
            @RequestBody(required = false) RetirarFlexRequest request) {
        log.info("=== RECIBIDA PETICIÓN RETIRAR-FLEX ===");
        
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
            EnvioDTO envio = envioService.retirarEnvioFlex(
                request.getQrData(), 
                request.getUsuarioNombre() != null ? request.getUsuarioNombre() : "Usuario"
            );
            log.info("Envío retirado exitosamente: ID {}", envio.getId());
            return ResponseEntity.ok(envio);
        } catch (RuntimeException e) {
            log.error("Error al retirar envío Flex: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error inesperado al retirar envío Flex: {}", e.getMessage(), e);
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
    public static class RetirarFlexRequest {
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

    /** PDF de prueba de entrega / constancia de intento (PoD). Opcional: historialId para Nadie/Rechazado. */
    @GetMapping("/{id}/pod")
    public void descargarPod(
            @PathVariable Long id,
            @RequestParam(required = false) Long historialId,
            HttpServletResponse response) throws IOException {
        try {
            PodPdfService.PodPdfResult result = podPdfService.generar(id, historialId);
            String filename = result.nombreArchivo();
            String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType("application/pdf");
            response.setContentLength(result.contenido().length);
            response.setHeader("Content-Disposition",
                    "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encoded);
            response.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
            response.getOutputStream().write(result.contenido());
            response.getOutputStream().flush();
        } catch (IllegalArgumentException e) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            log.error("Error generando PoD envio {}", id, e);
            if (!response.isCommitted()) {
                response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error al generar el PoD");
            }
        }
    }

    @GetMapping("/chofer/{choferId}/ruta")
    public ResponseEntity<List<EnvioDTO>> obtenerEnviosParaRuta(@PathVariable Long choferId) {
        List<EnvioDTO> envios = envioService.obtenerEnviosParaRuta(choferId);
        return ResponseEntity.ok(envios);
    }

    /** Historial de pedidos del chofer (Entregado / Rechazado / Nadie) por rango de fechas. */
    @GetMapping("/chofer/{choferId}/historial")
    public ResponseEntity<?> obtenerHistorialChofer(
            @PathVariable Long choferId,
            @RequestParam String desde,
            @RequestParam String hasta,
            @RequestParam(required = false) String q) {
        try {
            LocalDate dDesde = LocalDate.parse(desde);
            LocalDate dHasta = LocalDate.parse(hasta);
            return ResponseEntity.ok(envioService.obtenerHistorialChofer(choferId, dDesde, dHasta, q));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : "Error al obtener historial"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fechas inválidas. Usá formato YYYY-MM-DD."));
        }
    }

    @PostMapping("/{id}/adjudicar")
    public ResponseEntity<?> adjudicarEnvio(
            @PathVariable Long id,
            @RequestBody AdjudicarEnvioRequest request) {
        log.info("POST /adjudicar envioId={} choferId={} choferNombre={} usuarioAdjudicador={}",
                id, request.getChoferId(), request.getChoferNombre(), request.getUsuarioAdjudicador());
        try {
            EnvioDTO envio = envioService.adjudicarEnvio(
                    id,
                    request.getChoferId(),
                    request.getChoferNombre(),
                    request.getUsuarioAdjudicador(),
                    request.getOrigen() != null ? request.getOrigen() : "WEB"
            );
            log.info("Adjudicación OK envioId={} choferNombre={}", id, request.getChoferNombre());
            return ResponseEntity.ok(envio);
        } catch (Exception e) {
            Throwable cause = e.getCause();
            String msg = e.getMessage();
            if (msg == null || msg.isEmpty()) {
                msg = cause != null && cause.getMessage() != null ? cause.getMessage() : "Error al adjudicar";
            }
            // Marcar respuesta para confirmar que es el backend nuevo (si ves "[backend v2]" en el alert, el deploy está vivo)
            if ("Error al adjudicar".equals(msg)) {
                msg = "Error al adjudicar [backend v2]";
            }
            log.error("Error al adjudicar envío id={} choferId={} choferNombre={} | exception={} message={}",
                    id, request.getChoferId(), request.getChoferNombre(), e.getClass().getSimpleName(), msg, e);
            return ResponseEntity.badRequest().body(java.util.Map.of("message", msg));
        }
    }

    /** Para verificar que el backend desplegado es el nuevo: abrí en el navegador https://api.mvgtms.com.ar/api/envios/deploy-version */
    @GetMapping("/deploy-version")
    public ResponseEntity<Map<String, String>> deployVersion() {
        return ResponseEntity.ok(java.util.Map.of("version", "adjudicar-v2", "texto", "Si ves esto, el backend con logs y fix de adjudicar está desplegado."));
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
    public static class RetirarEnRutaRequest {
        private Long choferId;
        private String choferNombre;
        private String usuarioNombre;

        public Long getChoferId() { return choferId; }
        public void setChoferId(Long choferId) { this.choferId = choferId; }
        public String getChoferNombre() { return choferNombre; }
        public void setChoferNombre(String choferNombre) { this.choferNombre = choferNombre; }
        public String getUsuarioNombre() { return usuarioNombre; }
        public void setUsuarioNombre(String usuarioNombre) { this.usuarioNombre = usuarioNombre; }
    }

    // Clase interna para el request
    public static class AdjudicarEnvioRequest {
        private Long choferId;
        private String choferNombre;
        private String usuarioAdjudicador;
        private String origen; // "APP" o "WEB"

        public Long getChoferId() { return choferId; }
        public void setChoferId(Long choferId) { this.choferId = choferId; }
        public String getChoferNombre() { return choferNombre; }
        public void setChoferNombre(String choferNombre) { this.choferNombre = choferNombre; }
        public String getUsuarioAdjudicador() { return usuarioAdjudicador; }
        public void setUsuarioAdjudicador(String usuarioAdjudicador) { this.usuarioAdjudicador = usuarioAdjudicador; }
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

