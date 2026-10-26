package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.ChoferConUbicacionDTO;
import com.zetallegue.tms.dto.ChoferCierreDTO;
import com.zetallegue.tms.dto.ChoferHistorialDTO;
import com.zetallegue.tms.dto.EnvioDTO;
import com.zetallegue.tms.dto.EnvioFilterDTO;
import com.zetallegue.tms.dto.HistorialEnvioDTO;
import com.zetallegue.tms.dto.ObservacionEnvioDTO;
import com.zetallegue.tms.dto.ImagenEnvioDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.model.Cliente;
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
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
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
    private final GeocodeService geocodeService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    
    /**
     * Busca envío existente por número de tracking del carrier (p. ej. sincronización Mercado Libre).
     * No usar para el buscador web: el tracking puede repetirse entre clientes distintos.
     */
    @Transactional
    public java.util.Optional<Envio> findByTracking(String tracking) {
        if (tracking == null || tracking.trim().isEmpty()) {
            return java.util.Optional.empty();
        }
        List<Envio> envios = envioRepository.findByTrackingAndEliminadoFalse(tracking.trim());
        if (envios.isEmpty()) {
            return java.util.Optional.empty();
        }
        Envio envio = ensurePublicTrackingToken(envios.get(0));
        return java.util.Optional.of(envio);
    }

    /** Buscador de pedidos: solo por ID_NX (columna {@code id_mvg}), nunca por tracking. */
    @Transactional
    public java.util.Optional<Envio> findForBuscadorPorIdNx(String idNx) {
        if (idNx == null || idNx.trim().isEmpty()) {
            return java.util.Optional.empty();
        }
        List<Envio> envios = envioRepository.findByIdMvgAndEliminadoFalse(idNx.trim());
        if (envios.isEmpty()) {
            return java.util.Optional.empty();
        }
        Envio envio = ensurePublicTrackingToken(envios.get(0));
        return java.util.Optional.of(envio);
    }

    private Envio ensurePublicTrackingToken(Envio envio) {
        if (envio.getTrackingToken() == null || envio.getTrackingToken().trim().isEmpty()) {
            String base = (envio.getIdMvg() != null && !envio.getIdMvg().trim().isEmpty())
                    ? envio.getIdMvg()
                    : (envio.getTracking() != null && !envio.getTracking().trim().isEmpty()
                        ? envio.getTracking()
                        : String.valueOf(envio.getId()));
            String trackingToken = generarTrackingToken(base, envio.getId());
            envio.setTrackingToken(trackingToken);
            envio = envioRepository.save(envio);
            log.info("Tracking token regenerado para envío {}: {}", envio.getId(), trackingToken);
        }
        return envio;
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
            log.info("ID_NX generado para envío Directo - Semilla: {}, ID_NX: {}", semilla, idMvg);
        }
        
        // Calcular costo de envío si es un envío directo y tiene cliente y código postal
        if ("Directo".equals(envioDTO.getOrigen()) && envioDTO.getCliente() != null && !envioDTO.getCliente().trim().isEmpty()) {
            calcularCostoEnvioParaDirecto(envioDTO);
        }
        
        Envio envio = toEntity(envioDTO);
        asegurarIdMvgParaFlex(envio);
        
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
        if (envioDTO.getFechaAdjudicacion() != null) envio.setFechaAdjudicacion(envioDTO.getFechaAdjudicacion());
        if (envioDTO.getFechaDespacho() != null) envio.setFechaDespacho(envioDTO.getFechaDespacho());
        if (envioDTO.getFechaRetiro() != null) envio.setFechaRetiro(envioDTO.getFechaRetiro());
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
        if (envioDTO.getTotalACobrar() != null) envio.setTotalACobrar(normalizarTotalACobrar(envioDTO.getTotalACobrar()));
        if (envioDTO.getCambioRetiro() != null) envio.setCambioRetiro(envioDTO.getCambioRetiro());
        if (envioDTO.getLocalidad() != null) envio.setLocalidad(envioDTO.getLocalidad());
        if (envioDTO.getCodigoPostal() != null) envio.setCodigoPostal(envioDTO.getCodigoPostal());
        if (envioDTO.getZonaEntrega() != null) envio.setZonaEntrega(envioDTO.getZonaEntrega());
        if (envioDTO.getQrData() != null) envio.setQrData(envioDTO.getQrData());
        if (envioDTO.getEstado() != null) envio.setEstado(envioDTO.getEstado());
        if (envioDTO.getEliminado() != null) envio.setEliminado(envioDTO.getEliminado());
        if (envioDTO.getRetirado() != null) envio.setRetirado(envioDTO.getRetirado());
        if (envioDTO.getCostoEnvio() != null) envio.setCostoEnvio(envioDTO.getCostoEnvio());
        if (envioDTO.getIdml() != null) envio.setIdml(envioDTO.getIdml());
        if (envioDTO.getPeso() != null) envio.setPeso(envioDTO.getPeso());
        if (envioDTO.getMetodoEnvio() != null) envio.setMetodoEnvio(envioDTO.getMetodoEnvio());
        if (envioDTO.getDeadline() != null) envio.setDeadline(envioDTO.getDeadline());
        if (envioDTO.getMlShipmentId() != null) envio.setMlShipmentId(envioDTO.getMlShipmentId());
        if (envioDTO.getLatDestino() != null) envio.setLatDestino(envioDTO.getLatDestino());
        if (envioDTO.getLngDestino() != null) envio.setLngDestino(envioDTO.getLngDestino());

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
                                     String rolRecibio, String nombreRecibio, String dniRecibio,
                                     Double latitud, Double longitud, Double destinoLat, Double destinoLng,
                                     String ubicacionDireccion) {
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

        // No permitir pasar a "En camino al destinatario" sin haber pasado por "Retirado"
        if ("En camino al destinatario".equals(estado) && "A retirar".equals(estadoAnterior)) {
            throw new RuntimeException("No se puede pasar a 'En camino al destinatario' desde 'A retirar'. " +
                    "El envío debe marcarse primero como 'Retirado'.");
        }

        boolean requiereProximidad = "Nadie".equals(estado) || "Rechazado por el comprador".equals(estado);
        Double ubicacionHistorialLat = latitud;
        Double ubicacionHistorialLng = longitud;
        if (requiereProximidad) {
            Double destLat = envio.getLatDestino();
            Double destLng = envio.getLngDestino();
            if ((destLat == null || destLng == null) && destinoLat != null && destinoLng != null) {
                destLat = destinoLat;
                destLng = destinoLng;
                envio.setLatDestino(destinoLat);
                envio.setLngDestino(destinoLng);
            }
            if (destLat == null || destLng == null) {
                throw new RuntimeException(
                        "No se puede verificar la distancia al destino. Geolocalizá el envío antes de continuar.");
            }

            java.util.List<double[]> puntos = new java.util.ArrayList<>();
            if (latitud != null && longitud != null) {
                puntos.add(new double[]{latitud, longitud});
            }
            if (envio.getChoferAdjudicadoId() != null) {
                Usuario chofer = usuarioRepository.findById(envio.getChoferAdjudicadoId()).orElse(null);
                if (chofer != null && chofer.getLatitud() != null && chofer.getLongitud() != null) {
                    puntos.add(new double[]{chofer.getLatitud(), chofer.getLongitud()});
                    // Preferir tracker para el historial (ubicación operativa del chofer)
                    ubicacionHistorialLat = chofer.getLatitud();
                    ubicacionHistorialLng = chofer.getLongitud();
                }
            }
            if (puntos.isEmpty()) {
                throw new RuntimeException("Se requiere la ubicación actual para marcar este estado.");
            }

            for (double[] p : puntos) {
                double metros = distanciaMetros(p[0], p[1], destLat, destLng);
                log.info("Proximidad envioId={} punto=({}, {}) metros={}", id, p[0], p[1], metros);
                if (metros > 500) {
                    throw new RuntimeException(String.format(
                            "Estás a %.0f m del destino. Solo podés marcar esta opción a menos de 500 metros.",
                            metros));
                }
            }
            if (ubicacionHistorialLat == null) {
                ubicacionHistorialLat = puntos.get(0)[0];
                ubicacionHistorialLng = puntos.get(0)[1];
            }
        }

        envio.setEstado(estado);
        envio.setFechaUltimoMovimiento(ahora);
        
        // Guardar datos de entrega si el estado es "Entregado"
        if ("Entregado".equals(estado)) {
            envio.setFechaEntregado(ahora);
            if (rolRecibio != null) envio.setRolRecibio(rolRecibio);
            if (nombreRecibio != null) envio.setNombreRecibio(nombreRecibio);
            if (dniRecibio != null) envio.setDniRecibio(dniRecibio);
            if (latitud != null && longitud != null) {
                envio.setLatEntrega(latitud);
                envio.setLngEntrega(longitud);
            }
            if (ubicacionDireccion != null && !ubicacionDireccion.trim().isEmpty()) {
                envio.setDireccionEntrega(ubicacionDireccion.trim());
            }
        }
        
        // Actualizar fecha específica y flags según el estado
        switch (estado) {
            case "Entregado":
                envio.setFechaEntregado(ahora);
                break;
            case "Cancelado":
                envio.setFechaCancelado(ahora);
                break;
            case "Retirado":
                envio.setFechaRetiro(ahora);
                envio.setRetirado(true);
                break;
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
            // Guardar GPS del chofer al marcar (Nadie/Rechazado/Entregado)
            if (ubicacionHistorialLat != null && ubicacionHistorialLng != null) {
                historial.setLatitud(ubicacionHistorialLat);
                historial.setLongitud(ubicacionHistorialLng);
                if (ubicacionDireccion != null && !ubicacionDireccion.trim().isEmpty()) {
                    historial.setUbicacionDireccion(ubicacionDireccion.trim());
                }
            } else if ("Entregado".equals(estado) && latitud != null && longitud != null) {
                historial.setLatitud(latitud);
                historial.setLongitud(longitud);
                if (ubicacionDireccion != null && !ubicacionDireccion.trim().isEmpty()) {
                    historial.setUbicacionDireccion(ubicacionDireccion.trim());
                }
            }
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

    /** Distancia en metros entre dos puntos (Haversine). */
    private static double distanciaMetros(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    
    /**
     * Envía el email "Tu pedido está en camino" si el envío no es Flex y tiene email.
     * Se llama cuando el envío pasa a estado Retirado (retirado).
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
        return actualizarEstado(id, estado, usuarioNombre, null, null, null, null, null, null, null, null, null, null);
    }

    public EnvioDTO buscarEnvioPorQR(String qrData) {
        if (qrData == null || qrData.trim().isEmpty()) {
            return null;
        }
        String input = qrData.trim();
        
        // Normalizar el QR si es JSON (para que coincida independientemente de espacios/orden)
        String qrNormalizado = normalizarQR(input);
        
        // 1) Buscar por qrData exacto (lo que llevan las etiquetas impresas)
        Envio envio = envioRepository.findByQrDataParaRetirar(qrNormalizado);
        if (envio != null) {
            return toDTO(envio);
        }
        if (!qrNormalizado.equals(input)) {
            envio = envioRepository.findByQrDataParaRetirar(input);
            if (envio != null) {
                return toDTO(envio);
            }
        }
        
        // 2) Si el QR es la URL del tracking público (ej. https://.../tracking/TOKEN), extraer token y buscar por trackingToken
        if (input.contains("/tracking/")) {
            String token = input.substring(input.indexOf("/tracking/") + "/tracking/".length()).split("[?#]")[0].trim();
            if (!token.isEmpty()) {
                List<Envio> porToken = envioRepository.findByTrackingTokenAndEliminadoFalse(token);
                if (!porToken.isEmpty()) {
                    log.info("Envío encontrado por trackingToken (desde URL): {}", token);
                    return toDTO(porToken.get(0));
                }
            }
        }
        
        // 3) Buscar por trackingToken (por si escanearon solo el token o vino token= en query string)
        List<Envio> porToken = envioRepository.findByTrackingTokenAndEliminadoFalse(input);
        if (!porToken.isEmpty()) {
            log.info("Envío encontrado por trackingToken: {}", input);
            return toDTO(porToken.get(0));
        }
        
        // 4) Buscar por id_mvg (ID_NX) o tracking (QR / valor pegado; el buscador web solo usa ID_NX)
        List<Envio> porTrackingOIdMvg = envioRepository.findByTrackingOrIdMvgAndEliminadoFalse(input);
        if (!porTrackingOIdMvg.isEmpty()) {
            log.info("Envío encontrado por tracking/idMvg: {}", input);
            return toDTO(porTrackingOIdMvg.get(0));
        }
        
        // 4b) Si el QR impreso era "tracking-id" (cuando qrData estaba vacío), buscar por id
        int lastDash = input.lastIndexOf('-');
        if (lastDash > 0 && lastDash < input.length() - 1) {
            String posibleId = input.substring(lastDash + 1);
            if (posibleId.matches("\\d+")) {
                try {
                    Long id = Long.parseLong(posibleId);
                    java.util.Optional<Envio> porId = envioRepository.findById(id);
                    if (porId.isPresent() && !Boolean.TRUE.equals(porId.get().getEliminado())) {
                        log.info("Envío encontrado por id (formato tracking-id): {}", id);
                        return toDTO(porId.get());
                    }
                } catch (NumberFormatException ignored) { }
            }
        }
        
        // 5) Si no se encuentra, intentar buscar por mlShipmentId si es un QR Flex
        try {
            // Extraer ID del shipment del QR
            String shipmentId = mercadoLibreService.extraerShipmentIdDelQR(input);
            
            // Buscar por mlShipmentId (más confiable que buscar por qrData que puede variar)
            java.util.Optional<Envio> envioPorShipmentId = envioRepository.findByMlShipmentId(shipmentId);
            if (envioPorShipmentId.isPresent()) {
                log.info("Envío encontrado por mlShipmentId: {}", shipmentId);
                return toDTO(envioPorShipmentId.get());
            }
            
            // Si no existe en BD, intentar obtener desde MercadoLibre (para retirar)
            // Buscar cliente vinculado con Flex que tenga este shipment
            List<com.zetallegue.tms.model.Cliente> clientesVinculados = com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(clienteRepository.findAll()).stream()
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
                    
                    // Si no existe, retornar el DTO para que se cree al retirar
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
    public EnvioDTO retirarEnvio(Long id, String usuarioNombre) {
        Envio envio = envioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + id));
        
        if (!"A retirar".equals(envio.getEstado())) {
            throw new RuntimeException("Solo pueden retirarse envíos que estén en estado 'A retirar'");
        }
        
        LocalDateTime ahora = LocalDateTime.now();
        envio.setEstado("Retirado");
        envio.setFechaRetiro(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        // Marcar como retirado para que aparezca en las vistas
        envio.setRetirado(true);
        
        envio = envioRepository.save(envio);
        
        // Agregar entrada al historial
        HistorialEnvio historial = new HistorialEnvio();
        historial.setEnvioId(envio.getId());
        historial.setEstado("Retirado");
        historial.setFecha(ahora);
        historial.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
        historial.setObservaciones(null); // Sin observación
        historial.setOrigen("APP"); // Retirar siempre es desde la app móvil
        historialEnvioRepository.save(historial);
        
        // Enviar email "Tu pedido está en camino" al pasar a Retirado (retiro por escaneo)
        enviarEmailNotificacionSiRetirado(envio);
        
        return toDTO(envio);
    }

    /**
     * Retiro + adjudicación en un paso (app chofer con modo autoadjudicar):
     * A retirar → En camino al destinatario (sin estado intermedio Retirado),
     * marcando retirado=true y adjudicando al chofer.
     */
    @Transactional
    public EnvioDTO retirarYAdjudicarEnCamino(
            Long id,
            Long choferId,
            String choferNombre,
            String usuarioNombre) {
        if (choferId == null || choferNombre == null || choferNombre.trim().isEmpty()) {
            throw new RuntimeException("Chofer obligatorio para autoadjudicar");
        }

        Envio envio = envioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + id));

        if ("Entregado".equals(envio.getEstado()) || "Cancelado".equals(envio.getEstado())) {
            throw new RuntimeException("No se pueden autoadjudicar envíos entregados o cancelados");
        }
        if (!"A retirar".equals(envio.getEstado())) {
            throw new RuntimeException(
                    "Solo se pueden autoadjudicar envíos en estado 'A retirar' (actual: "
                            + envio.getEstado() + ")");
        }

        LocalDateTime ahora = LocalDateTime.now();
        String estadoAnterior = envio.getEstado();

        envio.setRetirado(true);
        envio.setFechaRetiro(ahora);
        envio.setChoferAdjudicadoId(choferId);
        envio.setChoferAdjudicadoNombre(choferNombre.trim());
        envio.setFechaAdjudicacion(ahora);
        envio.setEstado("En camino al destinatario");
        envio.setFechaUltimoMovimiento(ahora);

        envio = envioRepository.save(envio);

        HistorialEnvio historial = new HistorialEnvio();
        historial.setEnvioId(envio.getId());
        historial.setEstado("En camino al destinatario");
        historial.setFecha(ahora);
        historial.setQuien(usuarioNombre != null ? usuarioNombre : "Usuario");
        historial.setOrigen("APP");
        historial.setObservaciones(
                "Autoadjudicar: " + estadoAnterior + " -> En camino al destinatario | Adjudicado a: "
                        + choferNombre.trim());
        historialEnvioRepository.save(historial);

        // Misma notificación que al retirar (pedido en camino)
        enviarEmailNotificacionSiRetirado(envio);

        return toDTO(envio);
    }
    
    /**
     * Retiro un envío Flex desde MercadoLibre al escanear el QR
     * Si el envío no existe en la BD, lo crea desde ML
     */
    @Transactional
    public EnvioDTO retirarEnvioFlex(String qrData, String usuarioNombre) {
        log.info("Intentando retirar envío Flex con QR: {}", qrData);
        
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
            clientesVinculados = com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(clienteRepository.findAll()).stream()
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
                throw new RuntimeException("Solo pueden retirarse envíos que estén en estado 'A retirar'");
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
            // Marcar como retirado desde el inicio (ya que se está retirando)
            envio.setRetirado(true);
            envio.setEstado("Retirado");
        }
        
        // Guardar el shipment ID si no está guardado (para envíos existentes)
        if (envio.getMlShipmentId() == null || envio.getMlShipmentId().isEmpty()) {
            envio.setMlShipmentId(shipmentId);
        }
        
        LocalDateTime ahora = LocalDateTime.now();
        envio.setEstado("Retirado");
        envio.setFechaRetiro(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        envio.setRetirado(true);
        asegurarIdMvgParaFlex(envio);
        
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
            // Marcar como retirado y en estado "Retirado" (ya que se está subiendo manualmente)
            envio.setRetirado(true);
            envio.setEstado("Retirado");
        }
        
        // Guardar el shipment ID si no está guardado (para envíos existentes)
        if (envio.getMlShipmentId() == null || envio.getMlShipmentId().isEmpty()) {
            envio.setMlShipmentId(shipmentId);
        }
        
        // Guardar fecha de retiro
        LocalDateTime ahora = LocalDateTime.now();
        envio.setFechaRetiro(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        asegurarIdMvgParaFlex(envio);
        
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
        // Actualizar solo campos que vienen de ML, preservar estado y adjudicaciones
        if (envioDTO.getDireccion() != null) envio.setDireccion(envioDTO.getDireccion());
        if (envioDTO.getNombreDestinatario() != null) envio.setNombreDestinatario(envioDTO.getNombreDestinatario());
        if (envioDTO.getTelefono() != null) envio.setTelefono(envioDTO.getTelefono());
        if (envioDTO.getEmail() != null) envio.setEmail(envioDTO.getEmail());
        if (envioDTO.getLocalidad() != null) envio.setLocalidad(envioDTO.getLocalidad());
        if (envioDTO.getCodigoPostal() != null) envio.setCodigoPostal(envioDTO.getCodigoPostal());
        if (envioDTO.getZonaEntrega() != null) envio.setZonaEntrega(envioDTO.getZonaEntrega());
        if (envioDTO.getObservaciones() != null) envio.setObservaciones(envioDTO.getObservaciones());
        if (envioDTO.getCostoEnvio() != null) envio.setCostoEnvio(envioDTO.getCostoEnvio());
        if (envioDTO.getMlShipmentId() != null) envio.setMlShipmentId(envioDTO.getMlShipmentId());
        if (envioDTO.getIdml() != null) envio.setIdml(envioDTO.getIdml());
        // Para Flex, asegurar que ID_NX no sea igual al tracking
        asegurarIdMvgParaFlex(envio);
        return envio;
    }

    /**
     * Regla de negocio Flex: ID_NX debe ser un código único y no copiar el tracking de ML.
     */
    private void asegurarIdMvgParaFlex(Envio envio) {
        if (envio == null || !"Flex".equals(envio.getOrigen())) return;
        String tracking = envio.getTracking() != null ? envio.getTracking().trim() : "";
        String idMvg = envio.getIdMvg() != null ? envio.getIdMvg().trim() : "";
        boolean faltaIdMvg = idMvg.isEmpty();
        boolean igualATracking = !tracking.isEmpty() && idMvg.equalsIgnoreCase(tracking);
        if (faltaIdMvg || igualATracking) {
            String semilla = !tracking.isEmpty() ? "FLEX-" + tracking : "FLEX-" + System.currentTimeMillis();
            String nuevoIdMvg = generarTrackingUnico(semilla);
            envio.setIdMvg(nuevoIdMvg);
            log.info("ID_NX regenerado para Flex (tracking={}): {}", tracking, nuevoIdMvg);
        }
    }

    @Transactional
    public EnvioDTO adjudicarEnvio(Long envioId, Long choferId, String choferNombre, String usuarioAdjudicador, String origen) {
        log.info("adjudicarEnvio inicio envioId={} choferId={} choferNombre={}", envioId, choferId, choferNombre);
        Envio envio = envioRepository.findById(envioId)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + envioId));
        log.info("adjudicarEnvio envio encontrado id={} estado={} choferAnterior={} origen={}",
                envio.getId(), envio.getEstado(), envio.getChoferAdjudicadoNombre(), envio.getOrigen());
        
        // Verificar si es adjudicacion a "PENDIENTES DEPÓSITO"
        boolean esPendientesDeposito = "PENDIENTES DEPÓSITO".equals(choferNombre);
        
        // Guardar el chofer anterior para detectar readjudicacion desde PENDIENTES DEPÓSITO
        String choferAnterior = envio.getChoferAdjudicadoNombre();
        boolean vieneDePendientesDeposito = "PENDIENTES DEPÓSITO".equals(choferAnterior);
        
        // Validar que el envío no esté en estados finales (nunca adjudicar Entregado/Cancelado)
        if ("Entregado".equals(envio.getEstado()) || "Cancelado".equals(envio.getEstado())) {
            throw new RuntimeException("No se pueden adjudicar envíos que estén en estado 'Entregado' o 'Cancelado'");
        }

        // Permitir adjudicar a chofer desde "A retirar" (el chofer puede ser quien lo retira) o desde "Retirado"
        
        LocalDateTime ahora = LocalDateTime.now();
        
        // Guardar el estado anterior para el historial
        String estadoAnterior = envio.getEstado();
        
        // Adjudicar el chofer
        envio.setChoferAdjudicadoId(choferId);
        envio.setChoferAdjudicadoNombre(choferNombre);
        envio.setFechaAdjudicacion(ahora);
        envio.setFechaUltimoMovimiento(ahora);
        
        // Para envíos Flex, NO cambiar el estado (solo adjudicar chofer)
        // El estado se sincroniza automáticamente desde MercadoLibre vía polling
        boolean esFlex = "Flex".equals(envio.getOrigen());
        
        // Si es "PENDIENTES DEPÓSITO", NO cambiar el estado (mantener el estado actual)
        // Si NO es "PENDIENTES DEPÓSITO" y NO es Flex: solo pasar a "En camino al destinatario" desde "Retirado".
        // No se permite pasar de "A retirar" a "En camino" sin haber marcado antes como Retirado (retirado).
        if (!esPendientesDeposito && !esFlex) {
            if ("Retirado".equals(envio.getEstado())) {
                envio.setEstado("En camino al destinatario");
            }
            // Si está en "A retirar" solo se adjudica el chofer; el estado sigue "A retirar" hasta que se marque Retirado
        }
        // Si es "PENDIENTES DEPÓSITO" o Flex, mantener el estado actual
        
        log.info("adjudicarEnvio guardando envio id={} estado={} choferAdjudicadoId={} choferAdjudicadoNombre={}",
                envio.getId(), envio.getEstado(), envio.getChoferAdjudicadoId(), envio.getChoferAdjudicadoNombre());
        envio = envioRepository.save(envio);
        log.info("adjudicarEnvio save OK envio id={}", envio.getId());
        
        // Determinar si hubo cambio de estado
        boolean cambioEstado = !estadoAnterior.equals(envio.getEstado());
        
        // Determinar si hubo readjudicacion (cambio de chofer)
        boolean esReadjudicacion = choferAnterior != null && 
                                 !choferAnterior.trim().isEmpty() && 
                                 !choferAnterior.equals(choferNombre);
        
        // Determinar si es la primera adjudicacion (no había chofer antes)
        boolean esPrimeraAdjudicacion = choferAnterior == null || choferAnterior.trim().isEmpty();
        
        // Solo agregar al historial si:
        // 1. Cambió el estado (siempre agregar)
        // 2. Es la primera adjudicacion Y cambió el estado (de "Retirado" a "En camino al destinatario")
        // NO agregar si solo hay readjudicacion sin cambio de estado (para evitar duplicados en la página pública)
        // Las adjudicaciones se pueden ver en la tabla de adjudicaciones del frontend
        if (cambioEstado) {
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(envio.getEstado());
            historial.setFecha(ahora);
            historial.setQuien(usuarioAdjudicador != null ? usuarioAdjudicador : "Usuario");
            historial.setOrigen(origen != null ? origen : "WEB");
            
            // Construir observación según el caso
            String observacion = "Estado: " + estadoAnterior + " -> " + envio.getEstado();
            if (esReadjudicacion) {
                observacion += " | Readjudicado desde: " + choferAnterior + " a: " + choferNombre;
            } else if (esPrimeraAdjudicacion || choferNombre != null) {
                observacion += " | Adjudicado a: " + choferNombre;
            }
            
            historial.setObservaciones(observacion);
            historialEnvioRepository.save(historial);
        } else if (esReadjudicacion) {
            // Si solo hubo readjudicacion sin cambio de estado, agregar al historial
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(envio.getEstado());
            historial.setFecha(ahora);
            historial.setQuien(usuarioAdjudicador != null ? usuarioAdjudicador : "Usuario");
            historial.setOrigen(origen != null ? origen : "WEB");
            historial.setObservaciones("Readjudicado desde: " + choferAnterior + " a: " + choferNombre);
            historialEnvioRepository.save(historial);
        } else if (esPrimeraAdjudicacion) {
            // Primera adjudicacion sin cambio de estado (ej. "A retirar" -> chofer): registrar en historial
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado(envio.getEstado());
            historial.setFecha(ahora);
            historial.setQuien(usuarioAdjudicador != null ? usuarioAdjudicador : "Usuario");
            historial.setOrigen(origen != null ? origen : "WEB");
            historial.setObservaciones("Adjudicado a: " + choferNombre);
            historialEnvioRepository.save(historial);
        }
        
        return toDTO(envio);
    }

    @Transactional
    public List<EnvioDTO> crearEnviosMasivos(List<EnvioDTO> enviosDTO) {
        // Para cada envío Directo con tracking: generar ID_NX único (alfanumérico), igual que en crearEnvio
        for (int i = 0; i < enviosDTO.size(); i++) {
            EnvioDTO dto = enviosDTO.get(i);
            if ("Directo".equals(dto.getOrigen()) && dto.getTracking() != null && !dto.getTracking().trim().isEmpty()) {
                String semilla = dto.getTracking() + "-" + i;
                String idMvg = generarTrackingUnico(semilla);
                dto.setIdMvg(idMvg);
                if (dto.getQrData() == null || dto.getQrData().equals(dto.getTracking())) {
                    dto.setQrData(idMvg);
                }
                log.info("ID_NX generado para envío Directo masivo [{}] - Semilla: {}, ID_NX: {}", i, dto.getTracking(), idMvg);
            }
        }
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

    /**
     * Expresión sobre {@code direccion} sin bloques típicos de código postal en el texto libre,
     * para que el filtro de destino dirección no dispare por el CP que figura en la cadena (solo por calle/número).
     * CPA argentino: bloque completo (letra + 4 dígitos + 3 letras, p. ej. {@code C1022AAP}) y forma corta
     * (coma/espacio + letra + 4 dígitos + fin/pausa, p. ej. {@code B1879}) sin usar {@code \\b} (en PostgreSQL no es límite de palabra Perl).
     * Varias pasadas porque {@code regexp_replace} en PG sin flag {@code g} reemplaza una ocurrencia por llamada.
     */
    private Expression<String> direccionSinPatronesCp(CriteriaBuilder cb, Path<String> direccion) {
        Expression<String> e = cb.coalesce(direccion, cb.literal(""));
        String[] patrones = {
                "(?i),?\\s*CP\\s*:?\\s*[\\dA-Za-z\\s-]+",
                "(?i),?\\s*cod(igo)?\\s*postal\\s*:?\\s*[\\dA-Za-z\\s-]+",
                "(?i)[A-Za-z]\\d{4}[A-Za-z]{3}",
                "(?i),?\\s*[A-Za-z]\\d{4}(?=\\s|,|$)"
        };
        for (String p : patrones) {
            for (int i = 0; i < 5; i++) {
                e = cb.function("regexp_replace", String.class, e, cb.literal(p), cb.literal(""));
            }
        }
        for (int i = 0; i < 3; i++) {
            e = cb.function("regexp_replace", String.class, e, cb.literal("\\s{2,}"), cb.literal(" "));
        }
        return e;
    }

    private Specification<Envio> buildSpecification(EnvioFilterDTO filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            Long orgId = com.zetallegue.tms.tenant.TenantContext.getOrganizacionId();
            if (orgId != null) {
                predicates.add(cb.equal(root.get("organizacionId"), orgId));
            }

            // Resolver lista de estados (multi + compat un valor)
            List<String> estadosFiltro = new ArrayList<>();
            if (filter.getEstados() != null) {
                for (String e : filter.getEstados()) {
                    if (e != null && !e.trim().isEmpty() && !"todos".equalsIgnoreCase(e.trim())) {
                        estadosFiltro.add(e.trim());
                    }
                }
            }
            if (estadosFiltro.isEmpty() && filter.getEstado() != null && !filter.getEstado().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getEstado().trim())) {
                estadosFiltro.add(filter.getEstado().trim());
            }

            boolean soloEliminados = estadosFiltro.size() == 1 && "Eliminados".equals(estadosFiltro.get(0));
            boolean incluyeEliminados = estadosFiltro.stream().anyMatch("Eliminados"::equals);

            // Por defecto, excluir eliminados (excepto si se filtra por eliminados)
            if (soloEliminados) {
                predicates.add(cb.equal(root.get("eliminado"), true));
            } else if (incluyeEliminados) {
                // Mezcla eliminados + otros estados: se resuelve más abajo con OR
            } else {
                predicates.add(cb.equal(root.get("eliminado"), false));
            }
            
            // Solo mostrar envíos retirados (escaneados) en las vistas
            // EXCEPCIÓN: Los envíos de Tienda Nube, Shopify y VTEX se muestran aunque no estén retirados (se crean directamente)
            // Los envíos Flex se sincronizan con retirado=false y solo aparecen cuando se escanean
            // Manejar NULL como true (para envíos antiguos que no tienen este campo - se consideran retirados)
            predicates.add(cb.or(
                cb.equal(root.get("retirado"), true),
                cb.isNull(root.get("retirado")),
                cb.equal(root.get("origen"), "Tienda Nube"), // Incluir envíos de Tienda Nube aunque no estén retirados
                cb.equal(root.get("origen"), "Shopify"), // Incluir envíos de Shopify aunque no estén retirados
                cb.equal(root.get("origen"), "VTEX"), // Incluir envíos de VTEX aunque no estén retirados
                cb.equal(root.get("origen"), "Vtex") // Incluir envíos de Vtex (variante) aunque no estén retirados
            ));

            // Filtro por código de cliente (para usuarios "Cliente")
            if (filter.getCodigoCliente() != null && !filter.getCodigoCliente().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("cliente")),
                        "%" + filter.getCodigoCliente().toLowerCase() + "%"
                ));
            }

            // Filtro por chofer adjudicado (para usuarios "Chofer": solo sus envíos)
            if (filter.getChoferId() != null) {
                predicates.add(cb.equal(root.get("choferAdjudicadoId"), filter.getChoferId()));
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
                        case "fechaAdjudicacion":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaAdjudicacion"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaAdjudicacion"), fechaHasta));
                            break;
                        case "fechaRetiro":
                            if (fechaDesde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaRetiro"), fechaDesde));
                            if (fechaHasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaRetiro"), fechaHasta));
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

            // Filtro por estado (uno o varios)
            if (!estadosFiltro.isEmpty() && !soloEliminados) {
                List<Predicate> estadoOrs = new ArrayList<>();
                List<String> estadosExactos = new ArrayList<>();
                boolean pendientes = false;
                for (String e : estadosFiltro) {
                    if ("Eliminados".equals(e)) {
                        estadoOrs.add(cb.equal(root.get("eliminado"), true));
                    } else if ("Pendientes".equals(e)) {
                        pendientes = true;
                    } else {
                        estadosExactos.add(e);
                    }
                }
                if (pendientes) {
                    estadoOrs.add(cb.and(
                            cb.equal(root.get("eliminado"), false),
                            cb.not(cb.equal(root.get("estado"), "Entregado")),
                            cb.not(cb.equal(root.get("estado"), "Cancelado")),
                            cb.not(cb.equal(root.get("estado"), "Devuelto al cliente")),
                            cb.not(cb.equal(root.get("estado"), "Entregado 2DA visita"))
                    ));
                }
                if (!estadosExactos.isEmpty()) {
                    if (incluyeEliminados) {
                        estadoOrs.add(cb.and(
                                cb.equal(root.get("eliminado"), false),
                                root.get("estado").in(estadosExactos)
                        ));
                    } else {
                        estadoOrs.add(root.get("estado").in(estadosExactos));
                    }
                }
                if (!estadoOrs.isEmpty()) {
                    predicates.add(cb.or(estadoOrs.toArray(new Predicate[0])));
                }
            }

            // Filtro por origen (uno o varios)
            List<String> origenesFiltro = new ArrayList<>();
            if (filter.getOrigenes() != null) {
                for (String o : filter.getOrigenes()) {
                    if (o != null && !o.trim().isEmpty() && !"todos".equalsIgnoreCase(o.trim())) {
                        origenesFiltro.add(o.trim());
                    }
                }
            }
            if (origenesFiltro.isEmpty() && filter.getOrigen() != null && !filter.getOrigen().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getOrigen().trim())) {
                origenesFiltro.add(filter.getOrigen().trim());
            }
            if (!origenesFiltro.isEmpty()) {
                List<Predicate> origenOrs = new ArrayList<>();
                for (String o : origenesFiltro) {
                    if ("Mercado Libre".equals(o)) {
                        origenOrs.add(cb.or(
                                cb.equal(root.get("origen"), "Mercado Libre"),
                                cb.equal(root.get("origen"), "Flex")
                        ));
                    } else {
                        origenOrs.add(cb.equal(root.get("origen"), o));
                    }
                }
                predicates.add(cb.or(origenOrs.toArray(new Predicate[0])));
            }

            // Filtro por tracking o ID_NX (columna id_mvg)
            if (filter.getTracking() != null && !filter.getTracking().trim().isEmpty()) {
                String term = "%" + filter.getTracking().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("tracking")), term),
                    cb.like(cb.lower(root.get("idMvg")), term)
                ));
            }

            // Filtro por ID venta (buscar en tracking o ID_NX)
            if (filter.getIdVenta() != null && !filter.getIdVenta().trim().isEmpty()) {
                String term = "%" + filter.getIdVenta().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("tracking")), term),
                    cb.like(cb.lower(root.get("idMvg")), term)
                ));
            }

            // Filtro por nombre fantasía / vendedor (uno o varios)
            List<String> nombresFiltro = new ArrayList<>();
            if (filter.getNombresFantasia() != null) {
                for (String n : filter.getNombresFantasia()) {
                    if (n != null && !n.trim().isEmpty()) {
                        nombresFiltro.add(n.trim());
                    }
                }
            }
            if (nombresFiltro.isEmpty() && filter.getNombreFantasia() != null
                    && !filter.getNombreFantasia().trim().isEmpty()) {
                nombresFiltro.add(filter.getNombreFantasia().trim());
            }
            if (!nombresFiltro.isEmpty()) {
                List<Predicate> nombreOrs = new ArrayList<>();
                for (String n : nombresFiltro) {
                    nombreOrs.add(cb.like(cb.lower(root.get("cliente")), "%" + n.toLowerCase() + "%"));
                }
                predicates.add(cb.or(nombreOrs.toArray(new Predicate[0])));
            }

            // Filtro por grupo (uno o varios): correlacionar envio.cliente con clientes del grupo
            List<Long> grupoIdsFiltro = new ArrayList<>();
            if (filter.getGrupoIds() != null) {
                for (Long gid : filter.getGrupoIds()) {
                    if (gid != null) {
                        grupoIdsFiltro.add(gid);
                    }
                }
            }
            if (grupoIdsFiltro.isEmpty() && filter.getGrupoId() != null) {
                grupoIdsFiltro.add(filter.getGrupoId());
            }
            if (!grupoIdsFiltro.isEmpty()) {
                Subquery<Integer> grupoSq = query.subquery(Integer.class);
                Root<Cliente> cr = grupoSq.from(Cliente.class);
                grupoSq.select(cb.literal(1));
                Path<String> envioCliente = root.get("cliente");
                Predicate porPrefijoCodigo = cb.like(envioCliente, cb.concat(cr.get("codigo"), cb.literal(" - %")));
                Predicate porNombreFantasia = cb.and(
                        cb.isNotNull(cr.get("nombreFantasia")),
                        cb.equal(cb.lower(envioCliente), cb.lower(cr.get("nombreFantasia")))
                );
                Predicate porRazonSocial = cb.and(
                        cb.isNotNull(cr.get("razonSocial")),
                        cb.equal(cb.lower(envioCliente), cb.lower(cr.get("razonSocial")))
                );
                grupoSq.where(
                        cr.get("grupoId").in(grupoIdsFiltro),
                        cb.or(porPrefijoCodigo, porNombreFantasia, porRazonSocial)
                );
                predicates.add(cb.exists(grupoSq));
            }

            // Filtro por destino nombre
            if (filter.getDestinoNombre() != null && !filter.getDestinoNombre().trim().isEmpty()) {
                predicates.add(cb.like(
                        cb.lower(root.get("nombreDestinatario")),
                        "%" + filter.getDestinoNombre().toLowerCase() + "%"
                ));
            }

            // Filtro por destino dirección: buscar en calle/número sin considerar CP embebido en el texto (CP:, CPA C1234ABC, etc.)
            if (filter.getDestinoDireccion() != null && !filter.getDestinoDireccion().trim().isEmpty()) {
                String term = "%" + filter.getDestinoDireccion().trim().toLowerCase() + "%";
                Expression<String> direccionLimpia = direccionSinPatronesCp(cb, root.get("direccion"));
                predicates.add(cb.like(cb.lower(direccionLimpia), term));
            }

            // Filtro por código postal (columna dedicada)
            if (filter.getCodigoPostal() != null && !filter.getCodigoPostal().trim().isEmpty()) {
                String raw = filter.getCodigoPostal().trim().toLowerCase();
                String soloDigitos = raw.replaceAll("\\D", "");
                Path<String> cpCol = root.get("codigoPostal");
                Predicate porTexto = cb.like(cb.lower(cpCol), "%" + raw + "%");
                if (!soloDigitos.isEmpty() && !soloDigitos.equals(raw)) {
                    predicates.add(cb.or(porTexto, cb.like(cb.lower(cpCol), "%" + soloDigitos + "%")));
                } else {
                    predicates.add(porTexto);
                }
            }

            // Filtro por zona de entrega
            if (filter.getZonasEntrega() != null && !filter.getZonasEntrega().trim().isEmpty() && !filter.getZonasEntrega().equals("todos")) {
                predicates.add(cb.like(
                        cb.lower(root.get("zonaEntrega")),
                        "%" + filter.getZonasEntrega().toLowerCase() + "%"
                ));
            }

            // Adjudicado: con/sin chofer
            if (filter.getAdjudicado() != null && !filter.getAdjudicado().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getAdjudicado().trim())) {
                if ("si".equalsIgnoreCase(filter.getAdjudicado().trim())) {
                    predicates.add(cb.isNotNull(root.get("choferAdjudicadoId")));
                } else if ("no".equalsIgnoreCase(filter.getAdjudicado().trim())) {
                    predicates.add(cb.isNull(root.get("choferAdjudicadoId")));
                }
            }

            // Cobranzas: total a cobrar > 0
            if (filter.getCobranzas() != null && !filter.getCobranzas().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getCobranzas().trim())) {
                Path<String> total = root.get("totalACobrar");
                Expression<String> totalTrim = cb.trim(total);
                Predicate vacio = cb.or(cb.isNull(total), cb.equal(totalTrim, ""), cb.equal(totalTrim, "0"),
                        cb.equal(totalTrim, "0.0"), cb.equal(totalTrim, "0.00"), cb.equal(totalTrim, "0,00"));
                if ("si".equalsIgnoreCase(filter.getCobranzas().trim())) {
                    predicates.add(cb.and(cb.not(vacio), cb.notEqual(totalTrim, "0")));
                } else if ("no".equalsIgnoreCase(filter.getCobranzas().trim())) {
                    predicates.add(vacio);
                }
            }

            // Domicilio comercial vs residencial (heurística sobre texto de dirección)
            if (filter.getDomicilio() != null && !filter.getDomicilio().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getDomicilio().trim())) {
                Expression<String> dir = cb.lower(cb.coalesce(root.get("direccion"), cb.literal("")));
                Predicate comercial = cb.or(
                        cb.like(dir, "%local%"),
                        cb.like(dir, "%comercial%"),
                        cb.like(dir, "%negocio%"),
                        cb.like(dir, "%tienda%"),
                        cb.like(dir, "%sucursal%"),
                        cb.like(dir, "%oficina%")
                );
                if ("comercial".equalsIgnoreCase(filter.getDomicilio().trim())) {
                    predicates.add(comercial);
                } else if ("residencial".equalsIgnoreCase(filter.getDomicilio().trim())) {
                    predicates.add(cb.not(comercial));
                }
            }

            // Logística inversa: Cambio/Retiro (carga manual o columna Excel "Cambio/retiro").
            // No usar "cualquier valor no vacío": ML guarda comentarios de domicilio en el mismo campo.
            if (filter.getLogisticaInversa() != null && !filter.getLogisticaInversa().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getLogisticaInversa().trim())) {
                Path<String> cambioRetiro = root.get("cambioRetiro");
                Expression<String> crLower = cb.lower(cb.trim(cb.coalesce(cambioRetiro, cb.literal(""))));
                Predicate esCambioORetiro = cb.or(
                        cb.equal(crLower, "cambio"),
                        cb.equal(crLower, "retiro")
                );
                if ("si".equalsIgnoreCase(filter.getLogisticaInversa().trim())) {
                    predicates.add(esCambioORetiro);
                } else if ("no".equalsIgnoreCase(filter.getLogisticaInversa().trim())) {
                    predicates.add(cb.not(esCambioORetiro));
                }
            }

            // Pedido turbo: deadline el mismo día que la venta (o fecha de carga)
            if (filter.getEnvioTurbo() != null && !filter.getEnvioTurbo().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getEnvioTurbo().trim())) {
                Path<LocalDateTime> deadline = root.get("deadline");
                Path<LocalDateTime> fechaVenta = root.get("fechaVenta");
                Path<LocalDateTime> fecha = root.get("fecha");
                // Comparar por día: truncar a fecha (H2/JPA: function date)
                Expression<java.sql.Date> deadlineDay = cb.function("DATE", java.sql.Date.class, deadline);
                Expression<java.sql.Date> ventaDay = cb.function("DATE", java.sql.Date.class,
                        cb.coalesce(fechaVenta, fecha));
                Predicate turbo = cb.and(cb.isNotNull(deadline), cb.equal(deadlineDay, ventaDay));
                if ("si".equalsIgnoreCase(filter.getEnvioTurbo().trim())) {
                    predicates.add(turbo);
                } else if ("no".equalsIgnoreCase(filter.getEnvioTurbo().trim())) {
                    predicates.add(cb.or(cb.isNull(deadline), cb.not(cb.equal(deadlineDay, ventaDay))));
                }
            }

            // Fotos: existe al menos una imagen asociada
            if (filter.getFotos() != null && !filter.getFotos().trim().isEmpty()
                    && !"todos".equalsIgnoreCase(filter.getFotos().trim())) {
                Subquery<Integer> imgSq = query.subquery(Integer.class);
                Root<ImagenEnvio> imgRoot = imgSq.from(ImagenEnvio.class);
                imgSq.select(cb.literal(1));
                imgSq.where(cb.equal(imgRoot.get("envioId"), root.get("id")));
                if ("si".equalsIgnoreCase(filter.getFotos().trim())) {
                    predicates.add(cb.exists(imgSq));
                } else if ("no".equalsIgnoreCase(filter.getFotos().trim())) {
                    predicates.add(cb.not(cb.exists(imgSq)));
                }
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
        List<Envio> envios = envioRepository.findByChoferAdjudicadoIdAndEstadoAndEliminadoFalseAndRetiradoTrue(
                choferId, 
                "En camino al destinatario"
        );
        return envios.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Historial de resultados del chofer (Entregado / Rechazado / Nadie) agrupado por día.
     */
    @Transactional(readOnly = true)
    public ChoferHistorialDTO obtenerHistorialChofer(Long choferId, LocalDate desde, LocalDate hasta, String busqueda) {
        if (choferId == null) {
            throw new RuntimeException("choferId es requerido");
        }
        if (desde == null || hasta == null) {
            throw new RuntimeException("desde y hasta son requeridos");
        }
        if (hasta.isBefore(desde)) {
            throw new RuntimeException("La fecha hasta no puede ser anterior a desde");
        }

        LocalDateTime desdeDt = desde.atStartOfDay();
        LocalDateTime hastaDt = hasta.atTime(23, 59, 59);
        List<String> estados = List.of("Entregado", "Rechazado por el comprador", "Nadie");

        List<Envio> envios = envioRepository.findHistorialChofer(choferId, estados, desdeDt, hastaDt);

        String q = busqueda != null ? busqueda.trim().toLowerCase() : "";
        if (!q.isEmpty()) {
            envios = envios.stream()
                    .filter(e -> {
                        String tracking = e.getTracking() != null ? e.getTracking().toLowerCase() : "";
                        String dir = e.getDireccion() != null ? e.getDireccion().toLowerCase() : "";
                        return tracking.contains(q) || dir.contains(q);
                    })
                    .collect(Collectors.toList());
        }

        ChoferHistorialDTO result = new ChoferHistorialDTO();
        Map<String, ChoferHistorialDTO.DiaHistorialDTO> diasMap = new java.util.LinkedHashMap<>();
        DateTimeFormatter dayFmt = DateTimeFormatter.ISO_LOCAL_DATE;
        DateTimeFormatter dtFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

        for (Envio e : envios) {
            LocalDateTime fr = e.getFechaEntregado() != null ? e.getFechaEntregado() : e.getFechaUltimoMovimiento();
            if (fr == null) continue;
            String diaKey = fr.toLocalDate().format(dayFmt);

            ChoferHistorialDTO.DiaHistorialDTO dia = diasMap.computeIfAbsent(diaKey, k -> {
                ChoferHistorialDTO.DiaHistorialDTO d = new ChoferHistorialDTO.DiaHistorialDTO();
                d.setFecha(k);
                d.setPedidos(new ArrayList<>());
                return d;
            });

            String estado = e.getEstado();
            String resultado;
            if ("Entregado".equals(estado)) {
                resultado = "Entregado";
                result.setEntregados(result.getEntregados() + 1);
                dia.setEntregados(dia.getEntregados() + 1);
            } else if ("Rechazado por el comprador".equals(estado)) {
                resultado = "Rechazado";
                result.setRechazados(result.getRechazados() + 1);
                dia.setRechazados(dia.getRechazados() + 1);
            } else {
                resultado = "Nadie en domicilio";
                result.setNadie(result.getNadie() + 1);
                dia.setNadie(dia.getNadie() + 1);
            }

            ChoferHistorialDTO.PedidoHistorialDTO pedido = new ChoferHistorialDTO.PedidoHistorialDTO();
            pedido.setId(e.getId());
            pedido.setTracking(e.getTracking());
            pedido.setDireccion(e.getDireccion());
            pedido.setEstado(estado);
            pedido.setResultado(resultado);
            pedido.setFechaResultado(fr.format(dtFmt));
            dia.getPedidos().add(pedido);
        }

        // Días más recientes primero
        List<ChoferHistorialDTO.DiaHistorialDTO> dias = new ArrayList<>(diasMap.values());
        dias.sort((a, b) -> b.getFecha().compareTo(a.getFecha()));
        result.setDias(dias);
        return result;
    }

    @Transactional(readOnly = true)
    public List<ChoferConUbicacionDTO> obtenerChoferesConEnviosAdjudicados() {
        // Choferes activos con ubicación reportada (app), con o sin pedidos en ruta
        Long orgId = com.zetallegue.tms.tenant.TenantContext.getOrganizacionId();
        List<Usuario> choferes = orgId != null
                ? usuarioRepository.findByOrganizacionIdAndPerfilAndHabilitadoTrueAndBloqueadoFalse(orgId, "Chofer")
                : usuarioRepository.findByPerfilAndHabilitadoTrueAndBloqueadoFalse("Chofer");

        return choferes.stream()
                .filter(c -> c.getLatitud() != null && c.getLongitud() != null)
                .map(chofer -> {
                    List<Envio> envios = com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(
                            envioRepository.findByChoferAdjudicadoIdAndEstadoAndEliminadoFalseAndRetiradoTrue(
                                    chofer.getId(),
                                    "En camino al destinatario"
                            ));

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
                .sorted((a, b) -> a.getNombreCompleto().compareToIgnoreCase(b.getNombreCompleto()))
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
        dto.setLatitud(historial.getLatitud());
        dto.setLongitud(historial.getLongitud());
        dto.setUbicacionDireccion(historial.getUbicacionDireccion());
        return dto;
    }

    private EnvioDTO toDTO(Envio envio) {
        EnvioDTO dto = new EnvioDTO();
        dto.setId(envio.getId());
        dto.setFecha(envio.getFecha());
        dto.setFechaVenta(envio.getFechaVenta());
        dto.setFechaLlegue(envio.getFechaLlegue());
        dto.setFechaEntregado(envio.getFechaEntregado());
        dto.setFechaAdjudicacion(envio.getFechaAdjudicacion());
        dto.setFechaDespacho(envio.getFechaDespacho());
        dto.setFechaRetiro(envio.getFechaRetiro());
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
        dto.setChoferAdjudicadoId(envio.getChoferAdjudicadoId());
        dto.setChoferAdjudicadoNombre(envio.getChoferAdjudicadoNombre());
        dto.setRolRecibio(envio.getRolRecibio());
        dto.setNombreRecibio(envio.getNombreRecibio());
        dto.setDniRecibio(envio.getDniRecibio());
        dto.setRetirado(envio.getRetirado() != null ? envio.getRetirado() : false);
        dto.setCostoEnvio(envio.getCostoEnvio());
        dto.setIdml(envio.getIdml());
        dto.setPeso(envio.getPeso());
        dto.setMetodoEnvio(envio.getMetodoEnvio());
        dto.setDeadline(envio.getDeadline());
        dto.setMlShipmentId(envio.getMlShipmentId());
        dto.setTrackingToken(envio.getTrackingToken());
        dto.setLatDestino(envio.getLatDestino());
        dto.setLngDestino(envio.getLngDestino());
        dto.setLatEntrega(envio.getLatEntrega());
        dto.setLngEntrega(envio.getLngEntrega());
        dto.setDireccionEntrega(envio.getDireccionEntrega());
        return dto;
    }

    /** Total a cobrar no puede ser negativo: si el valor parsea como número negativo, se guarda "0". */
    private static String normalizarTotalACobrar(String val) {
        if (val == null || val.trim().isEmpty()) return val;
        try {
            double n = Double.parseDouble(val.trim().replace(",", "."));
            if (n < 0) return "0";
            return val.trim();
        } catch (NumberFormatException e) {
            return val.trim();
        }
    }

    private Envio toEntity(EnvioDTO dto) {
        Envio envio = new Envio();
        envio.setOrganizacionId(com.zetallegue.tms.tenant.TenantContext.getOrganizacionId());
        envio.setFecha(dto.getFecha() != null ? dto.getFecha() : LocalDateTime.now());
        envio.setFechaVenta(dto.getFechaVenta());
        envio.setFechaLlegue(dto.getFechaLlegue());
        envio.setFechaEntregado(dto.getFechaEntregado());
        envio.setFechaAdjudicacion(dto.getFechaAdjudicacion());
        envio.setFechaDespacho(dto.getFechaDespacho());
        envio.setFechaRetiro(dto.getFechaRetiro());
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
        envio.setTotalACobrar(normalizarTotalACobrar(dto.getTotalACobrar()));
        envio.setCambioRetiro(dto.getCambioRetiro());
        envio.setLocalidad(dto.getLocalidad());
        envio.setCodigoPostal(dto.getCodigoPostal());
        envio.setZonaEntrega(dto.getZonaEntrega());
        envio.setQrData(dto.getQrData());
        envio.setEstado(dto.getEstado() != null ? dto.getEstado() : "A retirar");
        envio.setEliminado(dto.getEliminado() != null ? dto.getEliminado() : false);
        // Los envíos creados manualmente (no Flex) tienen retirado=true por defecto
        // Los envíos Flex se crean con retirado=false y se marcan como true al escanear
        envio.setRetirado(dto.getRetirado() != null ? dto.getRetirado() : 
                          (dto.getOrigen() != null && "Flex".equals(dto.getOrigen()) ? false : true));
        envio.setChoferAdjudicadoId(dto.getChoferAdjudicadoId());
        envio.setChoferAdjudicadoNombre(dto.getChoferAdjudicadoNombre());
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
        envio.setLatDestino(dto.getLatDestino());
        envio.setLngDestino(dto.getLngDestino());
        return envio;
    }

    /** Actualiza la geolocalización del destino de un envío (desde la app del chofer). Si se pasa direccion, actualiza también CP, zona y costo. */
    @Transactional
    public EnvioDTO actualizarGeolocalizacion(Long envioId, Double lat, Double lng, String direccion) {
        return actualizarGeolocalizacion(envioId, lat, lng, direccion, null);
    }

    @Transactional
    public EnvioDTO actualizarGeolocalizacion(Long envioId, Double lat, Double lng, String direccion, String usuarioNombre) {
        Envio envio = envioRepository.findById(envioId)
                .orElseThrow(() -> new RuntimeException("Envío no encontrado con id: " + envioId));

        String direccionAnterior = envio.getDireccion();
        boolean cambioDireccion = false;
        String direccionNueva = null;

        envio.setLatDestino(lat);
        envio.setLngDestino(lng);
        if (direccion != null && !direccion.trim().isEmpty()) {
            direccionNueva = direccion.trim();
            String antNorm = normalizarDireccionComparacion(direccionAnterior);
            String nueNorm = normalizarDireccionComparacion(direccionNueva);
            cambioDireccion = !nueNorm.equals(antNorm);

            envio.setDireccion(direccionNueva);
            String cpExtraido = extraerCodigoPostalDeDireccion(direccionNueva);
            if (cpExtraido != null && !cpExtraido.isEmpty()) {
                envio.setCodigoPostal(cpExtraido);
                envio.setZonaEntrega(com.zetallegue.tms.util.ZonaEntregaUtil.determinar(
                        cpExtraido, envio.getLocalidad()));
                try {
                    com.zetallegue.tms.model.Cliente cliente = resolverClienteDesdeEnvio(envio);
                    if (cliente != null && cliente.getListaPreciosId() != null) {
                        double costo = calcularCostoEnvioDesdeListaPrecios(cpExtraido, cliente.getListaPreciosId());
                        if (costo > 0) {
                            envio.setCostoEnvio(String.format("%.2f", costo));
                            log.info("Geolocalización: costo de envío actualizado ${} para envío {}", String.format("%.2f", costo), envioId);
                        }
                    }
                } catch (Exception e) {
                    log.warn("No se pudo actualizar costo al geolocalizar envío {}: {}", envioId, e.getMessage());
                }
                log.info("Geolocalización actualizada para envío {}: lat={}, lng={}, CP={}, zona={}", envioId, lat, lng, cpExtraido, envio.getZonaEntrega());
            }
        }
        envio = envioRepository.save(envio);

        if (cambioDireccion) {
            HistorialEnvio historial = new HistorialEnvio();
            historial.setEnvioId(envio.getId());
            historial.setEstado("Cambio de dirección");
            historial.setFecha(LocalDateTime.now());
            historial.setQuien(usuarioNombre != null && !usuarioNombre.trim().isEmpty() ? usuarioNombre.trim() : "Chofer");
            historial.setOrigen("APP");
            historial.setLatitud(lat);
            historial.setLongitud(lng);
            String antes = (direccionAnterior != null && !direccionAnterior.trim().isEmpty())
                    ? direccionAnterior.trim()
                    : "(sin dirección)";
            String obs = "Antes: " + antes + " → Ahora: " + direccionNueva;
            if (obs.length() > 1000) {
                obs = obs.substring(0, 997) + "...";
            }
            historial.setObservaciones(obs);
            historial.setUbicacionDireccion(direccionNueva);
            historialEnvioRepository.save(historial);
            log.info("Cambio de dirección registrado en historial para envío {} por {}", envioId, historial.getQuien());
        }

        log.info("Geolocalización actualizada para envío {}: lat={}, lng={}", envioId, lat, lng);
        return toDTO(envio);
    }

    private String normalizarDireccionComparacion(String direccion) {
        if (direccion == null) return "";
        return direccion.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    /** Extrae código postal de una dirección formateada (ej. "Av. Callao 252, C1022AAP Cdad. Autónoma de Buenos Aires"). */
    private String extraerCodigoPostalDeDireccion(String direccion) {
        if (direccion == null || direccion.trim().isEmpty()) return null;
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("(?:C|B)?(\\d{4,8})[A-Z]*");
        java.util.regex.Matcher m = p.matcher(direccion);
        if (m.find()) {
            String digits = m.group(1);
            return digits.length() >= 4 ? digits : null;
        }
        java.util.regex.Pattern p2 = java.util.regex.Pattern.compile("\\b(1[0-9]{3}|[2-9][0-9]{3})\\b");
        java.util.regex.Matcher m2 = p2.matcher(direccion);
        return m2.find() ? m2.group(1) : null;
    }

    @Transactional
    public int geocodificarPendientes(int limite) {
        int ok = corregirFlexFueraDeAmba(limite);
        List<Envio> pendientes = envioRepository.findEnviosSinGeocode(PageRequest.of(0, limite));
        for (Envio envio : pendientes) {
            if (completarGeocodificacion(envio)) {
                ok++;
            }
        }
        return ok;
    }

    /** Flex es solo AMBA: si ML mandó CP/ciudad del interior, geocodifica la calle en CABA/GBA. */
    public void normalizarDireccionFlexAmba(EnvioDTO dto) {
        if (dto == null || dto.getDireccion() == null || dto.getDireccion().isBlank()
                || "Dirección pendiente".equalsIgnoreCase(dto.getDireccion().trim())) {
            return;
        }
        if (com.zetallegue.tms.util.ZonaEntregaUtil.zonaAmba(dto.getCodigoPostal()) != null) {
            dto.setZonaEntrega(com.zetallegue.tms.util.ZonaEntregaUtil.determinarSoloAmba(dto.getCodigoPostal()));
            return;
        }
        java.util.Optional<GeocodeService.Resultado> geo = geocodeService.geocodeEnAmba(dto.getDireccion());
        if (geo.isEmpty()) {
            dto.setZonaEntrega("Sin Zona");
            if (com.zetallegue.tms.util.ZonaEntregaUtil.zonaAmba(dto.getCodigoPostal()) == null) {
                dto.setCodigoPostal("");
                dto.setLocalidad("");
            }
            return;
        }
        GeocodeService.Resultado r = geo.get();
        if (r.codigoPostal != null && !r.codigoPostal.isBlank()) {
            dto.setCodigoPostal(r.codigoPostal);
        }
        if (r.localidad != null && !r.localidad.isBlank()) {
            dto.setLocalidad(r.localidad);
        }
        dto.setLatDestino(r.lat);
        dto.setLngDestino(r.lng);
        dto.setZonaEntrega(com.zetallegue.tms.util.ZonaEntregaUtil.determinarSoloAmba(dto.getCodigoPostal()));
    }

    @Transactional
    public int corregirFlexFueraDeAmba(int limite) {
        List<Envio> envios = envioRepository.findFlexFueraDeAmba(PageRequest.of(0, Math.min(Math.max(limite, 1), 80)));
        int ok = 0;
        for (Envio envio : envios) {
            if (aplicarGeocodeFlexAmba(envio)) {
                ok++;
            }
        }
        return ok;
    }

    @Transactional
    public boolean completarGeocodificacion(Envio envio) {
        if (envio == null) {
            return false;
        }
        if ("Flex".equals(envio.getOrigen())
                && com.zetallegue.tms.util.ZonaEntregaUtil.zonaAmba(envio.getCodigoPostal()) == null) {
            return aplicarGeocodeFlexAmba(envio);
        }
        if (envio.getLatDestino() != null && envio.getLngDestino() != null) {
            return false;
        }
        java.util.Optional<GeocodeService.Resultado> geo = geocodeService.geocodeDetallado(
                envio.getDireccion(), envio.getLocalidad(), envio.getCodigoPostal(), false);
        if (geo.isEmpty()) {
            return false;
        }
        GeocodeService.Resultado r = geo.get();
        envio.setLatDestino(r.lat);
        envio.setLngDestino(r.lng);
        envio.setZonaEntrega(com.zetallegue.tms.util.ZonaEntregaUtil.determinarSoloAmba(envio.getCodigoPostal()));
        envioRepository.save(envio);
        return true;
    }

    private boolean aplicarGeocodeFlexAmba(Envio envio) {
        java.util.Optional<GeocodeService.Resultado> geo = geocodeService.geocodeEnAmba(envio.getDireccion());
        if (geo.isEmpty()) {
            envio.setZonaEntrega("Sin Zona");
            if (com.zetallegue.tms.util.ZonaEntregaUtil.zonaAmba(envio.getCodigoPostal()) == null) {
                envio.setCodigoPostal(null);
                envio.setLocalidad(null);
            }
            if (!com.zetallegue.tms.util.ZonaEntregaUtil.coordenadasEnAmba(envio.getLatDestino(), envio.getLngDestino())) {
                envio.setLatDestino(null);
                envio.setLngDestino(null);
            }
            envioRepository.save(envio);
            return false;
        }
        GeocodeService.Resultado r = geo.get();
        if (r.codigoPostal != null && !r.codigoPostal.isBlank()) {
            envio.setCodigoPostal(r.codigoPostal);
        }
        if (r.localidad != null && !r.localidad.isBlank()) {
            envio.setLocalidad(r.localidad);
        }
        envio.setLatDestino(r.lat);
        envio.setLngDestino(r.lng);
        envio.setZonaEntrega(com.zetallegue.tms.util.ZonaEntregaUtil.determinarSoloAmba(envio.getCodigoPostal()));
        envioRepository.save(envio);
        log.info("Flex AMBA corregido envío {}: {} / {} / {}", envio.getId(),
                envio.getDireccion(), envio.getCodigoPostal(), envio.getZonaEntrega());
        return true;
    }

    /** Determina la zona de entrega por CP (CABA / Zona 1 / 2 / 3 / Sin Zona). */
    private String determinarZonaEntregaEnvio(String codigoPostal) {
        if (codigoPostal == null || codigoPostal.trim().isEmpty()) return "Sin Zona";
        String cpLimpio = codigoPostal.replaceAll("\\D", "");
        if (cpLimpio.isEmpty()) return "Sin Zona";
        int cpNumero;
        try {
            cpNumero = Integer.parseInt(cpLimpio);
        } catch (NumberFormatException e) {
            return "Sin Zona";
        }
        if (cpNumero >= 1000 && cpNumero <= 1599) return "CABA";
        if (CP_ZONA_1_ENVIO.contains(cpLimpio)) return "Zona 1";
        if (CP_ZONA_2_ENVIO.contains(cpLimpio)) return "Zona 2";
        if (CP_ZONA_3_ENVIO.contains(cpLimpio)) return "Zona 3";
        return "Sin Zona";
    }

    private static final java.util.Set<String> CP_ZONA_1_ENVIO = new java.util.HashSet<>(java.util.Arrays.asList(
            "1602","1603","1604","1605","1606","1607","1609","1636","1637","1638","1640","1641","1642","1643","1644","1645","1646","1649","1650","1651","1652","1653","1655","1657","1672","1674","1675","1676","1678","1682","1683","1684","1685","1686","1687","1688","1692","1702","1703","1704","1706","1707","1708","1712","1713","1714","1715","1751","1752","1753","1754","1766","1773","1821","1822","1823","1824","1825","1826","1827","1828","1829","1831","1832","1833","1834","1835","1836","1868","1869","1870","1871","1872","1873","1874","1875"
    ));
    private static final java.util.Set<String> CP_ZONA_2_ENVIO = new java.util.HashSet<>(java.util.Arrays.asList(
            "1608","1610","1611","1612","1613","1614","1615","1616","1617","1618","1621","1624","1648","1659","1660","1661","1662","1663","1664","1665","1666","1667","1670","1671","1716","1718","1722","1723","1724","1736","1738","1740","1742","1743","1744","1745","1746","1755","1757","1758","1759","1761","1763","1764","1765","1768","1770","1771","1772","1774","1776","1778","1785","1786","1801","1802","1803","1804","1805","1806","1807","1812","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1851","1852","1853","1854","1855","1856","1859","1860","1861","1863","1867","1876","1877","1878","1879","1880","1881","1882","1883","1884","1885","1886","1887","1888","1889","1890","1891","1893"
    ));
    private static final java.util.Set<String> CP_ZONA_3_ENVIO = new java.util.HashSet<>(java.util.Arrays.asList(
            "1601","1619","1620","1622","1623","1625","1626","1627","1628","1629","1630","1631","1632","1633","1634","1635","1639","1647","1669","1727","1748","1749","1808","1814","1815","1816","1858","1862","1864","1865","1894","1895","1896","1897","1898","1900","1901","1902","1903","1904","1905","1906","1907","1908","1909","1910","1912","1914","1916","1923","1924","1925","1926","1927","1929","1931","1984","2800","2801","2802","2804","2805","2806","2808","2814","2816","6608","6700","6701","6702","6703","6706","6708","6712"
    ));

    /** Resuelve el Cliente desde el nombre guardado en el envío (formato "código - nombre" o nombre). */
    private com.zetallegue.tms.model.Cliente resolverClienteDesdeEnvio(Envio envio) {
        String clienteStr = envio.getCliente();
        if (clienteStr == null || clienteStr.trim().isEmpty()) return null;
        if (clienteStr.contains(" - ")) {
            String codigo = clienteStr.split(" - ")[0].trim();
            return clienteRepository.findByCodigo(codigo).orElse(null);
        }
        String nombre = clienteStr.trim();
        return com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(clienteRepository.findAll()).stream()
                .filter(c -> (c.getNombreFantasia() != null && c.getNombreFantasia().equalsIgnoreCase(nombre)) ||
                             (c.getRazonSocial() != null && c.getRazonSocial().equalsIgnoreCase(nombre)))
                .findFirst()
                .orElse(null);
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
        List<Usuario> choferes = com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(
                usuarioRepository.findAllById(choferIds));
        
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
                List<com.zetallegue.tms.model.Cliente> clientes = com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(clienteRepository.findAll());
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


