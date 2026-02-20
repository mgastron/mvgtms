package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.ChoferConUbicacionDTO;
import com.zetallegue.tms.dto.ChoferCierreDTO;
import com.zetallegue.tms.dto.EnvioDTO;
import com.zetallegue.tms.dto.EnvioFilterDTO;
import com.zetallegue.tms.dto.HistorialEnvioDTO;
import com.zetallegue.tms.dto.ObservacionEnvioDTO;
import com.zetallegue.tms.dto.ImagenEnvioDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.model.Usuario;
import com.zetallegue.tms.repository.UsuarioRepository;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.model.HistorialEnvio;
import com.zetallegue.tms.model.ObservacionEnvio;
import com.zetallegue.tms.model.ImagenEnvio;
import com.zetallegue.tms.repository.EnvioRepository;
import com.zetallegue.tms.repository.HistorialEnvioRepository;
import com.zetallegue.tms.repository.ObservacionEnvioRepository;
import com.zetallegue.tms.repository.ImagenEnvioRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EnvioService {

    private final EnvioRepository envioRepository;
    private final HistorialEnvioRepository historialEnvioRepository;
    private final UsuarioRepository usuarioRepository;
    private final ObservacionEnvioRepository observacionEnvioRepository;
    private final ImagenEnvioRepository imagenEnvioRepository;
    private final MercadoLibreService mercadoLibreService;
    private final com.zetallegue.tms.repository.ClienteRepository clienteRepository;
    private final com.zetallegue.tms.repository.ListaPrecioRepository listaPrecioRepository;
    private final EmailService emailService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    
    /** Busca por tracking o por ID_MVG (el código que usa el buscador de pedidos). */
    public java.util.Optional<Envio> findByTracking(String tracking) {
        List<Envio> envios = envioRepository.findByTrackingOrIdMvgAndEliminadoFalse(tracking);
        return envios.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(envios.get(0));
    }

    @Transactional(readOnly = true)
    public PageResponseDTO<EnvioDTO> buscarEnvios(EnvioFilterDTO filter) {
        Specification<Envio> spec = buildSpecification(filter);
        // Ordenar por fecha descendente (más nuevos primero)
        Pageable pageable = PageRequest.of(filter.getPage(), filter.getSize(), Sort.by(Sort.Direction.DESC, "fecha"));
        Page<Envio> page = envioRepository.findAll(spec, pageable);

        List<EnvioDTO> content = page.getContent().stream()
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

    /**
     * Obtiene todos los envíos que cumplan los filtros sin paginación (para exportación)
     */
    @Transactional(readOnly = true)
    public List<EnvioDTO> buscarTodosLosEnvios(EnvioFilterDTO filter) {
        Specification<Envio> spec = buildSpecification(filter);
        // Ordenar por fecha descendente (más nuevos primero)
        Sort sort = Sort.by(Sort.Direction.DESC, "fecha");
        List<Envio> envios = envioRepository.findAll(spec, sort);

        return envios.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<EnvioDTO> obtenerEnviosUltimaSemana() {
        // Obtener envíos de los últimos 7 días para caché
        LocalDateTime fechaDesde = LocalDateTime.now().minusDays(7);
        Pageable pageable = PageRequest.of(0, 1000); // Máximo 1000 envíos de la última semana
        List<Envio> envios = envioRepository.findEnviosRecientes(fechaDesde, pageable);
        return envios.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EnvioDTO obtenerEnvioPorId(Long id) {
        Envio envio = envioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + id));
        return toDTO(envio);
    }

    @Transactional(readOnly = true)
    public EnvioDTO obtenerEnvioPorToken(String token) {
        List<Envio> envios = envioRepository.findByTrackingTokenAndEliminadoFalse(token);
        if (envios.isEmpty()) {
            return null;
        }
        return toDTO(envios.get(0));
    }

    @Transactional
    public EnvioDTO crearEnvio(EnvioDTO envioDTO) {
        // Si el origen es "Directo" y viene un tracking como semilla: tracking = original, idMvg = código único generado
        if ("Directo".equals(envioDTO.getOrigen()) && envioDTO.getTracking() != null && !envioDTO.getTracking().trim().isEmpty()) {
            String semilla = envioDTO.getTracking();
            String idMvg = generarTrackingUnico(semilla);
            envioDTO.setIdMvg(idMvg);
            // tracking se mantiene como el que viene (semilla); idMvg es el código alfanumérico para búsqueda
            if (envioDTO.getQrData() == null || envioDTO.getQrData().equals(semilla)) {
                envioDTO.setQrData(idMvg);
            }
            log.info("ID_MVG generado para envío Directo - Semilla: {}, ID_MVG: {}", semilla, idMvg);
        }
        
        // Calcular costo de envío si es un envío directo y tiene cliente y código postal
        if ("Directo".equals(envioDTO.getOrigen()) && envioDTO.getCliente() != null && !envioDTO.getCliente().trim().isEmpty()) {
            calcularCostoEnvioParaDirecto(envioDTO);
        }
        
        Envio envio = toEntity(envioDTO);
        
        // Generar token único para tracking público si no existe (usar idMvg o tracking para unicidad)
        if (envio.getTrackingToken() == null || envio.getTrackingToken().trim().isEmpty()) {
            String base = envio.getIdMvg() != null && !envio.getIdMvg().isEmpty() ? envio.getIdMvg() : envio.getTracking();
            String trackingToken = generarTrackingToken(base, envio.getId());
            envio.setTrackingToken(trackingToken);
            log.info("Tracking token generado para envío: {}", trackingToken);
        }
        
        envio = envioRepository.save(envio);
        EnvioDTO resultado = toDTO(envio);
        
        // El email "Tu pedido está en camino" se envía cuando el envío pasa a estado Retirado (no al crear)
        
        return resultado;
    }
    
    /**
     * Genera un tracking único de 16 caracteres alfanuméricos basado en una semilla.
     * Si el tracking generado ya existe, agrega un sufijo numérico hasta encontrar uno único.
     * 
     * @param semilla El tracking original que se usa como semilla
     * @return Un tracking único de 16 caracteres alfanuméricos
     */
    public String generarTrackingUnico(String semilla) {
        try {
            // Crear un hash de la semilla + timestamp para generar un código determinístico pero único
            String input = semilla + System.currentTimeMillis();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            
            // Convertir el hash a una cadena alfanumérica de 16 caracteres
            // Usar caracteres alfanuméricos (0-9, A-Z)
            String caracteres = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            StringBuilder tracking = new StringBuilder(16);
            
            // Usar los primeros bytes del hash para generar el código
            for (int i = 0; i < 16; i++) {
                int index = Math.abs(hash[i % hash.length]) % caracteres.length();
                tracking.append(caracteres.charAt(index));
            }
            
            String trackingBase = tracking.toString();
            
            // Verificar unicidad y agregar sufijo si es necesario
            String trackingFinal = trackingBase;
            int contador = 0;
            int maxIntentos = 100; // Límite de seguridad
            
            while (contador < maxIntentos) {
                List<Envio> enviosExistentes = envioRepository.findByIdMvgAndEliminadoFalse(trackingFinal);
                if (enviosExistentes.isEmpty()) {
                    return trackingFinal;
                }
                
                // Si existe, agregar un sufijo numérico
                contador++;
                // Usar los últimos 2 dígitos del contador para mantener 16 caracteres
                String sufijo = String.format("%02d", contador % 100);
                trackingFinal = trackingBase.substring(0, 14) + sufijo;
            }
            
            // Si después de 100 intentos no encontramos uno único, usar timestamp como fallback
            log.warn("No se pudo generar tracking único después de {} intentos, usando timestamp como fallback", maxIntentos);
            return generarTrackingDesdeTimestamp();
            
        } catch (Exception e) {
            log.error("Error al generar tracking único, usando timestamp como fallback: {}", e.getMessage());
            return generarTrackingDesdeTimestamp();
        }
    }
    
    /**
     * Genera un tracking único de 16 caracteres usando timestamp como fallback.
     */
    private String generarTrackingDesdeTimestamp() {
        String caracteres = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        Random random = new Random(System.currentTimeMillis());
        StringBuilder tracking = new StringBuilder(16);
        
        for (int i = 0; i < 16; i++) {
            tracking.append(caracteres.charAt(random.nextInt(caracteres.length())));
        }
        
        return tracking.toString();
    }
    
    /**
     * Genera un token único para el link público de tracking.
     * El token es una cadena alfanumérica de 32 caracteres basada en el tracking y el ID del envío.
     * 
     * @param tracking El tracking del envío
     * @param envioId El ID del envío (puede ser null si aún no se ha creado)
     * @return Un token único de 32 caracteres alfanuméricos
     */
    private String generarTrackingToken(String tracking, Long envioId) {
        try {
            // Crear un hash del tracking + ID + timestamp para generar un token único
            String input = (tracking != null ? tracking : "") + 
                          (envioId != null ? envioId.toString() : "") + 
                          System.currentTimeMillis() + 
                          Math.random();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            
            // Convertir el hash a una cadena alfanumérica de 32 caracteres
            // Usar caracteres alfanuméricos (0-9, a-z, A-Z) para URL-safe
            String caracteres = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            StringBuilder token = new StringBuilder(32);
            
            // Usar los bytes del hash para generar el token
            for (int i = 0; i < 32; i++) {
                int index = Math.abs(hash[i % hash.length]) % caracteres.length();
                token.append(caracteres.charAt(index));
            }
            
            String tokenBase = token.toString();
            
            // Verificar unicidad en la base de datos
            String tokenFinal = tokenBase;
            int contador = 0;
            int maxIntentos = 100;
            
            while (contador < maxIntentos) {
                // Buscar si ya existe un envío con este token
                List<Envio> enviosExistentes = envioRepository.findByTrackingTokenAndEliminadoFalse(tokenFinal);
                if (enviosExistentes.isEmpty()) {
                    return tokenFinal;
                }
                
                // Si existe, agregar un sufijo
                contador++;
                String sufijo = String.format("%02d", contador % 100);
                tokenFinal = tokenBase.substring(0, 30) + sufijo;
            }
            
            // Si después de 100 intentos no encontramos uno único, usar timestamp como fallback
            log.warn("No se pudo generar tracking token único después de {} intentos, usando timestamp como fallback", maxIntentos);
            return generarTrackingTokenDesdeTimestamp();
            
        } catch (Exception e) {
            log.error("Error al generar tracking token, usando timestamp como fallback: {}", e.getMessage());
            return generarTrackingTokenDesdeTimestamp();
        }
    }
    
    /**
     * Genera un tracking token usando timestamp como fallback.
     */
    private String generarTrackingTokenDesdeTimestamp() {
        String caracteres = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        Random random = new Random(System.currentTimeMillis());
        StringBuilder token = new StringBuilder(32);
        
        for (int i = 0; i < 32; i++) {
            token.append(caracteres.charAt(random.nextInt(caracteres.length())));
        }
        
        return token.toString();
    }

    @Transactional
    public EnvioDTO actualizarEnvio(Long id, EnvioDTO envioDTO) {
        Envio envio = envioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + id));

        // Actualizar campos
        if (envioDTO.getFecha() != null) envio.setFecha(envioDTO.getFecha());
        if (envioDTO.getFechaVenta() != null) envio.setFechaVenta(envioDTO.getFechaVenta());
        if (envioDTO.getFechaLlegue() != null) envio.setFechaLlegue(envioDTO.getFechaLlegue());
        if (envioDTO.getFechaEntregado() != null) envio.setFechaEntregado(envioDTO.getFechaEntregado());
        if (envioDTO.getFechaAsignacion() != null) envio.setFechaAsignacion(envioDTO.getFechaAsignacion());
        if (envioDTO.getFechaDespacho() != null) envio.setFechaDespacho(envioDTO.getFechaDespacho());
        if (envioDTO.getFechaColecta() != null) envio.setFechaColecta(envioDTO.getFechaColecta());
        if (envioDTO.getFechaAPlanta() != null) envio.setFechaAPlanta(envioDTO.getFechaAPlanta());
        if (envioDTO.getFechaCancelado() != null) envio.setFechaCancelado(envioDTO.getFechaCancelado());
        if (envioDTO.getFechaUltimoMovimiento() != null) envio.setFechaUltimoMovimiento(envioDTO.getFechaUltimoMovimiento());
        if (envioDTO.getOrigen() != null) envio.setOrigen(envioDTO.getOrigen());
        if (envioDTO.getTracking() != null) envio.setTracking(envioDTO.getTracking());
        if (envioDTO.getCliente() != null) envio.setCliente(envioDTO.getCliente());
        if (envioDTO.getDireccion() != null) envio.setDireccion(envioDTO.getDireccion());
        if (envioDTO.getNombreDestinatario() != null) envio.setNombreDestinatario(envioDTO.getNombreDestinatario());
        if (envioDTO.getTelefono() != null) envio.setTelefono(envioDTO.getTelefono());
        if (envioDTO.getEmail() != null) envio.setEmail(envioDTO.getEmail());
        if (envioDTO.getImpreso() != null) envio.setImpreso(envioDTO.getImpreso());
        if (envioDTO.getObservaciones() != null) envio.setObservaciones(envioDTO.getObservaciones());
        if (envioDTO.getTotalACobrar() != null) envio.setTotalACobrar(envioDTO.getTotalACobrar());
        if (envioDTO.getCambioRetiro() != null) envio.setCambioRetiro(envioDTO.getCambioRetiro());
        if (envioDTO.getLocalidad() != null) envio.setLocalidad(envioDTO.getLocalidad());
        if (envioDTO.getCodigoPostal() != null) envio.setCodigoPostal(envioDTO.getCodigoPostal());
        if (envioDTO.getZonaEntrega() != null) envio.setZonaEntrega(envioDTO.getZonaEntrega());
        if (envioDTO.getQrData() != null) envio.setQrData(envioDTO.getQrData());
        if (envioDTO.getEstado() != null) envio.setEstado(envioDTO.getEstado());
        if (envioDTO.getEliminado() != null) envio.setEliminado(envioDTO.getEliminado());
        if (envioDTO.getColectado() != null) envio.setColectado(envioDTO.getColectado());

        envio = envioRepository.save(envio);
        return toDTO(envio);
    }

    @Transactional
    public void eliminarEnvio(Long id) {
        Envio envio = envioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + id));
        envio.setEliminado(true);
        envioRepository.save(envio);
    }

    @Transactional
    public EnvioDTO actualizarEstado(Long id, String estado, String usuarioNombre, 
                                     String observaciones, String fotoUrl,
                                     String rolRecibio, String nombreRecibio, String dniRecibio) {
        Envio envio = envioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + id));
        
        // Bloquear cambios manuales de estado para envíos Flex
        // Los estados de Flex se sincronizan automáticamente desde MercadoLibre vía polling
        if ("Flex".equals(envio.getOrigen())) {
            throw new RuntimeException("No se puede cambiar manualmente el estado de un envío Flex. " +
                    "El estado se sincroniza automáticamente desde MercadoLibre.");
        }
        
        LocalDateTime ahora = LocalDateTime.now();
        String estadoAnterior = envio.getEstado();
        envio.setEstado(estado);
        envio.setFechaUltimoMovimiento(ahora);
        
        // Guardar datos de entrega si el estado es "Entregado"
        if ("Entregado".equals(estado)) {
            envio.setFechaEntregado(ahora);
            if (rolRecibio != null) envio.setRolRecibio(rolRecibio);
            if (nombreRecibio != null) envio.setNombreRecibio(nombreRecibio);
            if (dniRecibio != null) envio.setDniRecibio(dniRecibio);
        }
        
        // Actualizar fecha específica según el estado
        switch (estado) {
            case "Entregado":
                envio.setFechaEntregado(ahora);
                break;
            case "Cancelado":
                envio.setFechaCancelado(ahora);
                break;
            // Agregar más casos según sea necesario
        }
        
        envio = envioRepository.save(envio);
        
        // Agregar entrada al historial solo si el estado cambió
        if (!estado.equals(estadoAnterior)) {
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(estado);
            historial.setFecha(ahora);
            historial.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
            historial.setObservaciones(observaciones);
            historial.setOrigen("APP"); // Desde la app móvil
            historialEnvioRepository.save(historial);
        }
        
        // Guardar observación si se proporciona (para rechazo)
        if (observaciones != null && !observaciones.trim().isEmpty() && 
            "Rechazado por el comprador".equals(estado)) {
            ObservacionEnvio observacion = new ObservacionEnvio();
            observacion.setEnvioId(envio.getId());
            observacion.setObservacion(observaciones);
            observacion.setFecha(ahora);
            observacion.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
            observacionEnvioRepository.save(observacion);
        }
        
        // Guardar imagen si se proporciona (para "Nadie")
        if (fotoUrl != null && !fotoUrl.trim().isEmpty() && "Nadie".equals(estado)) {
            ImagenEnvio imagen = new ImagenEnvio();
            imagen.setEnvioId(envio.getId());
            imagen.setUrlImagen(fotoUrl);
            imagen.setFecha(ahora);
            imagen.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
            imagen.setTipo("nadie_en_domicilio");
            imagenEnvioRepository.save(imagen);
        }
        
        // Enviar email "Tu pedido está en camino" cuando el estado pasa a Retirado (web/app)
        if ("Retirado".equals(estado) && !"Retirado".equals(estadoAnterior)) {
            enviarEmailNotificacionSiRetirado(envio);
        }
        
        return toDTO(envio);
    }
    
    /**
     * Envía el email "Tu pedido está en camino" si el envío no es Flex y tiene email.
     * Se llama cuando el envío pasa a estado Retirado (colectado).
     */
    private void enviarEmailNotificacionSiRetirado(Envio envio) {
        if ("Flex".equals(envio.getOrigen())) return;
        if (envio.getEmail() == null || envio.getEmail().trim().isEmpty()) return;
        try {
            emailService.enviarEmailNotificacionEnvio(
                envio.getEmail(),
                envio.getNombreDestinatario(),
                envio.getTracking(),
                envio.getTrackingToken()
            );
        } catch (Exception e) {
            log.warn("Error al enviar email de notificación (no se bloquea el cambio de estado): {}", e.getMessage());
        }
    }
    
    // Método sobrecargado para compatibilidad con llamadas desde web
    @Transactional
    public EnvioDTO actualizarEstado(Long id, String estado, String usuarioNombre) {
        return actualizarEstado(id, estado, usuarioNombre, null, null, null, null, null);
    }

    public EnvioDTO buscarEnvioPorQR(String qrData) {
        if (qrData == null || qrData.trim().isEmpty()) {
            return null;
        }
        
        // Normalizar el QR si es JSON (para que coincida independientemente de espacios/orden)
        String qrNormalizado = normalizarQR(qrData);
        
        // Primero buscar en la base de datos por qrData exacto
        Envio envio = envioRepository.findByQrDataParaColectar(qrNormalizado);
        if (envio != null) {
            return toDTO(envio);
        }
        
        // También buscar por qrData original (por si acaso)
        if (!qrNormalizado.equals(qrData)) {
            envio = envioRepository.findByQrDataParaColectar(qrData);
            if (envio != null) {
                return toDTO(envio);
            }
        }
        
        // Si no se encuentra, intentar buscar por mlShipmentId si es un QR Flex
        try {
            // Extraer ID del shipment del QR
            String shipmentId = mercadoLibreService.extraerShipmentIdDelQR(qrData);
            
            // Buscar por mlShipmentId (más confiable que buscar por qrData que puede variar)
            java.util.Optional<Envio> envioPorShipmentId = envioRepository.findByMlShipmentId(shipmentId);
            if (envioPorShipmentId.isPresent()) {
                log.info("Envío encontrado por mlShipmentId: {}", shipmentId);
                return toDTO(envioPorShipmentId.get());
            }
            
            // Si no existe en BD, intentar obtener desde MercadoLibre (para colectar)
            // Buscar cliente vinculado con Flex que tenga este shipment
            List<com.zetallegue.tms.model.Cliente> clientesVinculados = clienteRepository.findAll().stream()
                    .filter(c -> c.getFlexIdVendedor() != null && !c.getFlexIdVendedor().isEmpty())
                    .collect(Collectors.toList());
            
            for (com.zetallegue.tms.model.Cliente cliente : clientesVinculados) {
                try {
                    // Intentar obtener el shipment desde ML
                    com.fasterxml.jackson.databind.JsonNode shipmentData = mercadoLibreService.obtenerShipmentPorId(shipmentId, cliente);
                    
                    // Mapear a EnvioDTO
                    com.zetallegue.tms.dto.EnvioDTO envioDTO = mercadoLibreService.mapearEnvioFlex(shipmentData, cliente);
                    
                    // Verificar si ya existe por tracking
                    List<Envio> enviosExistentes = envioRepository.findByTrackingAndEliminadoFalse(envioDTO.getTracking());
                    if (!enviosExistentes.isEmpty()) {
                        return toDTO(enviosExistentes.get(0));
                    }
                    
                    // Si no existe, retornar el DTO para que se cree al colectar
                    return envioDTO;
                } catch (Exception e) {
                    // Continuar con el siguiente cliente si falla
                    continue;
                }
            }
        } catch (Exception e) {
            // No es un QR Flex o no se pudo obtener desde ML
            log.debug("No se pudo procesar como QR Flex: {}", e.getMessage());
        }
        
        return null;
    }
    
    /**
     * Normaliza un QR JSON para que tenga formato consistente (sin espacios, orden consistente)
     * Si no es JSON, retorna el string original
     */
    private String normalizarQR(String qrData) {
        if (qrData == null || qrData.trim().isEmpty()) {
            return qrData;
        }
        
        try {
            // Intentar parsear como JSON
            com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode jsonNode = objectMapper.readTree(qrData.trim());
            // Re-stringificar sin espacios (formato compacto)
            return objectMapper.writeValueAsString(jsonNode);
        } catch (Exception e) {
            // No es JSON válido, retornar original
            return qrData.trim();
        }
    }

    @Transactional
    public EnvioDTO colectarEnvio(Long id, String usuarioNombre) {
        Envio envio = envioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + id));
        
        if (!"A retirar".equals(envio.getEstado())) {
            throw new RuntimeException("Solo pueden colectarse envíos que estén en estado 'A retirar'");
        }
        
        LocalDateTime ahora = LocalDateTime.now();
        envio.setEstado("Retirado");
        envio.setFechaColecta(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        // Marcar como colectado para que aparezca en las vistas
        envio.setColectado(true);
        
        envio = envioRepository.save(envio);
        
        // Agregar entrada al historial
        HistorialEnvio historial = new HistorialEnvio();
        historial.setEnvioId(envio.getId());
        historial.setEstado("Retirado");
        historial.setFecha(ahora);
        historial.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
        historial.setObservaciones(null); // Sin observación
        historial.setOrigen("APP"); // Colectar siempre es desde la app móvil
        historialEnvioRepository.save(historial);
        
        // Enviar email "Tu pedido está en camino" al pasar a Retirado (colecta por escaneo)
        enviarEmailNotificacionSiRetirado(envio);
        
        return toDTO(envio);
    }
    
    /**
     * Colecta un envío Flex desde MercadoLibre al escanear el QR
     * Si el envío no existe en la BD, lo crea desde ML
     */
    @Transactional
    public EnvioDTO colectarEnvioFlex(String qrData, String usuarioNombre) {
        log.info("Intentando colectar envío Flex con QR: {}", qrData);
        
        // Extraer shipment ID y sender_id del QR
        String shipmentId;
        try {
            shipmentId = mercadoLibreService.extraerShipmentIdDelQR(qrData);
            log.info("Shipment ID extraído del QR: {}", shipmentId);
        } catch (Exception e) {
            log.error("Error al extraer shipment ID del QR: {}", e.getMessage());
            throw new RuntimeException("No se pudo extraer el ID del shipment del QR: " + e.getMessage());
        }
        
        String senderId = mercadoLibreService.extraerSenderIdDelQR(qrData);
        log.info("Sender ID extraído del QR: {}", senderId);
        
        // Buscar cliente por sender_id si está disponible (más eficiente)
        com.zetallegue.tms.model.Cliente clienteEncontrado = null;
        if (senderId != null && !senderId.isEmpty()) {
            java.util.Optional<com.zetallegue.tms.model.Cliente> clienteOpt = clienteRepository.findByFlexIdVendedor(senderId);
            if (clienteOpt.isPresent()) {
                clienteEncontrado = clienteOpt.get();
                log.info("Cliente encontrado por sender_id {}: {}", senderId, clienteEncontrado.getId());
                
                // Verificar que el cliente tenga refresh token antes de intentar obtener el shipment
                if (clienteEncontrado.getFlexRefreshToken() == null || clienteEncontrado.getFlexRefreshToken().isEmpty()) {
                    String errorMsg = String.format(
                        "El cliente %d (%s) no tiene refresh token de MercadoLibre. " +
                        "Es necesario re-autorizar la vinculación desde la pestaña 'CUENTAS' del cliente.",
                        clienteEncontrado.getId(),
                        clienteEncontrado.getNombreFantasia() != null ? clienteEncontrado.getNombreFantasia() : clienteEncontrado.getCodigo()
                    );
                    log.error("No se pudo obtener el shipment: {}", errorMsg);
                    throw new RuntimeException("No se pudo obtener el shipment desde MercadoLibre: " + errorMsg);
                }
            } else {
                log.warn("No se encontró cliente con sender_id {}", senderId);
            }
        }
        
        // Si no se encontró por sender_id, buscar en todos los clientes vinculados
        List<com.zetallegue.tms.model.Cliente> clientesVinculados;
        if (clienteEncontrado != null) {
            clientesVinculados = java.util.Collections.singletonList(clienteEncontrado);
        } else {
            clientesVinculados = clienteRepository.findAll().stream()
                    .filter(c -> c.getFlexIdVendedor() != null && !c.getFlexIdVendedor().isEmpty())
                    .collect(Collectors.toList());
            log.info("Clientes vinculados encontrados: {}", clientesVinculados.size());
        }
        
        com.fasterxml.jackson.databind.JsonNode shipmentData = null;
        
        for (com.zetallegue.tms.model.Cliente cliente : clientesVinculados) {
            // Verificar que el cliente tenga refresh token antes de intentar
            if (cliente.getFlexRefreshToken() == null || cliente.getFlexRefreshToken().isEmpty()) {
                log.warn("Cliente {} no tiene refresh token, saltando...", cliente.getId());
                continue;
            }
            
            try {
                log.info("Intentando obtener shipment {} para cliente {} (seller: {})", 
                    shipmentId, cliente.getId(), cliente.getFlexIdVendedor());
                shipmentData = mercadoLibreService.obtenerShipmentPorId(shipmentId, cliente);
                clienteEncontrado = cliente;
                log.info("Shipment obtenido exitosamente para cliente {}", cliente.getId());
                break;
            } catch (Exception e) {
                log.warn("Error al obtener shipment para cliente {}: {}", cliente.getId(), e.getMessage());
                // Si el error es por falta de refresh token, no continuar con otros clientes
                if (e.getMessage() != null && e.getMessage().contains("No hay refresh token")) {
                    log.error("Cliente {} no tiene refresh token, deteniendo búsqueda", cliente.getId());
                    throw new RuntimeException("No se pudo obtener el shipment desde MercadoLibre: " + e.getMessage(), e);
                }
                continue;
            }
        }
        
        // Validar que se obtuvo el shipment desde la API
        if (clienteEncontrado == null) {
            String errorMsg = "No se encontró cliente vinculado con sender_id " + senderId + 
                " o el cliente no tiene refresh token configurado. " +
                "Verifique la vinculación de MercadoLibre en la pestaña 'CUENTAS' del cliente.";
            log.error("No se pudo obtener el shipment: {}", errorMsg);
            throw new RuntimeException("No se pudo obtener el shipment desde MercadoLibre: " + errorMsg);
        }
        
        if (shipmentData == null) {
            String errorMsg = "No se pudo obtener el shipment " + shipmentId + " desde la API de MercadoLibre. " +
                "Verifique que el shipment existe y que el cliente tiene los permisos necesarios.";
            log.error("No se pudo obtener el shipment: {}", errorMsg);
            throw new RuntimeException("No se pudo obtener el shipment desde MercadoLibre: " + errorMsg);
        }
        
        // Verificar si el envío ya existe
        String tracking = shipmentData.has("id") ? shipmentData.get("id").asText() : shipmentId;
        List<Envio> enviosExistentes = envioRepository.findByTrackingAndEliminadoFalse(tracking);
        
        Envio envio;
        if (!enviosExistentes.isEmpty()) {
            envio = enviosExistentes.get(0);
            if (!"A retirar".equals(envio.getEstado())) {
                throw new RuntimeException("Solo pueden colectarse envíos que estén en estado 'A retirar'");
            }
        } else {
            // Crear nuevo envío desde los datos de ML
            com.zetallegue.tms.dto.EnvioDTO envioDTO = mercadoLibreService.mapearEnvioFlex(shipmentData, clienteEncontrado);
            // Normalizar el QR JSON para que tenga formato consistente (sin espacios, orden consistente)
            // Esto asegura que pueda ser encontrado aunque se escanee con formato ligeramente diferente
            String qrNormalizado = normalizarQR(qrData);
            envioDTO.setQrData(qrNormalizado);
            // Guardar el shipment ID de MercadoLibre para polling
            envioDTO.setMlShipmentId(shipmentId);
            envio = toEntity(envioDTO);
            // Marcar como colectado desde el inicio (ya que se está colectando)
            envio.setColectado(true);
            envio.setEstado("Retirado");
        }
        
        // Guardar el shipment ID si no está guardado (para envíos existentes)
        if (envio.getMlShipmentId() == null || envio.getMlShipmentId().isEmpty()) {
            envio.setMlShipmentId(shipmentId);
        }
        
        LocalDateTime ahora = LocalDateTime.now();
        envio.setEstado("Retirado");
        envio.setFechaColecta(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        envio.setColectado(true);
        
        envio = envioRepository.save(envio);
        
        // Agregar entrada al historial
        HistorialEnvio historial = new HistorialEnvio();
        historial.setEnvioId(envio.getId());
        historial.setEstado("Retirado");
        historial.setFecha(ahora);
        historial.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
        historial.setObservaciones(null);
        historial.setOrigen("APP");
        historialEnvioRepository.save(historial);
        
        return toDTO(envio);
    }
    
    /**
     * Sube un envío Flex manualmente usando Seller ID y Shipment ID
     * Útil cuando el QR está roto o no se puede escanear
     */
    @Transactional
    public EnvioDTO subirFlexManual(String sellerId, String shipmentId, String usuarioNombre) {
        log.info("Intentando subir envío Flex manualmente - Seller ID: {}, Shipment ID: {}", sellerId, shipmentId);
        
        // Buscar cliente por seller ID
        java.util.Optional<com.zetallegue.tms.model.Cliente> clienteOpt = clienteRepository.findByFlexIdVendedor(sellerId);
        if (!clienteOpt.isPresent()) {
            throw new RuntimeException("No se encontró cliente vinculado con Seller ID: " + sellerId);
        }
        
        com.zetallegue.tms.model.Cliente cliente = clienteOpt.get();
        log.info("Cliente encontrado: {} (ID: {})", cliente.getNombreFantasia(), cliente.getId());
        
        // Obtener el shipment desde MercadoLibre
        com.fasterxml.jackson.databind.JsonNode shipmentData;
        try {
            shipmentData = mercadoLibreService.obtenerShipmentPorId(shipmentId, cliente);
            log.info("Shipment {} obtenido exitosamente desde MercadoLibre", shipmentId);
        } catch (Exception e) {
            log.error("Error al obtener shipment {} desde MercadoLibre: {}", shipmentId, e.getMessage());
            throw new RuntimeException("No se pudo obtener el shipment desde MercadoLibre: " + e.getMessage());
        }
        
        // Verificar si el envío ya existe
        String tracking = shipmentData.has("id") ? shipmentData.get("id").asText() : shipmentId;
        List<Envio> enviosExistentes = envioRepository.findByTrackingAndEliminadoFalse(tracking);
        
        Envio envio;
        if (!enviosExistentes.isEmpty()) {
            envio = enviosExistentes.get(0);
            log.info("Envío ya existe en la BD, actualizando: ID {}", envio.getId());
            // Actualizar datos desde ML
            com.zetallegue.tms.dto.EnvioDTO envioDTO = mercadoLibreService.mapearEnvioFlex(shipmentData, cliente);
            envio = actualizarEnvioDesdeDTO(envio, envioDTO);
        } else {
            // Crear nuevo envío desde los datos de ML
            log.info("Creando nuevo envío desde datos de MercadoLibre");
            com.zetallegue.tms.dto.EnvioDTO envioDTO = mercadoLibreService.mapearEnvioFlex(shipmentData, cliente);
            // Guardar el shipment ID de MercadoLibre para polling
            envioDTO.setMlShipmentId(shipmentId);
            envio = toEntity(envioDTO);
            // Marcar como colectado y en estado "Retirado" (ya que se está subiendo manualmente)
            envio.setColectado(true);
            envio.setEstado("Retirado");
        }
        
        // Guardar el shipment ID si no está guardado (para envíos existentes)
        if (envio.getMlShipmentId() == null || envio.getMlShipmentId().isEmpty()) {
            envio.setMlShipmentId(shipmentId);
        }
        
        // Guardar fecha de colecta
        LocalDateTime ahora = LocalDateTime.now();
        envio.setFechaColecta(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        
        envio = envioRepository.save(envio);
        
        // Agregar entrada al historial si es nuevo
        if (enviosExistentes.isEmpty()) {
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado("Retirado");
            historial.setFecha(ahora);
            historial.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
            historial.setObservaciones("Subido manualmente desde web");
            historial.setOrigen("WEB");
            historialEnvioRepository.save(historial);
        }
        
        log.info("Envío Flex subido exitosamente: ID {}", envio.getId());
        return toDTO(envio);
    }
    
    /**
     * Actualiza un envío existente con datos de un DTO
     */
    private Envio actualizarEnvioDesdeDTO(Envio envio, com.zetallegue.tms.dto.EnvioDTO envioDTO) {
        // Actualizar solo campos que vienen de ML, preservar estado y asignaciones
        if (envioDTO.getDireccion() != null) envio.setDireccion(envioDTO.getDireccion());
        if (envioDTO.getNombreDestinatario() != null) envio.setNombreDestinatario(envioDTO.getNombreDestinatario());
        if (envioDTO.getTelefono() != null) envio.setTelefono(envioDTO.getTelefono());
        if (envioDTO.getEmail() != null) envio.setEmail(envioDTO.getEmail());
        if (envioDTO.getLocalidad() != null) envio.setLocalidad(envioDTO.getLocalidad());
        if (envioDTO.getCodigoPostal() != null) envio.setCodigoPostal(envioDTO.getCodigoPostal());
        if (envioDTO.getObservaciones() != null) envio.setObservaciones(envioDTO.getObservaciones());
        return envio;
    }

    @Transactional
    public EnvioDTO asignarEnvio(Long envioId, Long choferId, String choferNombre, String usuarioAsignador, String origen) {
        log.info("asignarEnvio inicio envioId={} choferId={} choferNombre={}", envioId, choferId, choferNombre);
        Envio envio = envioRepository.findById(envioId)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + envioId));
        log.info("asignarEnvio envio encontrado id={} estado={} choferAnterior={} origen={}",
                envio.getId(), envio.getEstado(), envio.getChoferAsignadoNombre(), envio.getOrigen());
        
        // Verificar si es asignación a "PENDIENTES DEPÓSITO"
        boolean esPendientesDeposito = "PENDIENTES DEPÓSITO".equals(choferNombre);
        
        // Guardar el chofer anterior para detectar reasignación desde PENDIENTES DEPÓSITO
        String choferAnterior = envio.getChoferAsignadoNombre();
        boolean vieneDePendientesDeposito = "PENDIENTES DEPÓSITO".equals(choferAnterior);
        
        // Validar que el envío no esté en estados finales (nunca asignar Entregado/Cancelado)
        if ("Entregado".equals(envio.getEstado()) || "Cancelado".equals(envio.getEstado())) {
            throw new RuntimeException("No se pueden asignar envíos que estén en estado 'Entregado' o 'Cancelado'");
        }

        // Permitir asignar a chofer desde "A retirar" (el chofer puede ser quien lo retira) o desde "Retirado"
        
        LocalDateTime ahora = LocalDateTime.now();
        
        // Guardar el estado anterior para el historial
        String estadoAnterior = envio.getEstado();
        
        // Asignar el chofer
        envio.setChoferAsignadoId(choferId);
        envio.setChoferAsignadoNombre(choferNombre);
        envio.setFechaAsignacion(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        
        // Para envíos Flex, NO cambiar el estado (solo asignar chofer)
        // El estado se sincroniza automáticamente desde MercadoLibre vía polling
        boolean esFlex = "Flex".equals(envio.getOrigen());
        
        // Si es "PENDIENTES DEPÓSITO", NO cambiar el estado (mantener el estado actual)
        // Si NO es "PENDIENTES DEPÓSITO" y NO es Flex:
        //   - Si viene de PENDIENTES DEPÓSITO y está en "A retirar", cambiar a "En camino al destinatario"
        //   - Si el estado es "Retirado", cambiarlo a "En camino al destinatario"
        //   - Si ya está en "En camino al destinatario", mantenerlo
        if (!esPendientesDeposito && !esFlex) {
            if ("Retirado".equals(envio.getEstado()) || 
                (vieneDePendientesDeposito && "A retirar".equals(envio.getEstado()))) {
                envio.setEstado("En camino al destinatario");
            }
            // Si ya está en "En camino al destinatario", mantener el estado
        }
        // Si es "PENDIENTES DEPÓSITO" o Flex, mantener el estado actual
        
        log.info("asignarEnvio guardando envio id={} estado={} choferAsignadoId={} choferAsignadoNombre={}",
                envio.getId(), envio.getEstado(), envio.getChoferAsignadoId(), envio.getChoferAsignadoNombre());
        envio = envioRepository.save(envio);
        log.info("asignarEnvio save OK envio id={}", envio.getId());
        
        // Determinar si hubo cambio de estado
        boolean cambioEstado = !estadoAnterior.equals(envio.getEstado());
        
        // Determinar si hubo reasignación (cambio de chofer)
        boolean esReasignacion = choferAnterior != null && 
                                 !choferAnterior.trim().isEmpty() && 
                                 !choferAnterior.equals(choferNombre);
        
        // Determinar si es la primera asignación (no había chofer antes)
        boolean esPrimeraAsignacion = choferAnterior == null || choferAnterior.trim().isEmpty();
        
        // Solo agregar al historial si:
        // 1. Cambió el estado (siempre agregar)
        // 2. Es la primera asignación Y cambió el estado (de "Retirado" a "En camino al destinatario")
        // NO agregar si solo hay reasignación sin cambio de estado (para evitar duplicados en la página pública)
        // Las asignaciones se pueden ver en la tabla de asignaciones del frontend
        if (cambioEstado) {
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(envio.getEstado());
            historial.setFecha(ahora);
            historial.setQuien(usuarioAsignador != null ? usuarioAsignador : "Usuario");
            historial.setOrigen(origen != null ? origen : "WEB");
            
            // Construir observación según el caso
            String observacion = "Estado: " + estadoAnterior + " -> " + envio.getEstado();
            if (esReasignacion) {
                observacion += " | Reasignado desde: " + choferAnterior + " a: " + choferNombre;
            } else if (esPrimeraAsignacion || choferNombre != null) {
                observacion += " | Asignado a: " + choferNombre;
            }
            
            historial.setObservaciones(observacion);
            historialEnvioRepository.save(historial);
        } else if (esReasignacion) {
            // Si solo hubo reasignación sin cambio de estado, agregar al historial
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(envio.getEstado());
            historial.setFecha(ahora);
            historial.setQuien(usuarioAsignador != null ? usuarioAsignador : "Usuario");
            historial.setOrigen(origen != null ? origen : "WEB");
            historial.setObservaciones("Reasignado desde: " + choferAnterior + " a: " + choferNombre);
            historialEnvioRepository.save(historial);
        } else if (esPrimeraAsignacion) {
            // Primera asignación sin cambio de estado (ej. "A retirar" -> chofer): registrar en historial
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(envio.getEstado());
            historial.setFecha(ahora);
            historial.setQuien(usuarioAsignador != null ? usuarioAsignador : "Usuario");
            historial.setOrigen(origen != null ? origen : "WEB");
            historial.setObservaciones("Asignado a: " + choferNombre);
            historialEnvioRepository.save(historial);
        }
        
        return toDTO(envio);
    }

    @Transactional
    public List<EnvioDTO> crearEnviosMasivos(List<EnvioDTO> enviosDTO) {
        // Calcular costo de envío para envíos directos antes de guardar
        for (EnvioDTO envioDTO : enviosDTO) {
            if ("Directo".equals(envioDTO.getOrigen()) && envioDTO.getCliente() != null && !envioDTO.getCliente().trim().isEmpty()) {
                calcularCostoEnvioParaDirecto(envioDTO);
            }
        }
        
        // Procesar en lotes para mejor rendimiento con batch inserts
        List<Envio> enviosGuardados = new ArrayList<>();
        int batchSize = 50; // Coincide con hibernate.jdbc.batch_size
        
        for (int i = 0; i < enviosDTO.size(); i += batchSize) {
            int end = Math.min(i + batchSize, enviosDTO.size());
            List<EnvioDTO> batch = enviosDTO.subList(i, end);
            
            List<Envio> envios = batch.stream()
                    .map(this::toEntity)
                    .collect(Collectors.toList());
            
            List<Envio> batchGuardados = envioRepository.saveAll(envios);
            enviosGuardados.addAll(batchGuardados);
        }
        
        List<EnvioDTO> resultados = enviosGuardados.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        
        // El email "Tu pedido está en camino" se envía cuando el envío pasa a estado Retirado (no al crear)
        
        return resultados;
    }

    private Specification<Envio> buildSpecification(EnvioFilterDTO filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Por defecto, excluir eliminados (excepto si se filtra específicamente por eliminados)
            if (filter.getEstado() == null || !filter.getEstado().equals("Eliminados")) {
                predicates.add(cb.equal(root.get("eliminado"), false));
            } else {
                predicates.add(cb.equal(root.get("eliminado"), true));
            }
            
            // Solo mostrar envíos colectados (escaneados) en las vistas
            // EXCEPCIÓN: Los envíos de Tienda Nube, Shopify y VTEX se muestran aunque no estén colectados (se crean directamente)
            // Los envíos Flex se sincronizan con colectado=false y solo aparecen cuando se escanean
            // Manejar NULL como true (para envíos antiguos que no tienen este campo - se consideran colectados)
            predicates.add(cb.or(
                cb.equal(root.get("colectado"), true),
                cb.isNull(root.get("colectado")),
                cb.equal(root.get("origen"), "Tienda Nube"), // Incluir envíos de Tienda Nube aunque no estén colectados
                cb.equal(root.get("origen"), "Shopify"), // Incluir envíos de Shopify aunque no estén colectados
                cb.equal(root.get("origen"), "VTEX"), // Incluir envíos de VTEX aunque no estén colectados
                cb.equal(root.get("origen"), "Vtex") // Incluir envíos de Vtex (variante) aunque no estén colectados
            ));

            // Filtro por código de cliente (para usuarios "Cliente")
            if (filter.getCodigoCliente() != null && !filter.getCodigoCliente().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("cliente")),
                        "%" + filter.getCodigoCliente().toLowerCase() + "%"
                ));
            }

            // Filtro por chofer asignado (para usuarios "Chofer": solo sus envíos)
            if (filter.getChoferId() != null) {
                predicates.add(cb.equal(root.get("choferAsignadoId"), filter.getChoferId()));
            }

            // Filtro por tipo de fecha
            if (filter.getFechaDesde() != null || filter.getFechaHasta() != null) {
                String tipoFecha = filter.getTipoFecha() != null ? filter.getTipoFecha() : "fechaLlegue";
                
                LocalDateTime fechaDesde = null;
                LocalDateTime fechaHasta = null;
                
                if (filter.getFechaDesde() != null && !filter.getFechaDesde().trim().isEmpty()) {
                    fechaDesde = LocalDate.parse(filter.getFechaDesde(), DATE_FORMATTER).atStartOfDay();
                }
                if (filter.getFechaHasta() != null && !filter.getFechaHasta().trim().isEmpty()) {
                    fechaHasta = LocalDate.parse(filter.getFechaHasta(), DATE_FORMATTER).atTime(23, 59, 59);
                }

                if (fechaDesde != null || fechaHasta != null) {
                    switch (tipoFecha) {
                        case "fechaVenta":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaVenta"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaVenta"), fechaHasta));
                            break;
                        case "fechaLlegue":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaLlegue"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaLlegue"), fechaHasta));
                            break;
                        case "fechaEntregado":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaEntregado"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaEntregado"), fechaHasta));
                            break;
                        case "fechaAsignacion":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaAsignacion"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaAsignacion"), fechaHasta));
                            break;
                        case "fechaColecta":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaColecta"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaColecta"), fechaHasta));
                            break;
                        case "fechaCancelado":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaCancelado"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaCancelado"), fechaHasta));
                            break;
                        case "fechaUltimoMovimiento":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaUltimoMovimiento"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaUltimoMovimiento"), fechaHasta));
                            break;
                        default:
                            // Por defecto usar fecha de carga
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fecha"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fecha"), fechaHasta));
                    }
                }
            }

            // Filtro por estado
            if (filter.getEstado() != null && !filter.getEstado().trim().isEmpty() && !filter.getEstado().equals("todos") && !filter.getEstado().equals("Eliminados")) {
                if (filter.getEstado().equals("Pendientes")) {
                    predicates.add(cb.not(cb.equal(root.get("estado"), "Entregado")));
                    predicates.add(cb.not(cb.equal(root.get("estado"), "Cancelado")));
                    predicates.add(cb.not(cb.equal(root.get("estado"), "Devuelto al cliente")));
                    predicates.add(cb.not(cb.equal(root.get("estado"), "Entregado 2DA visita")));
                } else {
                    predicates.add(cb.equal(root.get("estado"), filter.getEstado()));
                }
            }

            // Filtro por origen
            if (filter.getOrigen() != null && !filter.getOrigen().trim().isEmpty() && !filter.getOrigen().equals("todos")) {
                // Si se selecciona "Mercado Libre", incluir también envíos con origen "Flex"
                if (filter.getOrigen().equals("Mercado Libre")) {
                    predicates.add(cb.or(
                        cb.equal(root.get("origen"), "Mercado Libre"),
                        cb.equal(root.get("origen"), "Flex")
                    ));
                } else {
                    predicates.add(cb.equal(root.get("origen"), filter.getOrigen()));
                }
            }

            // Filtro por tracking o ID_MVG (buscador)
            if (filter.getTracking() != null && !filter.getTracking().trim().isEmpty()) {
                String term = "%" + filter.getTracking().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("tracking")), term),
                    cb.like(cb.lower(root.get("idMvg")), term)
                ));
            }

            // Filtro por ID venta (buscar en tracking o ID_MVG)
            if (filter.getIdVenta() != null && !filter.getIdVenta().trim().isEmpty()) {
                String term = "%" + filter.getIdVenta().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("tracking")), term),
                    cb.like(cb.lower(root.get("idMvg")), term)
                ));
            }

            // Filtro por nombre fantasía (cliente)
            if (filter.getNombreFantasia() != null && !filter.getNombreFantasia().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("cliente")),
                        "%" + filter.getNombreFantasia().toLowerCase() + "%"
                ));
            }

            // Filtro por destino nombre
            if (filter.getDestinoNombre() != null && !filter.getDestinoNombre().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("nombreDestinatario")),
                        "%" + filter.getDestinoNombre().toLowerCase() + "%"
                ));
            }

            // Filtro por destino dirección
            if (filter.getDestinoDireccion() != null && !filter.getDestinoDireccion().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("direccion")),
                        "%" + filter.getDestinoDireccion().toLowerCase() + "%"
                ));
            }

            // Filtro por zona de entrega
            if (filter.getZonasEntrega() != null && !filter.getZonasEntrega().trim().isEmpty() && !filter.getZonasEntrega().equals("todos")) {
                predicates.add(cb.like(
                        cb.lower(root.get("zonaEntrega")),
                        "%" + filter.getZonasEntrega().toLowerCase() + "%"
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public List<HistorialEnvioDTO> obtenerHistorialEnvio(Long envioId) {
        List<HistorialEnvio> historial = historialEnvioRepository.findByEnvioIdOrderByFechaDesc(envioId);
        return historial.stream()
                .map(this::historialToDTO)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public List<ObservacionEnvioDTO> obtenerObservacionesEnvio(Long envioId) {
        List<ObservacionEnvio> observaciones = observacionEnvioRepository.findByEnvioIdOrderByFechaDesc(envioId);
        return observaciones.stream()
                .map(this::observacionToDTO)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public List<ImagenEnvioDTO> obtenerImagenesEnvio(Long envioId) {
        List<ImagenEnvio> imagenes = imagenEnvioRepository.findByEnvioIdOrderByFechaDesc(envioId);
        return imagenes.stream()
                .map(this::imagenToDTO)
                .collect(Collectors.toList());
    }
    
    private ObservacionEnvioDTO observacionToDTO(ObservacionEnvio observacion) {
        ObservacionEnvioDTO dto = new ObservacionEnvioDTO();
        dto.setId(observacion.getId());
        dto.setEnvioId(observacion.getEnvioId());
        dto.setObservacion(observacion.getObservacion());
        dto.setFecha(observacion.getFecha());
        dto.setQuien(observacion.getQuien());
        return dto;
    }
    
    private ImagenEnvioDTO imagenToDTO(ImagenEnvio imagen) {
        ImagenEnvioDTO dto = new ImagenEnvioDTO();
        dto.setId(imagen.getId());
        dto.setEnvioId(imagen.getEnvioId());
        dto.setUrlImagen(imagen.getUrlImagen());
        dto.setFecha(imagen.getFecha());
        dto.setQuien(imagen.getQuien());
        dto.setTipo(imagen.getTipo());
        return dto;
    }

    @Transactional(readOnly = true)
    public List<EnvioDTO> obtenerEnviosParaRuta(Long choferId) {
        List<Envio> envios = envioRepository.findByChoferAsignadoIdAndEstadoAndEliminadoFalseAndColectadoTrue(
                choferId, 
                "En camino al destinatario"
        );
        return envios.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ChoferConUbicacionDTO> obtenerChoferesConEnviosAsignados() {
        // Obtener IDs de choferes con envíos en estado "En camino al destinatario"
        List<Long> choferIds = envioRepository.findChoferIdsConEnviosEnEstado("En camino al destinatario");
        
        if (choferIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        // Obtener información de los choferes
        List<Usuario> choferes = usuarioRepository.findAllById(choferIds);
        
        // Construir DTOs con información de envíos
        return choferes.stream()
                .map(chofer -> {
                    List<Envio> envios = envioRepository.findByChoferAsignadoIdAndEstadoAndEliminadoFalseAndColectadoTrue(
                            chofer.getId(), 
                            "En camino al destinatario"
                    );
                    
                    ChoferConUbicacionDTO dto = new ChoferConUbicacionDTO();
                    dto.setId(chofer.getId());
                    dto.setNombre(chofer.getNombre());
                    dto.setApellido(chofer.getApellido());
                    dto.setNombreCompleto(String.format("%s %s", chofer.getNombre(), chofer.getApellido()).trim());
                    dto.setLatitud(chofer.getLatitud());
                    dto.setLongitud(chofer.getLongitud());
                    dto.setUltimaActualizacionUbicacion(chofer.getUltimaActualizacionUbicacion());
                    dto.setBateria(chofer.getBateria());
                    dto.setCantidadEnvios(envios.size());
                    dto.setEnvios(envios.stream()
                            .map(this::toDTO)
                            .collect(Collectors.toList()));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private HistorialEnvioDTO historialToDTO(HistorialEnvio historial) {
        HistorialEnvioDTO dto = new HistorialEnvioDTO();
        dto.setId(historial.getId());
        dto.setEnvioId(historial.getEnvioId());
        dto.setEstado(historial.getEstado());
        dto.setFecha(historial.getFecha());
        dto.setQuien(historial.getQuien());
        dto.setObservaciones(historial.getObservaciones());
        dto.setOrigen(historial.getOrigen());
        return dto;
    }

    private EnvioDTO toDTO(Envio envio) {
        EnvioDTO dto = new EnvioDTO();
        dto.setId(envio.getId());
        dto.setFecha(envio.getFecha());
        dto.setFechaVenta(envio.getFechaVenta());
        dto.setFechaLlegue(envio.getFechaLlegue());
        dto.setFechaEntregado(envio.getFechaEntregado());
        dto.setFechaAsignacion(envio.getFechaAsignacion());
        dto.setFechaDespacho(envio.getFechaDespacho());
        dto.setFechaColecta(envio.getFechaColecta());
        dto.setFechaAPlanta(envio.getFechaAPlanta());
        dto.setFechaCancelado(envio.getFechaCancelado());
        dto.setFechaUltimoMovimiento(envio.getFechaUltimoMovimiento());
        dto.setOrigen(envio.getOrigen());
        dto.setTracking(envio.getTracking());
        dto.setIdMvg(envio.getIdMvg());
        dto.setCliente(envio.getCliente());
        dto.setDireccion(envio.getDireccion());
        dto.setNombreDestinatario(envio.getNombreDestinatario());
        dto.setTelefono(envio.getTelefono());
        dto.setEmail(envio.getEmail());
        dto.setImpreso(envio.getImpreso());
        dto.setObservaciones(envio.getObservaciones());
        dto.setTotalACobrar(envio.getTotalACobrar());
        dto.setCambioRetiro(envio.getCambioRetiro());
        dto.setLocalidad(envio.getLocalidad());
        dto.setCodigoPostal(envio.getCodigoPostal());
        dto.setZonaEntrega(envio.getZonaEntrega());
        dto.setQrData(envio.getQrData());
        dto.setEstado(envio.getEstado());
        dto.setEliminado(envio.getEliminado());
        dto.setChoferAsignadoId(envio.getChoferAsignadoId());
        dto.setChoferAsignadoNombre(envio.getChoferAsignadoNombre());
        dto.setRolRecibio(envio.getRolRecibio());
        dto.setNombreRecibio(envio.getNombreRecibio());
        dto.setDniRecibio(envio.getDniRecibio());
        dto.setColectado(envio.getColectado() != null ? envio.getColectado() : false);
        dto.setCostoEnvio(envio.getCostoEnvio());
        dto.setIdml(envio.getIdml());
        dto.setPeso(envio.getPeso());
        dto.setMetodoEnvio(envio.getMetodoEnvio());
        dto.setDeadline(envio.getDeadline());
        dto.setMlShipmentId(envio.getMlShipmentId());
        dto.setTrackingToken(envio.getTrackingToken());
        return dto;
    }

    private Envio toEntity(EnvioDTO dto) {
        Envio envio = new Envio();
        envio.setFecha(dto.getFecha() != null ? dto.getFecha() : LocalDateTime.now());
        envio.setFechaVenta(dto.getFechaVenta());
        envio.setFechaLlegue(dto.getFechaLlegue());
        envio.setFechaEntregado(dto.getFechaEntregado());
        envio.setFechaAsignacion(dto.getFechaAsignacion());
        envio.setFechaDespacho(dto.getFechaDespacho());
        envio.setFechaColecta(dto.getFechaColecta());
        envio.setFechaAPlanta(dto.getFechaAPlanta());
        envio.setFechaCancelado(dto.getFechaCancelado());
        envio.setFechaUltimoMovimiento(dto.getFechaUltimoMovimiento());
        envio.setOrigen(dto.getOrigen() != null ? dto.getOrigen() : "Directo");
        envio.setTracking(dto.getTracking());
        envio.setIdMvg(dto.getIdMvg());
        envio.setCliente(dto.getCliente());
        envio.setDireccion(dto.getDireccion());
        envio.setNombreDestinatario(dto.getNombreDestinatario());
        envio.setTelefono(dto.getTelefono());
        envio.setEmail(dto.getEmail());
        envio.setImpreso(dto.getImpreso() != null ? dto.getImpreso() : "NO");
        envio.setObservaciones(dto.getObservaciones());
        envio.setTotalACobrar(dto.getTotalACobrar());
        envio.setCambioRetiro(dto.getCambioRetiro());
        envio.setLocalidad(dto.getLocalidad());
        envio.setCodigoPostal(dto.getCodigoPostal());
        envio.setZonaEntrega(dto.getZonaEntrega());
        envio.setQrData(dto.getQrData());
        envio.setEstado(dto.getEstado() != null ? dto.getEstado() : "A retirar");
        envio.setEliminado(dto.getEliminado() != null ? dto.getEliminado() : false);
        // Los envíos creados manualmente (no Flex) tienen colectado=true por defecto
        // Los envíos Flex se crean con colectado=false y se marcan como true al escanear
        envio.setColectado(dto.getColectado() != null ? dto.getColectado() : 
                          (dto.getOrigen() != null && "Flex".equals(dto.getOrigen()) ? false : true));
        envio.setChoferAsignadoId(dto.getChoferAsignadoId());
        envio.setChoferAsignadoNombre(dto.getChoferAsignadoNombre());
        envio.setRolRecibio(dto.getRolRecibio());
        envio.setNombreRecibio(dto.getNombreRecibio());
        envio.setDniRecibio(dto.getDniRecibio());
        envio.setCostoEnvio(dto.getCostoEnvio());
        envio.setIdml(dto.getIdml());
        envio.setPeso(dto.getPeso());
        envio.setMetodoEnvio(dto.getMetodoEnvio());
        envio.setDeadline(dto.getDeadline());
        envio.setMlShipmentId(dto.getMlShipmentId());
        envio.setTrackingToken(dto.getTrackingToken());
        return envio;
    }
    
    @Transactional(readOnly = true)
    public List<ChoferCierreDTO> obtenerChoferesCierre(LocalDate fecha, boolean soloFlex) {
        List<Object[]> resultados = envioRepository.countEnviosPorChoferYFecha(fecha, soloFlex);
        
        // Obtener IDs de choferes
        List<Long> choferIds = resultados.stream()
                .map(result -> (Long) result[0])
                .collect(Collectors.toList());
        
        if (choferIds.isEmpty()) {
            return new ArrayList<>();
        }
        
        // Obtener información de los choferes
        List<Usuario> choferes = usuarioRepository.findAllById(choferIds);
        
        // Crear un mapa de choferId -> cantidadEnvios
        java.util.Map<Long, Long> cantidadPorChofer = resultados.stream()
                .collect(Collectors.toMap(
                        result -> (Long) result[0],
                        result -> (Long) result[1]
                ));
        
        // Construir DTOs
        return choferes.stream()
                .map(chofer -> {
                    Long cantidad = cantidadPorChofer.get(chofer.getId());
                    ChoferCierreDTO dto = new ChoferCierreDTO();
                    dto.setId(chofer.getId());
                    dto.setNombreCompleto(String.format("%s %s", chofer.getNombre(), chofer.getApellido()).trim());
                    dto.setCantidadEnvios(cantidad != null ? cantidad : 0L);
                    return dto;
                })
                .filter(dto -> dto.getCantidadEnvios() > 0) // Filtrar choferes con 0 envíos
                .sorted((a, b) -> Long.compare(b.getCantidadEnvios(), a.getCantidadEnvios())) // Ordenar por cantidad descendente
                .collect(Collectors.toList());
    }
    
    /**
     * Calcula el costo de envío para un envío directo basado en el cliente y código postal
     */
    private void calcularCostoEnvioParaDirecto(EnvioDTO envioDTO) {
        try {
            // Obtener el cliente desde el nombre (puede ser formato: "código - nombre" o solo nombre)
            String clienteStr = envioDTO.getCliente();
            if (clienteStr == null || clienteStr.trim().isEmpty()) {
                log.warn("No se puede calcular costo de envío - Cliente no disponible");
                return;
            }
            
            java.util.Optional<com.zetallegue.tms.model.Cliente> clienteOpt = java.util.Optional.empty();
            
            // Intentar primero por código si está en formato "código - nombre"
            if (clienteStr.contains(" - ")) {
                String codigoCliente = clienteStr.split(" - ")[0].trim();
                clienteOpt = clienteRepository.findByCodigo(codigoCliente);
                if (clienteOpt.isPresent()) {
                    log.info("Cliente encontrado por código: {}", codigoCliente);
                }
            }
            
            // Si no se encontró por código, buscar por nombre
            if (clienteOpt.isEmpty()) {
                String nombreCliente = clienteStr.contains(" - ") 
                    ? clienteStr.split(" - ", 2)[1].trim() 
                    : clienteStr.trim();
                
                // Buscar por nombreFantasia o razonSocial
                List<com.zetallegue.tms.model.Cliente> clientes = clienteRepository.findAll();
                clienteOpt = clientes.stream()
                    .filter(c -> (c.getNombreFantasia() != null && c.getNombreFantasia().equalsIgnoreCase(nombreCliente)) ||
                                (c.getRazonSocial() != null && c.getRazonSocial().equalsIgnoreCase(nombreCliente)))
                    .findFirst();
                
                if (clienteOpt.isPresent()) {
                    log.info("Cliente encontrado por nombre: {}", nombreCliente);
                }
            }
            
            if (clienteOpt.isEmpty()) {
                log.warn("No se puede calcular costo de envío - Cliente '{}' no encontrado (ni por código ni por nombre)", clienteStr);
                return;
            }
            
            com.zetallegue.tms.model.Cliente cliente = clienteOpt.get();
            String codigoPostal = envioDTO.getCodigoPostal();
            
            log.info("Intentando calcular costo de envío - Cliente ID: {}, Nombre: {}, ListaPreciosId: {}, CP: {}", 
                cliente.getId(), cliente.getNombreFantasia(), cliente.getListaPreciosId(), codigoPostal);
            
            if (codigoPostal != null && !codigoPostal.trim().isEmpty() && cliente.getListaPreciosId() != null) {
                try {
                    double costoEnvio = calcularCostoEnvioDesdeListaPrecios(codigoPostal, cliente.getListaPreciosId());
                    if (costoEnvio > 0) {
                        envioDTO.setCostoEnvio(String.format("%.2f", costoEnvio));
                        log.info("Costo de envío calculado desde lista de precios: ${} para CP: {}", String.format("%.2f", costoEnvio), codigoPostal);
                    } else {
                        envioDTO.setCostoEnvio(null);
                        log.info("No se pudo calcular el costo de envío desde lista de precios para CP: {} (continuando sin costo)", codigoPostal);
                    }
                } catch (Exception e) {
                    // NO propagar la excepción - esto es opcional y no debe romper la transacción
                    envioDTO.setCostoEnvio(null);
                    log.warn("Error al calcular costo de envío desde lista de precios (continuando sin costo): {}", e.getMessage());
                }
            } else {
                envioDTO.setCostoEnvio(null);
                if (codigoPostal == null || codigoPostal.trim().isEmpty()) {
                    log.warn("No se puede calcular costo de envío - CP no disponible para cliente {}", cliente.getId());
                } else if (cliente.getListaPreciosId() == null) {
                    log.warn("No se puede calcular costo de envío - Cliente {} ({}) sin lista de precios configurada", 
                        cliente.getId(), cliente.getNombreFantasia());
                }
            }
        } catch (Exception e) {
            log.warn("Error al calcular costo de envío para envío directo (continuando sin costo): {}", e.getMessage());
            envioDTO.setCostoEnvio(null);
        }
    }
    
    /**
     * Calcula el costo de envío desde la lista de precios del cliente
     */
    private double calcularCostoEnvioDesdeListaPrecios(String codigoPostal, Long listaPreciosId) {
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
            
            // Obtener la lista de precios directamente desde el repositorio (read-only, seguro)
            log.info("Buscando lista de precios con ID: {} para CP: {}", listaPreciosId, codigoPostal);
            java.util.Optional<com.zetallegue.tms.model.ListaPrecio> listaPrecioOpt = listaPrecioRepository.findById(listaPreciosId);
            if (listaPrecioOpt.isEmpty()) {
                log.warn("Lista de precios no encontrada con id: {}", listaPreciosId);
                return 0.0;
            }
            
            com.zetallegue.tms.model.ListaPrecio listaPrecio = listaPrecioOpt.get();
            log.info("Lista de precios encontrada: ID={}, Codigo={}, Nombre={}, ZonaPropia={}", 
                listaPrecio.getId(), listaPrecio.getCodigo(), listaPrecio.getNombre(), listaPrecio.getZonaPropia());
            List<com.zetallegue.tms.model.Zona> zonas;
            
            // Si no tiene zonas propias, cargar las zonas de la lista referenciada
            if (!listaPrecio.getZonaPropia() && listaPrecio.getListaPrecioSeleccionada() != null) {
                java.util.Optional<com.zetallegue.tms.model.ListaPrecio> listaReferenciadaOpt = listaPrecioRepository.findById(listaPrecio.getListaPrecioSeleccionada());
                if (listaReferenciadaOpt.isPresent()) {
                    com.zetallegue.tms.model.ListaPrecio listaReferenciada = listaReferenciadaOpt.get();
                    if (listaReferenciada.getZonaPropia() && listaReferenciada.getZonas() != null && !listaReferenciada.getZonas().isEmpty()) {
                        zonas = listaReferenciada.getZonas();
                    } else {
                        zonas = new java.util.ArrayList<>();
                    }
                } else {
                    zonas = new java.util.ArrayList<>();
                }
            } else if (listaPrecio.getZonaPropia() && listaPrecio.getZonas() != null) {
                zonas = listaPrecio.getZonas();
            } else {
                zonas = new java.util.ArrayList<>();
            }
            
            if (zonas.isEmpty()) {
                log.warn("Lista de precios sin zonas para ID: {}", listaPreciosId);
                return 0.0;
            }
            
            // Buscar el CP en las zonas
            for (com.zetallegue.tms.model.Zona zona : zonas) {
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
     * Verifica qué pedidos de la lista ya tienen envíos procesados en la base de datos.
     * Usa la misma lógica que findEnviosTiendaNubeDuplicados: cliente + fecha + destinatario.
     * 
     * @param requests Lista de pedidos a verificar
     * @return Map con pedidoKey como clave y true si existe envío, false si no
     */
    @Transactional(readOnly = true)
    public Map<String, Boolean> verificarEnviosExistentes(List<com.zetallegue.tms.controller.EnvioController.VerificarEnvioRequest> requests) {
        Map<String, Boolean> resultados = new HashMap<>();
        
        for (com.zetallegue.tms.controller.EnvioController.VerificarEnvioRequest request : requests) {
            boolean existe = false;
            
            // Solo verificar para Tienda Nube (VTEX usa otro método)
            if ("TiendaNube".equals(request.getOrigen()) || "Tienda Nube".equals(request.getOrigen())) {
                if (request.getCliente() != null && request.getFechaVenta() != null && request.getDestinatario() != null && !request.getDestinatario().trim().isEmpty()) {
                    try {
                        // Parsear fecha usando el mismo método que EnvioServiceTiendaNube
                        LocalDateTime fechaVenta = parsearFechaTiendaNube(request.getFechaVenta());
                        LocalDateTime fechaDesde = fechaVenta.minusMinutes(2);
                        LocalDateTime fechaHasta = fechaVenta.plusMinutes(2);
                        
                        log.debug("Verificando envío existente - Cliente: {}, Fecha: {} (rango: {} - {}), Destinatario: {}", 
                            request.getCliente(), fechaVenta, fechaDesde, fechaHasta, request.getDestinatario().trim());
                        
                        // Buscar envíos duplicados usando la misma lógica que el backend
                        List<Envio> enviosExistentes = envioRepository.findEnviosTiendaNubeDuplicados(
                            request.getCliente(),
                            fechaDesde,
                            fechaHasta,
                            request.getDestinatario().trim()
                        );
                        
                        existe = !enviosExistentes.isEmpty();
                        if (existe) {
                            log.debug("✅ Envío encontrado para pedidoKey: {}", request.getPedidoKey());
                        } else {
                            log.debug("❌ No se encontró envío para pedidoKey: {}", request.getPedidoKey());
                        }
                    } catch (Exception e) {
                        log.warn("Error al verificar envío existente para pedidoKey {}: {}", request.getPedidoKey(), e.getMessage(), e);
                    }
                } else {
                    log.debug("Faltan datos para verificar pedidoKey {}: cliente={}, fechaVenta={}, destinatario={}", 
                        request.getPedidoKey(), request.getCliente() != null, request.getFechaVenta() != null, request.getDestinatario() != null);
                }
            } else if ("Vtex".equals(request.getOrigen())) {
                // Para VTEX, buscar por tracking "VTEX-{orderId}"
                // Necesitamos extraer el orderId del pedidoKey
                try {
                    String orderId = request.getPedidoKey().substring(request.getPedidoKey().indexOf("-") + 1);
                    String tracking = "VTEX-" + orderId;
                    List<Envio> enviosExistentes = envioRepository.findByTrackingAndEliminadoFalse(tracking);
                    existe = !enviosExistentes.isEmpty() && enviosExistentes.stream()
                        .anyMatch(e -> "VTEX".equals(e.getOrigen()) || "Vtex".equals(e.getOrigen()));
                } catch (Exception e) {
                    log.warn("Error al verificar envío VTEX existente para pedidoKey {}: {}", request.getPedidoKey(), e.getMessage());
                }
            } else if ("Shopify".equals(request.getOrigen())) {
                // Para Shopify, usar el mismo método que Tienda Nube (cliente + fecha + destinatario)
                if (request.getCliente() != null && request.getFechaVenta() != null && request.getDestinatario() != null && !request.getDestinatario().trim().isEmpty()) {
                    try {
                        // Parsear fecha usando el mismo método que EnvioServiceShopify
                        LocalDateTime fechaVenta = parsearFechaShopify(request.getFechaVenta());
                        if (fechaVenta == null) {
                            log.warn("No se pudo parsear fecha de Shopify: {}", request.getFechaVenta());
                            resultados.put(request.getPedidoKey(), false);
                            continue;
                        }
                        LocalDateTime fechaDesde = fechaVenta.minusMinutes(2);
                        LocalDateTime fechaHasta = fechaVenta.plusMinutes(2);
                        
                        log.info("🔍 VERIFICANDO ENVÍO SHOPIFY EXISTENTE - Cliente: '{}', Fecha: {} (rango: {} - {}), Destinatario: '{}'", 
                            request.getCliente(), fechaVenta, fechaDesde, fechaHasta, request.getDestinatario().trim());
                        
                        // Buscar envíos duplicados usando la misma lógica que el backend
                        List<Envio> enviosExistentes = envioRepository.findEnviosShopifyDuplicados(
                            request.getCliente(),
                            fechaDesde,
                            fechaHasta,
                            request.getDestinatario().trim()
                        );
                        
                        // Log detallado de todos los envíos Shopify encontrados para debug
                        if (!enviosExistentes.isEmpty()) {
                            log.info("📦 Envíos Shopify encontrados en BD ({}):", enviosExistentes.size());
                            for (Envio e : enviosExistentes) {
                                log.info("   - ID: {}, Cliente: '{}', FechaVenta: {}, NombreDestinatario: '{}', Origen: '{}'", 
                                    e.getId(), e.getCliente(), e.getFechaVenta(), e.getNombreDestinatario(), e.getOrigen());
                            }
                        } else {
                            // Buscar envíos Shopify del cliente usando query optimizada (solo para debug)
                            // Usar un rango de fechas más amplio para encontrar envíos similares
                            LocalDateTime fechaDesdeAmplia = fechaVenta.minusHours(2);
                            LocalDateTime fechaHastaAmplia = fechaVenta.plusHours(2);
                            List<Envio> enviosSimilares = envioRepository.findEnviosShopifyDuplicados(
                                request.getCliente(),
                                fechaDesdeAmplia,
                                fechaHastaAmplia,
                                request.getDestinatario().trim()
                            );
                            log.warn("⚠️ No se encontró envío en rango estrecho, pero hay {} envíos Shopify similares del cliente '{}' en rango amplio:", 
                                enviosSimilares.size(), request.getCliente());
                            for (Envio e : enviosSimilares) {
                                log.warn("   - ID: {}, Cliente: '{}', FechaVenta: {}, NombreDestinatario: '{}', Origen: '{}', Tracking: '{}'", 
                                    e.getId(), e.getCliente(), e.getFechaVenta(), e.getNombreDestinatario(), e.getOrigen(), e.getTracking());
                            }
                        }
                        
                        existe = !enviosExistentes.isEmpty();
                        if (existe) {
                            log.info("✅ Envío Shopify encontrado para pedidoKey: {}", request.getPedidoKey());
                        } else {
                            log.warn("❌ No se encontró envío Shopify para pedidoKey: {}", request.getPedidoKey());
                        }
                    } catch (Exception e) {
                        log.warn("Error al verificar envío Shopify existente para pedidoKey {}: {}", request.getPedidoKey(), e.getMessage(), e);
                    }
                } else {
                    log.debug("Faltan datos para verificar pedidoKey Shopify {}: cliente={}, fechaVenta={}, destinatario={}", 
                        request.getPedidoKey(), request.getCliente() != null, request.getFechaVenta() != null, request.getDestinatario() != null);
                }
            }
            
            resultados.put(request.getPedidoKey(), existe);
        }
        
        return resultados;
    }

    /**
     * Busca un envío por cliente, fecha de venta y destinatario (para Tienda Nube, VTEX y Shopify)
     * @return El envío encontrado o null si no existe
     */
    @Transactional(readOnly = true)
    public EnvioDTO buscarEnvioPorPedido(String cliente, String fechaVentaStr, String destinatario, String origen) {
        if (cliente == null || fechaVentaStr == null || destinatario == null || destinatario.trim().isEmpty()) {
            return null;
        }

        try {
            LocalDateTime fechaVenta;
            if ("Shopify".equals(origen)) {
                fechaVenta = parsearFechaShopify(fechaVentaStr);
            } else {
                fechaVenta = parsearFechaTiendaNube(fechaVentaStr);
            }
            
            if (fechaVenta == null) {
                log.warn("No se pudo parsear fecha para origen {}: {}", origen, fechaVentaStr);
                return null;
            }
            
            LocalDateTime fechaDesde = fechaVenta.minusMinutes(2);
            LocalDateTime fechaHasta = fechaVenta.plusMinutes(2);

            if ("TiendaNube".equals(origen) || "Tienda Nube".equals(origen)) {
                List<Envio> envios = envioRepository.findEnviosTiendaNubeDuplicados(
                    cliente,
                    fechaDesde,
                    fechaHasta,
                    destinatario.trim()
                );
                
                if (!envios.isEmpty()) {
                    return toDTO(envios.get(0));
                }
            } else if ("Vtex".equals(origen)) {
                // Para VTEX, buscar por origen y cliente (el tracking no es confiable)
                // Usar el mismo método pero adaptado para VTEX
                // Por ahora, buscar por cliente y fecha
                List<Envio> envios = envioRepository.findAll().stream()
                    .filter(e -> "VTEX".equals(e.getOrigen()) || "Vtex".equals(e.getOrigen()))
                    .filter(e -> !e.getEliminado())
                    .filter(e -> cliente.equals(e.getCliente()))
                    .filter(e -> e.getFechaVenta() != null && 
                                e.getFechaVenta().isAfter(fechaDesde) && 
                                e.getFechaVenta().isBefore(fechaHasta))
                    .filter(e -> destinatario.trim().equalsIgnoreCase(e.getNombreDestinatario() != null ? e.getNombreDestinatario().trim() : ""))
                    .collect(Collectors.toList());
                
                if (!envios.isEmpty()) {
                    return toDTO(envios.get(0));
                }
            } else if ("Shopify".equals(origen)) {
                // Para Shopify, usar el mismo método que Tienda Nube
                List<Envio> envios = envioRepository.findEnviosShopifyDuplicados(
                    cliente,
                    fechaDesde,
                    fechaHasta,
                    destinatario.trim()
                );
                
                if (!envios.isEmpty()) {
                    return toDTO(envios.get(0));
                }
            }
        } catch (Exception e) {
            log.warn("Error al buscar envío por pedido: {}", e.getMessage(), e);
        }

        return null;
    }

    /**
     * Parsea una fecha de Tienda Nube usando el mismo método que EnvioServiceTiendaNube
     */
    private LocalDateTime parsearFechaTiendaNube(String fechaStr) {
        try {
            if (fechaStr.contains("T")) {
                String fechaPart = fechaStr.split("T")[0];
                String horaPart = fechaStr.split("T")[1];
                horaPart = horaPart.split("\\+")[0].split("-")[0].split("\\.")[0];
                return LocalDateTime.parse(fechaPart + "T" + horaPart);
            } else {
                return LocalDate.parse(fechaStr).atStartOfDay();
            }
        } catch (Exception e) {
            log.warn("Error al parsear fecha de Tienda Nube: {}", fechaStr, e);
            return LocalDateTime.now();
        }
    }
    
    /**
     * Parsea una fecha de Shopify usando el mismo método que EnvioServiceShopify
     * Maneja formatos ISO-8601 con timezone offset (con o sin dos puntos)
     */
    private LocalDateTime parsearFechaShopify(String fechaStr) {
        try {
            // Shopify usa formato ISO-8601: "2024-01-15T10:30:00-03:00" o "2024-01-15T10:30:00Z" o "2024-01-15T10:30:00+01:00"
            // Usar ZonedDateTime para manejar correctamente el timezone y luego convertir a LocalDateTime
            java.time.ZonedDateTime zonedDateTime;
            
            if (fechaStr.endsWith("Z")) {
                // Formato UTC
                zonedDateTime = java.time.ZonedDateTime.parse(fechaStr, DateTimeFormatter.ISO_INSTANT);
            } else {
                // Formato con timezone offset
                zonedDateTime = java.time.ZonedDateTime.parse(fechaStr, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            
            // Convertir a LocalDateTime (sin timezone, solo fecha y hora)
            return zonedDateTime.toLocalDateTime();
        } catch (Exception e) {
            log.warn("Error al parsear fecha de Shopify: '{}' - Error: {}", fechaStr, e.getMessage());
            // Retornar null si no se puede parsear (no usar LocalDateTime.now() como fallback)
            return null;
        }
    }
}


