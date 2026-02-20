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
public class EnvioServiceTiendaNube {

    private final EnvioRepository envioRepository;
    private final ClienteRepository clienteRepository;
    private final ListaPrecioRepository listaPrecioRepository;
    private final EnvioService envioService;

    /**
     * Crea un envío desde un pedido de Tienda Nube
     */
    @Transactional
    public EnvioDTO crearEnvioDesdeTiendaNube(JsonNode pedidoJson, Long clienteId) {
        log.info("Creando envío desde pedido de Tienda Nube para cliente {}", clienteId);
        
        Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        // Construir string del cliente para verificación
        String clienteStr = cliente.getCodigo() + " - " + (cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : cliente.getRazonSocial());
        
        // Obtener fecha de venta del pedido para verificación
        LocalDateTime fechaVenta = null;
        if (pedidoJson.has("created_at")) {
            try {
                String fechaStr = pedidoJson.get("created_at").asText();
                fechaVenta = parsearFechaTiendaNube(fechaStr);
            } catch (Exception e) {
                log.warn("Error al parsear fecha de venta: {}", e.getMessage());
            }
        }
        
        // Obtener destinatario del pedido para verificación
        String destinatario = null;
        if (pedidoJson.has("shipping_address") && pedidoJson.get("shipping_address").has("name")) {
            destinatario = pedidoJson.get("shipping_address").get("name").asText();
        } else if (pedidoJson.has("customer") && pedidoJson.get("customer").has("name")) {
            destinatario = pedidoJson.get("customer").get("name").asText();
        }
        
        // VERIFICAR PRIMERO si ya existe un envío para este pedido (usando cliente + fecha + destinatario)
        // Esto es más confiable que usar el tracking porque el tracking cambia cada vez
        if (fechaVenta != null && destinatario != null && !destinatario.trim().isEmpty()) {
            LocalDateTime fechaDesde = fechaVenta.minusMinutes(2);
            LocalDateTime fechaHasta = fechaVenta.plusMinutes(2);
            
            List<Envio> enviosExistentes = envioRepository.findEnviosTiendaNubeDuplicados(
                clienteStr,
                fechaDesde,
                fechaHasta,
                destinatario.trim()
            );
            
            if (!enviosExistentes.isEmpty()) {
                Envio envioExistente = enviosExistentes.get(0);
                log.info("Envío de Tienda Nube ya existe (verificado por cliente+fecha+destinatario), retornando existente con ID {} (NO se enviará email duplicado)", 
                    envioExistente.getId());
                // NO enviar email si el envío ya existía
                return toDTO(envioExistente);
            }
        }
        
        String numeroPedido = pedidoJson.has("number") ? pedidoJson.get("number").asText() : 
                             pedidoJson.has("id") ? pedidoJson.get("id").asText() : 
                             String.valueOf(System.currentTimeMillis());
        
        // Tracking = el que viene del envío (TN + número). ID_MVG = código único para búsqueda.
        String trackingOriginal = "TN-" + numeroPedido;
        String idMvg = envioService.generarTrackingUnico("TN-" + numeroPedido);
        
        log.info("Envío Tienda Nube - Tracking: {}, ID_MVG: {}", trackingOriginal, idMvg);
        
        List<Envio> enviosPorIdMvg = envioRepository.findByIdMvgAndEliminadoFalse(idMvg);
        Envio envioExistentePorTracking = enviosPorIdMvg.stream()
            .filter(e -> "Tienda Nube".equals(e.getOrigen()))
            .findFirst()
            .orElse(null);
        
        if (envioExistentePorTracking != null) {
            log.info("Envío de Tienda Nube con ID_MVG {} ya existe, retornando existente con ID {}", idMvg, envioExistentePorTracking.getId());
            return toDTO(envioExistentePorTracking);
        }
        
        EnvioDTO envioDTO = new EnvioDTO();
        
        // Fecha de carga: ahora
        LocalDateTime ahora = LocalDateTime.now();
        envioDTO.setFecha(ahora);
        
        // Usar la fechaVenta que ya se obtuvo arriba para la verificación
        // Si no se pudo obtener antes, intentar nuevamente
        if (fechaVenta == null && pedidoJson.has("created_at")) {
            try {
                String fechaStr = pedidoJson.get("created_at").asText();
                fechaVenta = parsearFechaTiendaNube(fechaStr);
            } catch (Exception e) {
                log.warn("Error al parsear fecha de venta: {}", e.getMessage());
            }
        }
        
        envioDTO.setFechaVenta(fechaVenta);
        
        // Fecha Llegue: igual a la fecha de venta o fecha actual si no hay fecha de venta
        // Esto es importante para que aparezca en el filtro por defecto de /envios
        envioDTO.setFechaLlegue(fechaVenta != null ? fechaVenta : ahora);
        
        // Origen: "Tienda Nube"
        envioDTO.setOrigen("Tienda Nube");
        
        envioDTO.setTracking(trackingOriginal);
        envioDTO.setIdMvg(idMvg);
        
        // Usar el clienteStr que ya se construyó arriba
        envioDTO.setCliente(clienteStr);
        
        // Dirección desde shipping_address
        if (pedidoJson.has("shipping_address")) {
            JsonNode shippingAddr = pedidoJson.get("shipping_address");
            StringBuilder direccion = new StringBuilder();
            if (shippingAddr.has("address")) direccion.append(shippingAddr.get("address").asText());
            if (shippingAddr.has("number")) direccion.append(" ").append(shippingAddr.get("number").asText());
            if (shippingAddr.has("floor") && !shippingAddr.get("floor").asText().isEmpty()) {
                direccion.append(" ").append(shippingAddr.get("floor").asText());
            }
            if (shippingAddr.has("locality") && !shippingAddr.get("locality").asText().isEmpty()) {
                direccion.append(", ").append(shippingAddr.get("locality").asText());
            }
            if (shippingAddr.has("city")) direccion.append(", ").append(shippingAddr.get("city").asText());
            if (shippingAddr.has("province")) direccion.append(", ").append(shippingAddr.get("province").asText());
            envioDTO.setDireccion(direccion.toString().trim());
            
            // Localidad
            if (shippingAddr.has("city")) {
                envioDTO.setLocalidad(shippingAddr.get("city").asText());
            }
            
            // Código postal
            if (shippingAddr.has("zipcode")) {
                envioDTO.setCodigoPostal(shippingAddr.get("zipcode").asText());
            }
        }
        
        // Nombre destinatario
        if (pedidoJson.has("shipping_address") && pedidoJson.get("shipping_address").has("name")) {
            envioDTO.setNombreDestinatario(pedidoJson.get("shipping_address").get("name").asText());
        } else if (pedidoJson.has("contact_name")) {
            envioDTO.setNombreDestinatario(pedidoJson.get("contact_name").asText());
        }
        
        // Teléfono (buscar en múltiples lugares)
        String telefono = null;
        if (pedidoJson.has("shipping_address") && pedidoJson.get("shipping_address").has("phone")) {
            String phoneFromAddr = pedidoJson.get("shipping_address").get("phone").asText();
            if (phoneFromAddr != null && !phoneFromAddr.trim().isEmpty()) {
                telefono = phoneFromAddr.trim();
            }
        }
        if ((telefono == null || telefono.isEmpty()) && pedidoJson.has("contact_phone")) {
            String phoneFromContact = pedidoJson.get("contact_phone").asText();
            if (phoneFromContact != null && !phoneFromContact.trim().isEmpty()) {
                telefono = phoneFromContact.trim();
            }
        }
        if (telefono != null && !telefono.isEmpty()) {
            envioDTO.setTelefono(telefono);
        }
        
        // Email desde contact_email
        if (pedidoJson.has("contact_email")) {
            String email = pedidoJson.get("contact_email").asText();
            if (email != null && !email.trim().isEmpty()) {
                envioDTO.setEmail(email.trim());
                log.info("Email mapeado desde Tienda Nube: {}", email);
            }
        }
        
        // Peso desde weight
        if (pedidoJson.has("weight")) {
            String peso = pedidoJson.get("weight").asText();
            if (peso != null && !peso.trim().isEmpty()) {
                envioDTO.setPeso(peso.trim());
                log.info("Peso mapeado desde Tienda Nube: {}", peso);
            }
        }
        
        // IDML: generar un número/palabra aleatorio de 12 caracteres (no único)
        String idml = generarIdmlAleatorio();
        envioDTO.setIdml(idml);
        log.info("IDML generado aleatoriamente: {}", idml);
        
        // Estado: "A retirar" por defecto
        envioDTO.setEstado("A retirar");
        
        // Impreso: "NO"
        envioDTO.setImpreso("NO");
        
        // Colectado: false (se marcará como true cuando se escanee)
        envioDTO.setColectado(false);
        
        // Método de envío
        if (pedidoJson.has("shipping_option")) {
            envioDTO.setMetodoEnvio(pedidoJson.get("shipping_option").asText());
        }
        
        // Calcular zona de entrega usando la misma lógica simple de Flex (solo CP, sin servicios)
        // Esto es seguro y no puede causar problemas de transacción
        envioDTO.setZonaEntrega(determinarZonaEntrega(envioDTO.getCodigoPostal()));
        
        // Calcular costo de envío desde lista de precios (acceso directo al repositorio para evitar problemas de transacción)
        // Esto es opcional y no debe fallar la transacción si hay un error
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
        
        // Generar QR Data para el envío (necesario para reimprimir)
        // Usar el tracking como QR data
        envioDTO.setQrData(tracking);
        
        // Establecer fechaUltimoMovimiento
        envioDTO.setFechaUltimoMovimiento(ahora);
        
        // Convertir DTO a Entity y guardar
        Envio envio = toEntity(envioDTO);
        
        log.info("Guardando envío en base de datos - Tracking: {}, Origen: {}, FechaLlegue: {}, Estado: {}", 
            envio.getTracking(), envio.getOrigen(), envio.getFechaLlegue(), envio.getEstado());
        
        // Guardar con flush para asegurar que se persiste inmediatamente
        envio = envioRepository.saveAndFlush(envio);
        
        log.info("Envío guardado con ID: {}", envio.getId());
        
        // Generar token único para tracking público si no existe
        if (envio.getTrackingToken() == null || envio.getTrackingToken().trim().isEmpty()) {
            String trackingToken = generarTrackingToken(envio.getTracking(), envio.getId());
            envio.setTrackingToken(trackingToken);
            envio = envioRepository.saveAndFlush(envio);
            log.info("Tracking token generado para envío Tienda Nube: {}", trackingToken);
        }
        
        log.info("Envío creado exitosamente desde pedido de Tienda Nube: ID={}, Tracking={}, Origen={}, FechaLlegue={}", 
            envio.getId(), envio.getTracking(), envio.getOrigen(), envio.getFechaLlegue());
        
        // Convertir a DTO dentro de la transacción para evitar problemas con relaciones lazy
        EnvioDTO resultado = toDTO(envio);
        log.info("DTO resultante - ID: {}, Tracking: {}, Origen: {}, FechaLlegue: {}", 
            resultado.getId(), resultado.getTracking(), resultado.getOrigen(), resultado.getFechaLlegue());
        
        // El email "Tu pedido está en camino" se envía cuando el envío pasa a estado Retirado (no al crear)
        
        return resultado;
    }
    
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
            log.warn("Error al parsear fecha de Tienda Nube: {}", fechaStr);
            return LocalDateTime.now();
        }
    }
    
    /**
     * Determina la zona de entrega basándose en el CP.
     * Misma lógica simple que Flex (CABA / Zona 1 / Zona 2 / Zona 3 / Sin Zona).
     * No requiere acceso a servicios ni base de datos, por lo que es seguro y no puede causar problemas de transacción.
     */
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

        // CABA (1000-1599)
        if (cpNumero >= 1000 && cpNumero <= 1599) {
            return "CABA";
        }

        if (CP_ZONA_1.contains(cpLimpio)) return "Zona 1";
        if (CP_ZONA_2.contains(cpLimpio)) return "Zona 2";
        if (CP_ZONA_3.contains(cpLimpio)) return "Zona 3";

        return "Sin Zona";
    }

    /**
     * Genera un IDML aleatorio de 12 caracteres (no único)
     * Usa letras mayúsculas y números
     */
    private String generarIdmlAleatorio() {
        String caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();
        StringBuilder idml = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            idml.append(caracteres.charAt(random.nextInt(caracteres.length())));
        }
        return idml.toString();
    }

    /**
     * Calcula el costo de envío desde la lista de precios del cliente
     * Acceso directo al repositorio para evitar problemas de transacción
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
            java.util.Optional<ListaPrecio> listaPrecioOpt = listaPrecioRepository.findById(listaPreciosId);
            if (listaPrecioOpt.isEmpty()) {
                log.warn("Lista de precios no encontrada con id: {}. Verificando si existe en la base de datos...", listaPreciosId);
                // Verificar todas las listas de precios disponibles para debugging
                long totalListas = listaPrecioRepository.count();
                log.warn("Total de listas de precios en la base de datos: {}", totalListas);
                // Listar todas las listas de precios disponibles
                listaPrecioRepository.findAll().forEach(lp -> 
                    log.warn("Lista de precios disponible: ID={}, Codigo={}, Nombre={}", lp.getId(), lp.getCodigo(), lp.getNombre())
                );
                return 0.0;
            }
            
            ListaPrecio listaPrecio = listaPrecioOpt.get();
            log.info("Lista de precios encontrada: ID={}, Codigo={}, Nombre={}, ZonaPropia={}", 
                listaPrecio.getId(), listaPrecio.getCodigo(), listaPrecio.getNombre(), listaPrecio.getZonaPropia());
            List<Zona> zonas;
            
            // Si no tiene zonas propias, cargar las zonas de la lista referenciada
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
            
            // Buscar el CP en las zonas
            for (Zona zona : zonas) {
                if (zona.getCps() == null || zona.getCps().isEmpty()) continue;
                
                String cps = zona.getCps();
                
                // Verificar si es un rango (ej: "1000-1599")
                Pattern rangoPattern = Pattern.compile("(\\d+)-(\\d+)");
                Matcher rangoMatch = rangoPattern.matcher(cps);
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

    // CPs por zona (misma lógica que Flex)
    private static final Set<String> CP_ZONA_1 = new HashSet<>(Arrays.asList(
            "1602","1603","1604","1605","1606","1607","1609","1636","1637","1638","1640","1641","1642","1643","1644","1645","1646","1649","1650","1651","1652","1653","1655","1657","1672","1674","1675","1676","1678","1682","1683","1684","1685","1686","1687","1688","1692","1702","1703","1704","1706","1707","1708","1712","1713","1714","1715","1751","1752","1753","1754","1766","1773","1821","1822","1823","1824","1825","1826","1827","1828","1829","1831","1832","1833","1834","1835","1836","1868","1869","1870","1871","1872","1873","1874","1875"
    ));
    private static final Set<String> CP_ZONA_2 = new HashSet<>(Arrays.asList(
            "1608","1610","1611","1612","1613","1614","1615","1616","1617","1618","1621","1624","1648","1659","1660","1661","1662","1663","1664","1665","1666","1667","1670","1671","1716","1718","1722","1723","1724","1736","1738","1740","1742","1743","1744","1745","1746","1755","1757","1758","1759","1761","1763","1764","1765","1768","1770","1771","1772","1774","1776","1778","1785","1786","1801","1802","1803","1804","1805","1806","1807","1812","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1851","1852","1853","1854","1855","1856","1859","1860","1861","1863","1867","1876","1877","1878","1879","1880","1881","1882","1883","1884","1885","1886","1887","1888","1889","1890","1891","1893"
    ));
    private static final Set<String> CP_ZONA_3 = new HashSet<>(Arrays.asList(
            "1601","1619","1620","1622","1623","1625","1626","1627","1628","1629","1630","1631","1632","1633","1634","1635","1639","1647","1669","1727","1748","1749","1808","1814","1815","1816","1858","1862","1864","1865","1894","1895","1896","1897","1898","1900","1901","1902","1903","1904","1905","1906","1907","1908","1909","1910","1912","1914","1916","1923","1924","1925","1926","1927","1929","1931","1984","2800","2801","2802","2804","2805","2806","2808","2814","2816","6608","6700","6701","6702","6703","6706","6708","6712"
    ));
    
    // Métodos auxiliares para convertir entre DTO y Entity (completo, similar a EnvioService)
    private Envio toEntity(EnvioDTO dto) {
        Envio envio = new Envio();
        LocalDateTime ahora = LocalDateTime.now();
        
        // Fechas
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
        
        // Datos básicos
        envio.setOrigen(dto.getOrigen() != null ? dto.getOrigen() : "Tienda Nube");
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
        
        // Estado y flags
        envio.setEstado(dto.getEstado() != null ? dto.getEstado() : "A retirar");
        envio.setEliminado(dto.getEliminado() != null ? dto.getEliminado() : false);
        envio.setColectado(dto.getColectado() != null ? dto.getColectado() : false);
        
        // Asignación
        envio.setChoferAsignadoId(dto.getChoferAsignadoId());
        envio.setChoferAsignadoNombre(dto.getChoferAsignadoNombre());
        
        // Datos de entrega
        envio.setRolRecibio(dto.getRolRecibio());
        envio.setNombreRecibio(dto.getNombreRecibio());
        envio.setDniRecibio(dto.getDniRecibio());
        
        // Costos y métodos
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

