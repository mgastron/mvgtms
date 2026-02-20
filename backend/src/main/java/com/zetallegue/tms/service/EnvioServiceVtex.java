package com.zetallegue.tms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.zetallegue.tms.dto.EnvioDTO;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.model.ListaPrecio;
import com.zetallegue.tms.model.Zona;
import com.zetallegue.tms.repository.ClienteRepository;
import com.zetallegue.tms.repository.EnvioRepository;
import com.zetallegue.tms.repository.ListaPrecioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

@Service
@RequiredArgsConstructor
@Slf4j
public class EnvioServiceVtex {

    private final EnvioRepository envioRepository;
    private final ClienteRepository clienteRepository;
    private final ListaPrecioRepository listaPrecioRepository;
    private final EnvioService envioService;

    /**
     * Crea un envío desde un pedido de VTEX
     */
    @Transactional
    public EnvioDTO crearEnvioDesdeVtex(JsonNode pedidoJson, Long clienteId) {
        log.info("Creando envío desde pedido de VTEX para cliente {}", clienteId);
        
        Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        // Tracking = el que viene del envío (VTEX + orderId). ID_MVG = código único para búsqueda.
        String orderId = pedidoJson.has("orderId") ? pedidoJson.get("orderId").asText() : 
                        pedidoJson.has("id") ? pedidoJson.get("id").asText() : 
                        String.valueOf(System.currentTimeMillis());
        String trackingOriginal = "VTEX-" + orderId;
        String idMvg = envioService.generarTrackingUnico("VTEX-" + orderId);
        
        // Verificar si ya existe un envío con este tracking Y origen "Vtex"
        List<Envio> enviosExistentes = envioRepository.findByTrackingAndEliminadoFalse(trackingOriginal);
        Envio envioExistente = enviosExistentes.stream()
            .filter(e -> "Vtex".equals(e.getOrigen()))
            .findFirst()
            .orElse(null);
        
        if (envioExistente != null) {
            log.info("Envío de VTEX con tracking {} ya existe, retornando existente con ID {}", 
                trackingOriginal, envioExistente.getId());
            return toDTO(envioExistente);
        }
        
        EnvioDTO envioDTO = new EnvioDTO();
        
        // Fecha de carga: ahora
        LocalDateTime ahora = LocalDateTime.now();
        envioDTO.setFecha(ahora);
        
        // Fecha de venta: creationDate del pedido
        LocalDateTime fechaVenta = null;
        if (pedidoJson.has("creationDate")) {
            try {
                String fechaStr = pedidoJson.get("creationDate").asText();
                fechaVenta = parsearFechaVtex(fechaStr);
                envioDTO.setFechaVenta(fechaVenta);
            } catch (Exception e) {
                log.warn("Error al parsear fecha de venta: {}", e.getMessage());
            }
        }
        
        // Fecha Llegue: igual a la fecha de venta o fecha actual si no hay fecha de venta
        envioDTO.setFechaLlegue(fechaVenta != null ? fechaVenta : ahora);
        
        // Origen: "Vtex"
        envioDTO.setOrigen("Vtex");
        
        envioDTO.setTracking(trackingOriginal);
        envioDTO.setIdMvg(idMvg);
        
        // Cliente: código - nombre
        String clienteStr = cliente.getCodigo() + " - " + (cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : cliente.getRazonSocial());
        envioDTO.setCliente(clienteStr);
        
        // Dirección desde shippingData
        if (pedidoJson.has("shippingData")) {
            JsonNode shippingData = pedidoJson.get("shippingData");
            
            if (shippingData.has("address")) {
                JsonNode address = shippingData.get("address");
                StringBuilder direccion = new StringBuilder();
                
                if (address.has("street")) direccion.append(address.get("street").asText());
                if (address.has("number")) direccion.append(" ").append(address.get("number").asText());
                if (address.has("complement") && !address.get("complement").asText().isEmpty()) {
                    direccion.append(" ").append(address.get("complement").asText());
                }
                if (address.has("neighborhood") && !address.get("neighborhood").asText().isEmpty()) {
                    direccion.append(", ").append(address.get("neighborhood").asText());
                }
                if (address.has("city")) direccion.append(", ").append(address.get("city").asText());
                if (address.has("state")) direccion.append(", ").append(address.get("state").asText());
                
                envioDTO.setDireccion(direccion.toString().trim());
                
                // Localidad
                if (address.has("city")) {
                    envioDTO.setLocalidad(address.get("city").asText());
                }
                
                // Código postal
                if (address.has("postalCode")) {
                    envioDTO.setCodigoPostal(address.get("postalCode").asText());
                }
            }
            
            // Nombre destinatario
            if (shippingData.has("receiverName")) {
                envioDTO.setNombreDestinatario(shippingData.get("receiverName").asText());
            } else if (shippingData.has("address") && shippingData.get("address").has("receiverName")) {
                envioDTO.setNombreDestinatario(shippingData.get("address").get("receiverName").asText());
            }
            
            // Teléfono
            if (shippingData.has("address")) {
                JsonNode address = shippingData.get("address");
                if (address.has("phone")) {
                    String telefono = address.get("phone").asText();
                    if (telefono != null && !telefono.trim().isEmpty()) {
                        envioDTO.setTelefono(telefono.trim());
                    }
                }
            }
        }
        
        // Email desde clientProfileData
        if (pedidoJson.has("clientProfileData")) {
            JsonNode clientProfile = pedidoJson.get("clientProfileData");
            if (clientProfile.has("email")) {
                String email = clientProfile.get("email").asText();
                if (email != null && !email.trim().isEmpty()) {
                    envioDTO.setEmail(email.trim());
                }
            }
        }
        
        // Peso desde items (sumar todos los items)
        if (pedidoJson.has("items")) {
            JsonNode items = pedidoJson.get("items");
            double pesoTotal = 0.0;
            if (items.isArray()) {
                for (JsonNode item : items) {
                    if (item.has("shippingWeight")) {
                        try {
                            pesoTotal += item.get("shippingWeight").asDouble();
                        } catch (Exception e) {
                            log.warn("Error al parsear peso del item: {}", e.getMessage());
                        }
                    }
                }
            }
            if (pesoTotal > 0) {
                envioDTO.setPeso(String.valueOf(pesoTotal));
            }
        }
        
        // IDML: generar un número/palabra aleatorio de 12 caracteres
        String idml = generarIdmlAleatorio();
        envioDTO.setIdml(idml);
        
        // Estado: "A retirar" por defecto
        envioDTO.setEstado("A retirar");
        
        // Impreso: "NO"
        envioDTO.setImpreso("NO");
        
        // Colectado: false
        envioDTO.setColectado(false);
        
        // Método de envío desde shippingData.logisticsInfo
        if (pedidoJson.has("shippingData") && pedidoJson.get("shippingData").has("logisticsInfo")) {
            JsonNode logisticsInfo = pedidoJson.get("shippingData").get("logisticsInfo");
            if (logisticsInfo.isArray() && logisticsInfo.size() > 0) {
                JsonNode firstLogistic = logisticsInfo.get(0);
                if (firstLogistic.has("selectedSla")) {
                    envioDTO.setMetodoEnvio(firstLogistic.get("selectedSla").asText());
                } else if (firstLogistic.has("shippingMethod")) {
                    envioDTO.setMetodoEnvio(firstLogistic.get("shippingMethod").asText());
                }
            }
        }
        
        // Calcular zona de entrega
        envioDTO.setZonaEntrega(determinarZonaEntrega(envioDTO.getCodigoPostal()));
        
        // Calcular costo de envío desde lista de precios
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
                envioDTO.setCostoEnvio(null);
                log.warn("Error al calcular costo de envío desde lista de precios (continuando sin costo): {}", e.getMessage());
            }
        } else {
            envioDTO.setCostoEnvio(null);
        }
        
        // Generar QR Data (usar ID_MVG para escaneo)
        envioDTO.setQrData(idMvg);
        
        // Establecer fechaUltimoMovimiento
        envioDTO.setFechaUltimoMovimiento(ahora);
        
        // Convertir DTO a Entity y guardar
        Envio envio = toEntity(envioDTO);
        
        log.info("Guardando envío en base de datos - Tracking: {}, Origen: {}, FechaLlegue: {}, Estado: {}", 
            envio.getTracking(), envio.getOrigen(), envio.getFechaLlegue(), envio.getEstado());
        
        envio = envioRepository.saveAndFlush(envio);
        
        log.info("Envío guardado con ID: {}", envio.getId());
        
        // Generar token único para tracking público si no existe
        if (envio.getTrackingToken() == null || envio.getTrackingToken().trim().isEmpty()) {
            String trackingToken = generarTrackingToken(envio.getTracking(), envio.getId());
            envio.setTrackingToken(trackingToken);
            envio = envioRepository.saveAndFlush(envio);
            log.info("Tracking token generado para envío VTEX: {}", trackingToken);
        }
        
        EnvioDTO resultado = toDTO(envio);
        
        // El email "Tu pedido está en camino" se envía cuando el envío pasa a estado Retirado (no al crear)
        
        return resultado;
    }
    
    private LocalDateTime parsearFechaVtex(String fechaStr) {
        try {
            // VTEX usa formato ISO 8601: "2024-01-15T10:30:00.000Z"
            if (fechaStr.contains("T")) {
                String fechaPart = fechaStr.split("T")[0];
                String horaPart = fechaStr.split("T")[1];
                horaPart = horaPart.split("\\+")[0].split("Z")[0].split("\\.")[0];
                return LocalDateTime.parse(fechaPart + "T" + horaPart);
            } else {
                return LocalDate.parse(fechaStr).atStartOfDay();
            }
        } catch (Exception e) {
            log.warn("Error al parsear fecha de VTEX: {}", fechaStr);
            return LocalDateTime.now();
        }
    }
    
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

        if (cpNumero >= 1000 && cpNumero <= 1599) {
            return "CABA";
        }

        if (CP_ZONA_1.contains(cpLimpio)) return "Zona 1";
        if (CP_ZONA_2.contains(cpLimpio)) return "Zona 2";
        if (CP_ZONA_3.contains(cpLimpio)) return "Zona 3";

        return "Sin Zona";
    }
    
    private String generarIdmlAleatorio() {
        String caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();
        StringBuilder idml = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            idml.append(caracteres.charAt(random.nextInt(caracteres.length())));
        }
        return idml.toString();
    }
    
    private double calcularCostoEnvioDesdeListaPrecios(String codigoPostal, Long listaPreciosId) {
        try {
            String cpLimpio = codigoPostal.replaceAll("\\D", "");
            int cpNumero;
            try {
                cpNumero = Integer.parseInt(cpLimpio);
            } catch (NumberFormatException e) {
                log.warn("CP inválido: {}", codigoPostal);
                return 0.0;
            }
            
            log.info("Buscando lista de precios con ID: {} para CP: {}", listaPreciosId, codigoPostal);
            java.util.Optional<ListaPrecio> listaPrecioOpt = listaPrecioRepository.findById(listaPreciosId);
            if (listaPrecioOpt.isEmpty()) {
                log.warn("Lista de precios no encontrada con id: {}", listaPreciosId);
                return 0.0;
            }
            
            ListaPrecio listaPrecio = listaPrecioOpt.get();
            List<Zona> zonas;
            
            if (!listaPrecio.getZonaPropia() && listaPrecio.getListaPrecioSeleccionada() != null) {
                java.util.Optional<ListaPrecio> listaReferenciadaOpt = listaPrecioRepository.findById(listaPrecio.getListaPrecioSeleccionada());
                if (listaReferenciadaOpt.isPresent()) {
                    ListaPrecio listaReferenciada = listaReferenciadaOpt.get();
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
            
            for (Zona zona : zonas) {
                if (zona.getCps() == null || zona.getCps().isEmpty()) continue;
                
                String cps = zona.getCps();
                
                Pattern rangoPattern = Pattern.compile("(\\d+)-(\\d+)");
                Matcher rangoMatch = rangoPattern.matcher(cps);
                if (rangoMatch.find()) {
                    int inicio = Integer.parseInt(rangoMatch.group(1));
                    int fin = Integer.parseInt(rangoMatch.group(2));
                    if (cpNumero >= inicio && cpNumero <= fin) {
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
                
                String[] cpsLista = cps.split(",");
                for (String cp : cpsLista) {
                    String cpTrim = cp.trim();
                    if (cpTrim.equals(cpLimpio) || cpTrim.equals(String.valueOf(cpNumero))) {
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

    private static final Set<String> CP_ZONA_1 = new HashSet<>(Arrays.asList(
            "1602","1603","1604","1605","1606","1607","1609","1636","1637","1638","1640","1641","1642","1643","1644","1645","1646","1649","1650","1651","1652","1653","1655","1657","1672","1674","1675","1676","1678","1682","1683","1684","1685","1686","1687","1688","1692","1702","1703","1704","1706","1707","1708","1712","1713","1714","1715","1751","1752","1753","1754","1766","1773","1821","1822","1823","1824","1825","1826","1827","1828","1829","1831","1832","1833","1834","1835","1836","1868","1869","1870","1871","1872","1873","1874","1875"
    ));
    private static final Set<String> CP_ZONA_2 = new HashSet<>(Arrays.asList(
            "1608","1610","1611","1612","1613","1614","1615","1616","1617","1618","1621","1624","1648","1659","1660","1661","1662","1663","1664","1665","1666","1667","1670","1671","1716","1718","1722","1723","1724","1736","1738","1740","1742","1743","1744","1745","1746","1755","1757","1758","1759","1761","1763","1764","1765","1768","1770","1771","1772","1774","1776","1778","1785","1786","1801","1802","1803","1804","1805","1806","1807","1812","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1851","1852","1853","1854","1855","1856","1859","1860","1861","1863","1867","1876","1877","1878","1879","1880","1881","1882","1883","1884","1885","1886","1887","1888","1889","1890","1891","1893"
    ));
    private static final Set<String> CP_ZONA_3 = new HashSet<>(Arrays.asList(
            "1601","1619","1620","1622","1623","1625","1626","1627","1628","1629","1630","1631","1632","1633","1634","1635","1639","1647","1669","1727","1748","1749","1808","1814","1815","1816","1858","1862","1864","1865","1894","1895","1896","1897","1898","1900","1901","1902","1903","1904","1905","1906","1907","1908","1909","1910","1912","1914","1916","1923","1924","1925","1926","1927","1929","1931","1984","2800","2801","2802","2804","2805","2806","2808","2814","2816","6608","6700","6701","6702","6703","6706","6708","6712"
    ));
    
    private Envio toEntity(EnvioDTO dto) {
        Envio envio = new Envio();
        LocalDateTime ahora = LocalDateTime.now();
        
        envio.setFecha(dto.getFecha() != null ? dto.getFecha() : ahora);
        envio.setFechaVenta(dto.getFechaVenta());
        envio.setFechaLlegue(dto.getFechaLlegue() != null ? dto.getFechaLlegue() : ahora);
        envio.setFechaEntregado(dto.getFechaEntregado());
        envio.setFechaAsignacion(dto.getFechaAsignacion());
        envio.setFechaDespacho(dto.getFechaDespacho());
        envio.setFechaColecta(dto.getFechaColecta());
        envio.setFechaAPlanta(dto.getFechaAPlanta());
        envio.setFechaCancelado(dto.getFechaCancelado());
        envio.setFechaUltimoMovimiento(dto.getFechaUltimoMovimiento() != null ? dto.getFechaUltimoMovimiento() : ahora);
        
        envio.setOrigen(dto.getOrigen() != null ? dto.getOrigen() : "Vtex");
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
        envio.setColectado(dto.getColectado() != null ? dto.getColectado() : false);
        
        envio.setChoferAsignadoId(dto.getChoferAsignadoId());
        envio.setChoferAsignadoNombre(dto.getChoferAsignadoNombre());
        
        envio.setRolRecibio(dto.getRolRecibio());
        envio.setNombreRecibio(dto.getNombreRecibio());
        envio.setDniRecibio(dto.getDniRecibio());
        
        envio.setCostoEnvio(dto.getCostoEnvio());
        envio.setMetodoEnvio(dto.getMetodoEnvio());
        envio.setIdml(dto.getIdml());
        envio.setPeso(dto.getPeso());
        envio.setDeadline(dto.getDeadline());
        envio.setMlShipmentId(dto.getMlShipmentId());
        envio.setTrackingToken(dto.getTrackingToken());
        
        return envio;
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
        dto.setColectado(envio.getColectado());
        dto.setChoferAsignadoId(envio.getChoferAsignadoId());
        dto.setChoferAsignadoNombre(envio.getChoferAsignadoNombre());
        dto.setRolRecibio(envio.getRolRecibio());
        dto.setNombreRecibio(envio.getNombreRecibio());
        dto.setDniRecibio(envio.getDniRecibio());
        dto.setCostoEnvio(envio.getCostoEnvio());
        dto.setMetodoEnvio(envio.getMetodoEnvio());
        dto.setIdml(envio.getIdml());
        dto.setPeso(envio.getPeso());
        dto.setDeadline(envio.getDeadline());
        dto.setMlShipmentId(envio.getMlShipmentId());
        dto.setTrackingToken(envio.getTrackingToken());
        return dto;
    }
    
    /**
     * Genera un token único para el link público de tracking.
     */
    private String generarTrackingToken(String tracking, Long envioId) {
        try {
            String input = (tracking != null ? tracking : "") + 
                          (envioId != null ? envioId.toString() : "") + 
                          System.currentTimeMillis() + 
                          Math.random();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            
            String caracteres = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            StringBuilder token = new StringBuilder(32);
            
            for (int i = 0; i < 32; i++) {
                int index = Math.abs(hash[i % hash.length]) % caracteres.length();
                token.append(caracteres.charAt(index));
            }
            
            String tokenBase = token.toString();
            String tokenFinal = tokenBase;
            int contador = 0;
            int maxIntentos = 100;
            
            while (contador < maxIntentos) {
                List<Envio> enviosExistentes = envioRepository.findByTrackingTokenAndEliminadoFalse(tokenFinal);
                if (enviosExistentes.isEmpty()) {
                    return tokenFinal;
                }
                contador++;
                String sufijo = String.format("%02d", contador % 100);
                tokenFinal = tokenBase.substring(0, 30) + sufijo;
            }
            
            return generarTrackingTokenDesdeTimestamp();
        } catch (Exception e) {
            log.error("Error al generar tracking token: {}", e.getMessage());
            return generarTrackingTokenDesdeTimestamp();
        }
    }
    
    private String generarTrackingTokenDesdeTimestamp() {
        String caracteres = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        Random random = new Random(System.currentTimeMillis());
        StringBuilder token = new StringBuilder(32);
        for (int i = 0; i < 32; i++) {
            token.append(caracteres.charAt(random.nextInt(caracteres.length())));
        }
        return token.toString();
    }
}

