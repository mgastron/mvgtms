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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
public class EnvioServiceShopify {

    private final EnvioRepository envioRepository;
    private final ClienteRepository clienteRepository;
    private final ListaPrecioRepository listaPrecioRepository;
    private final EnvioService envioService;

    // Zonas de CP para determinar zona de entrega (misma lógica que Flex y Tienda Nube)
    private static final Set<String> CP_ZONA_1 = new HashSet<>(Arrays.asList(
        "1600", "1601", "1602", "1603", "1604", "1605", "1606", "1607", "1608", "1609",
        "1610", "1611", "1612", "1613", "1614", "1615", "1616", "1617", "1618", "1619",
        "1620", "1621", "1622", "1623", "1624", "1625", "1626", "1627", "1628", "1629",
        "1630", "1631", "1632", "1633", "1634", "1635", "1636", "1637", "1638", "1639",
        "1640", "1641", "1642", "1643", "1644", "1645", "1646", "1647", "1648", "1649",
        "1650", "1651", "1652", "1653", "1654", "1655", "1656", "1657", "1658", "1659"
    ));

    private static final Set<String> CP_ZONA_2 = new HashSet<>(Arrays.asList(
        "1660", "1661", "1662", "1663", "1664", "1665", "1666", "1667", "1668", "1669",
        "1670", "1671", "1672", "1673", "1674", "1675", "1676", "1677", "1678", "1679",
        "1680", "1681", "1682", "1683", "1684", "1685", "1686", "1687", "1688", "1689"
    ));

    private static final Set<String> CP_ZONA_3 = new HashSet<>(Arrays.asList(
        "1690", "1691", "1692", "1693", "1694", "1695", "1696", "1697", "1698", "1699",
        "1700", "1701", "1702", "1703", "1704", "1705", "1706", "1707", "1708", "1709"
    ));

    /**
     * Crea un envío desde un pedido de Shopify
     */
    @Transactional
    public EnvioDTO crearEnvioDesdeShopify(JsonNode pedidoJson, Long clienteId) {
        log.info("Creando envío desde pedido de Shopify para cliente {}", clienteId);
        
        Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new RuntimeException("Cliente no encontrado con id: " + clienteId));
        
        // Construir string del cliente para verificación
        String clienteStr = cliente.getCodigo() + " - " + (cliente.getNombreFantasia() != null ? cliente.getNombreFantasia() : cliente.getRazonSocial());
        
        // Obtener número de pedido
        String numeroPedido = pedidoJson.has("order_number") ? pedidoJson.get("order_number").asText() :
                              pedidoJson.has("id") ? pedidoJson.get("id").asText() :
                              pedidoJson.has("name") ? pedidoJson.get("name").asText() : "desconocido";
        
        // Obtener fecha de venta (created_at en Shopify)
        LocalDateTime fechaVenta = null;
        if (pedidoJson.has("created_at") && !pedidoJson.get("created_at").isNull()) {
            try {
                String fechaStr = pedidoJson.get("created_at").asText();
                log.info("📅 Parseando fecha de pedido Shopify - String original: '{}'", fechaStr);
                fechaVenta = parsearFechaShopify(fechaStr);
                log.info("📅 Fecha parseada exitosamente: {}", fechaVenta);
            } catch (Exception e) {
                log.error("❌ Error al parsear fecha de venta: {}", e.getMessage(), e);
                // NO establecer fechaVenta = LocalDateTime.now() aquí, dejarlo como null
                // para que se maneje más abajo
            }
        } else {
            log.warn("⚠️ Pedido de Shopify no tiene campo 'created_at' o es null");
        }
        
        // Obtener destinatario
        String destinatario = null;
        if (pedidoJson.has("shipping_address") && pedidoJson.get("shipping_address").has("name")) {
            destinatario = pedidoJson.get("shipping_address").get("name").asText();
        } else if (pedidoJson.has("customer") && pedidoJson.get("customer").has("first_name")) {
            String firstName = pedidoJson.get("customer").get("first_name").asText();
            String lastName = pedidoJson.has("customer") && pedidoJson.get("customer").has("last_name") 
                ? pedidoJson.get("customer").get("last_name").asText() : "";
            destinatario = firstName + " " + lastName;
        }
        
        // Verificar si ya existe un envío para este pedido ANTES de procesarlo
        if (fechaVenta != null && destinatario != null && !destinatario.trim().isEmpty()) {
            LocalDateTime fechaDesde = fechaVenta.minusMinutes(2);
            LocalDateTime fechaHasta = fechaVenta.plusMinutes(2);
            
            List<Envio> enviosExistentes = envioRepository.findEnviosShopifyDuplicados(
                clienteStr,
                fechaDesde,
                fechaHasta,
                destinatario.trim()
            );
            
            if (!enviosExistentes.isEmpty()) {
                log.info("Envío de Shopify ya existe para pedido {} del cliente {} - Retornando existente (NO se enviará email duplicado)", 
                    numeroPedido, clienteId);
                return toDTO(enviosExistentes.get(0));
            }
        }
        
        // Tracking = el que viene del envío (Shopify: prefijo + número de pedido). ID_MVG = código único para búsqueda.
        String trackingOriginal = "SHOPIFY-" + numeroPedido;
        String idMvg = envioService.generarTrackingUnico("SHOPIFY-" + numeroPedido);
        
        log.info("Envío Shopify - Tracking: {}, ID_MVG: {}", trackingOriginal, idMvg);
        
        List<Envio> enviosPorIdMvg = envioRepository.findByIdMvgAndEliminadoFalse(idMvg);
        Envio envioExistentePorTracking = enviosPorIdMvg.stream()
            .filter(e -> "Shopify".equals(e.getOrigen()))
            .findFirst()
            .orElse(null);
        
        if (envioExistentePorTracking != null) {
            log.info("Envío de Shopify con ID_MVG {} ya existe, retornando existente con ID {}", idMvg, envioExistentePorTracking.getId());
            return toDTO(envioExistentePorTracking);
        }
        
        EnvioDTO envioDTO = new EnvioDTO();
        
        // Fecha de carga: ahora
        LocalDateTime ahora = LocalDateTime.now();
        envioDTO.setFecha(ahora);
        
        // Usar la fechaVenta que ya se obtuvo arriba
        if (fechaVenta == null && pedidoJson.has("created_at")) {
            try {
                String fechaStr = pedidoJson.get("created_at").asText();
                fechaVenta = parsearFechaShopify(fechaStr);
            } catch (Exception e) {
                log.warn("Error al parsear fecha de venta: {}", e.getMessage());
            }
        }
        
        // IMPORTANTE: Asegurar que fechaVenta se establezca correctamente
        if (fechaVenta == null) {
            log.error("⚠️ ERROR CRÍTICO: fechaVenta es NULL antes de guardar el envío! Pedido: {}", numeroPedido);
            // Intentar parsear nuevamente como último recurso
            if (pedidoJson.has("created_at")) {
                try {
                    String fechaStr = pedidoJson.get("created_at").asText();
                    fechaVenta = parsearFechaShopify(fechaStr);
                    log.info("Fecha parseada nuevamente: {}", fechaVenta);
                } catch (Exception e) {
                    log.error("Error al parsear fecha nuevamente: {}", e.getMessage());
                }
            }
        }
        
        envioDTO.setFechaVenta(fechaVenta);
        log.info("📅 FechaVenta establecida en DTO: {} (pedido original: {})", 
            fechaVenta, pedidoJson.has("created_at") ? pedidoJson.get("created_at").asText() : "N/A");
        
        // Fecha Llegue: igual a la fecha de venta o fecha actual si no hay fecha de venta
        envioDTO.setFechaLlegue(fechaVenta != null ? fechaVenta : ahora);
        
        // Origen: "Shopify"
        envioDTO.setOrigen("Shopify");
        
        envioDTO.setTracking(trackingOriginal);
        envioDTO.setIdMvg(idMvg);
        
        // Cliente
        envioDTO.setCliente(clienteStr);
        
        // Dirección desde shipping_address (similar a TiendaNube)
        if (pedidoJson.has("shipping_address")) {
            JsonNode shippingAddr = pedidoJson.get("shipping_address");
            
            // Log para debug: mostrar todos los campos disponibles en shipping_address
            java.util.Iterator<String> fieldNames = shippingAddr.fieldNames();
            java.util.List<String> campos = new java.util.ArrayList<>();
            while (fieldNames.hasNext()) {
                campos.add(fieldNames.next());
            }
            log.info("📍 Campos disponibles en shipping_address de Shopify: {}", String.join(", ", campos));
            
            StringBuilder direccion = new StringBuilder();
            
            if (shippingAddr.has("address1")) {
                String address1 = shippingAddr.get("address1").asText();
                direccion.append(address1);
                log.info("📍 address1: '{}'", address1);
            }
            if (shippingAddr.has("address2") && !shippingAddr.get("address2").asText().isEmpty()) {
                String address2 = shippingAddr.get("address2").asText();
                direccion.append(" ").append(address2);
                log.info("📍 address2: '{}'", address2);
            }
            if (shippingAddr.has("city")) {
                String city = shippingAddr.get("city").asText();
                direccion.append(", ").append(city);
                log.info("📍 city: '{}'", city);
            }
            if (shippingAddr.has("province")) {
                String province = shippingAddr.get("province").asText();
                direccion.append(", ").append(province);
                log.info("📍 province: '{}'", province);
            }
            if (shippingAddr.has("country")) {
                String country = shippingAddr.get("country").asText();
                direccion.append(", ").append(country);
                log.info("📍 country: '{}'", country);
            }
            
            String direccionFinal = direccion.toString().trim();
            envioDTO.setDireccion(direccionFinal);
            log.info("📍 Dirección final mapeada: '{}'", direccionFinal);
            
            // Localidad
            if (shippingAddr.has("city")) {
                envioDTO.setLocalidad(shippingAddr.get("city").asText());
            }
            
            // Código postal - Shopify puede usar "zip", "zip_code", o "postal_code"
            String codigoPostal = null;
            if (shippingAddr.has("zip") && !shippingAddr.get("zip").isNull()) {
                codigoPostal = shippingAddr.get("zip").asText().trim();
                log.info("📍 CP desde 'zip': '{}'", codigoPostal);
            } else if (shippingAddr.has("zip_code") && !shippingAddr.get("zip_code").isNull()) {
                codigoPostal = shippingAddr.get("zip_code").asText().trim();
                log.info("📍 CP desde 'zip_code': '{}'", codigoPostal);
            } else if (shippingAddr.has("postal_code") && !shippingAddr.get("postal_code").isNull()) {
                codigoPostal = shippingAddr.get("postal_code").asText().trim();
                log.info("📍 CP desde 'postal_code': '{}'", codigoPostal);
            } else {
                log.warn("⚠️ No se encontró campo de código postal en shipping_address (buscado: zip, zip_code, postal_code)");
            }
            
            if (codigoPostal != null && !codigoPostal.isEmpty()) {
                envioDTO.setCodigoPostal(codigoPostal);
                log.info("📍 Código postal mapeado: '{}'", codigoPostal);
            } else {
                log.warn("⚠️ Código postal no disponible o vacío para pedido {}", numeroPedido);
            }
        } else {
            log.warn("⚠️ Pedido de Shopify no tiene 'shipping_address'");
        }
        
        // Nombre destinatario
        if (pedidoJson.has("shipping_address") && pedidoJson.get("shipping_address").has("name")) {
            envioDTO.setNombreDestinatario(pedidoJson.get("shipping_address").get("name").asText());
        } else if (pedidoJson.has("customer")) {
            JsonNode customer = pedidoJson.get("customer");
            String firstName = customer.has("first_name") ? customer.get("first_name").asText() : "";
            String lastName = customer.has("last_name") ? customer.get("last_name").asText() : "";
            String nombreCompleto = (firstName + " " + lastName).trim();
            if (!nombreCompleto.isEmpty()) {
                envioDTO.setNombreDestinatario(nombreCompleto);
            }
        }
        
        // Teléfono
        if (pedidoJson.has("shipping_address") && pedidoJson.get("shipping_address").has("phone")) {
            String telefono = pedidoJson.get("shipping_address").get("phone").asText();
            if (telefono != null && !telefono.trim().isEmpty()) {
                envioDTO.setTelefono(telefono.trim());
            }
        } else if (pedidoJson.has("customer") && pedidoJson.get("customer").has("phone")) {
            String telefono = pedidoJson.get("customer").get("phone").asText();
            if (telefono != null && !telefono.trim().isEmpty()) {
                envioDTO.setTelefono(telefono.trim());
            }
        }
        
        // Email desde customer o shipping_address
        if (pedidoJson.has("customer") && pedidoJson.get("customer").has("email")) {
            String email = pedidoJson.get("customer").get("email").asText();
            if (email != null && !email.trim().isEmpty()) {
                envioDTO.setEmail(email.trim());
                log.info("Email mapeado desde Shopify: {}", email);
            }
        }
        
        // Peso desde total_weight (en gramos, convertir a kg si es necesario)
        if (pedidoJson.has("total_weight")) {
            try {
                double pesoGramos = pedidoJson.get("total_weight").asDouble();
                if (pesoGramos > 0) {
                    // Convertir a kg si es mayor a 1000g
                    if (pesoGramos >= 1000) {
                        envioDTO.setPeso(String.format("%.2f", pesoGramos / 1000.0) + " kg");
                    } else {
                        envioDTO.setPeso(String.format("%.0f", pesoGramos) + " g");
                    }
                    log.info("Peso mapeado desde Shopify: {}", envioDTO.getPeso());
                }
            } catch (Exception e) {
                log.warn("Error al parsear peso: {}", e.getMessage());
            }
        }
        
        // IDML: generar un número/palabra aleatorio de 12 caracteres
        String idml = generarIdmlAleatorio();
        envioDTO.setIdml(idml);
        log.info("IDML generado aleatoriamente: {}", idml);
        
        // Estado: "A retirar" por defecto
        envioDTO.setEstado("A retirar");
        
        // Impreso: "NO"
        envioDTO.setImpreso("NO");
        
        // Colectado: false
        envioDTO.setColectado(false);
        
        // Método de envío desde shipping_lines
        if (pedidoJson.has("shipping_lines") && pedidoJson.get("shipping_lines").isArray()) {
            JsonNode shippingLines = pedidoJson.get("shipping_lines");
            if (shippingLines.size() > 0) {
                JsonNode firstLine = shippingLines.get(0);
                if (firstLine.has("title")) {
                    envioDTO.setMetodoEnvio(firstLine.get("title").asText());
                } else if (firstLine.has("code")) {
                    envioDTO.setMetodoEnvio(firstLine.get("code").asText());
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
            if (codigoPostal == null || codigoPostal.trim().isEmpty()) {
                log.warn("No se puede calcular costo de envío - CP no disponible para cliente {}", cliente.getId());
            } else if (cliente.getListaPreciosId() == null) {
                log.warn("No se puede calcular costo de envío - Cliente {} ({}) sin lista de precios configurada", 
                    cliente.getId(), cliente.getNombreFantasia());
            }
        }
        
        // Generar QR Data
        envioDTO.setQrData(tracking);
        
        // Establecer fechaUltimoMovimiento
        envioDTO.setFechaUltimoMovimiento(ahora);
        
        // Convertir DTO a Entity y guardar
        Envio envio = toEntity(envioDTO);
        
        log.info("Guardando envío en base de datos - Tracking: {}, Origen: {}, FechaVenta: {}, FechaLlegue: {}, Estado: {}", 
            envio.getTracking(), envio.getOrigen(), envio.getFechaVenta(), envio.getFechaLlegue(), envio.getEstado());
        
        // Verificar que fechaVenta se mapeó correctamente
        if (envio.getFechaVenta() == null) {
            log.error("⚠️ ERROR: fechaVenta es NULL en la entidad antes de guardar! DTO tenía: {}", envioDTO.getFechaVenta());
        }
        
        envio = envioRepository.saveAndFlush(envio);
        
        log.info("Envío guardado con ID: {}", envio.getId());
        log.info("✅ VALORES GUARDADOS EN ENVÍO SHOPIFY - Cliente: '{}', FechaVenta: {}, NombreDestinatario: '{}', Origen: '{}', Tracking: '{}'", 
            envio.getCliente(), envio.getFechaVenta(), envio.getNombreDestinatario(), envio.getOrigen(), envio.getTracking());
        
        // Verificar que la fecha de venta se guardó correctamente
        if (envio.getFechaVenta() == null) {
            log.error("⚠️ ERROR: FechaVenta es NULL después de guardar el envío!");
        } else if (envio.getFechaVenta().isAfter(LocalDateTime.now().minusMinutes(5))) {
            log.warn("⚠️ ADVERTENCIA: FechaVenta parece ser la fecha actual en lugar de la fecha del pedido. FechaVenta: {}, Ahora: {}", 
                envio.getFechaVenta(), LocalDateTime.now());
        }
        
        // Generar token único para tracking público si no existe
        if (envio.getTrackingToken() == null || envio.getTrackingToken().trim().isEmpty()) {
            String trackingToken = generarTrackingToken(envio.getTracking(), envio.getId());
            envio.setTrackingToken(trackingToken);
            envio = envioRepository.saveAndFlush(envio);
            log.info("Tracking token generado para envío Shopify: {}", trackingToken);
        }
        
        log.info("Envío creado exitosamente desde pedido de Shopify: ID={}, Tracking={}, Origen={}, FechaLlegue={}", 
            envio.getId(), envio.getTracking(), envio.getOrigen(), envio.getFechaLlegue());
        
        // Convertir a DTO dentro de la transacción
        EnvioDTO resultado = toDTO(envio);
        
        // El email "Tu pedido está en camino" se envía cuando el envío pasa a estado Retirado (no al crear)
        
        return resultado;
    }
    
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
            LocalDateTime fechaParseada = zonedDateTime.toLocalDateTime();
            log.info("✅ Fecha parseada correctamente: '{}' -> {} (timezone original: {})", 
                fechaStr, fechaParseada, zonedDateTime.getZone());
            return fechaParseada;
        } catch (Exception e) {
            log.error("❌ ERROR al parsear fecha de Shopify: '{}' - Error: {}", fechaStr, e.getMessage(), e);
            // NO retornar LocalDateTime.now() aquí, mejor lanzar excepción para que se maneje arriba
            throw new RuntimeException("No se pudo parsear la fecha de Shopify: " + fechaStr, e);
        }
    }
    
    /**
     * Determina la zona de entrega basándose en el CP.
     * Misma lógica simple que Flex y Tienda Nube.
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
     * Genera un IDML aleatorio de 12 caracteres
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
     */
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
            
            // Buscar el CP en las zonas
            for (Zona zona : zonas) {
                if (zona.getCps() == null || zona.getCps().isEmpty()) continue;
                
                String cps = zona.getCps();
                
                // Verificar si es un rango
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
                
                // Verificar si está en la lista de CPs separados por comas
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

    /**
     * Genera un token único para el tracking público
     */
    private String generarTrackingToken(String tracking, Long envioId) {
        try {
            String semilla = tracking + "-" + envioId + "-" + System.currentTimeMillis();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(semilla.getBytes(StandardCharsets.UTF_8));
            
            // Convertir a hexadecimal y tomar los primeros 32 caracteres
            StringBuilder token = new StringBuilder();
            for (byte b : hash) {
                token.append(String.format("%02x", b));
            }
            return token.substring(0, 32);
        } catch (Exception e) {
            log.error("Error al generar tracking token: {}", e.getMessage(), e);
            // Fallback: usar timestamp
            return generarTrackingTokenDesdeTimestamp();
        }
    }

    private String generarTrackingTokenDesdeTimestamp() {
        String timestamp = String.valueOf(System.currentTimeMillis());
        String random = String.valueOf(new Random().nextInt(10000));
        return (timestamp + random).substring(0, Math.min(32, timestamp.length() + random.length()));
    }

    private Envio toEntity(EnvioDTO dto) {
        Envio envio = new Envio();
        envio.setId(dto.getId());
        envio.setFecha(dto.getFecha());
        envio.setFechaVenta(dto.getFechaVenta());
        envio.setFechaLlegue(dto.getFechaLlegue());
        envio.setOrigen(dto.getOrigen());
        envio.setTracking(dto.getTracking());
        envio.setIdMvg(dto.getIdMvg());
        envio.setCliente(dto.getCliente());
        envio.setDireccion(dto.getDireccion());
        envio.setLocalidad(dto.getLocalidad());
        envio.setCodigoPostal(dto.getCodigoPostal());
        envio.setNombreDestinatario(dto.getNombreDestinatario());
        envio.setTelefono(dto.getTelefono());
        envio.setEmail(dto.getEmail());
        envio.setPeso(dto.getPeso());
        envio.setIdml(dto.getIdml());
        envio.setEstado(dto.getEstado());
        envio.setImpreso(dto.getImpreso());
        envio.setColectado(dto.getColectado());
        envio.setMetodoEnvio(dto.getMetodoEnvio());
        envio.setZonaEntrega(dto.getZonaEntrega());
        envio.setCostoEnvio(dto.getCostoEnvio());
        envio.setQrData(dto.getQrData());
        envio.setFechaUltimoMovimiento(dto.getFechaUltimoMovimiento());
        envio.setTrackingToken(dto.getTrackingToken());
        return envio;
    }

    private EnvioDTO toDTO(Envio envio) {
        EnvioDTO dto = new EnvioDTO();
        dto.setId(envio.getId());
        dto.setFecha(envio.getFecha());
        dto.setFechaVenta(envio.getFechaVenta());
        dto.setFechaLlegue(envio.getFechaLlegue());
        dto.setOrigen(envio.getOrigen());
        dto.setTracking(envio.getTracking());
        dto.setIdMvg(envio.getIdMvg());
        dto.setCliente(envio.getCliente());
        dto.setDireccion(envio.getDireccion());
        dto.setLocalidad(envio.getLocalidad());
        dto.setCodigoPostal(envio.getCodigoPostal());
        dto.setNombreDestinatario(envio.getNombreDestinatario());
        dto.setTelefono(envio.getTelefono());
        dto.setEmail(envio.getEmail());
        dto.setPeso(envio.getPeso());
        dto.setIdml(envio.getIdml());
        dto.setEstado(envio.getEstado());
        dto.setImpreso(envio.getImpreso());
        dto.setColectado(envio.getColectado());
        dto.setMetodoEnvio(envio.getMetodoEnvio());
        dto.setZonaEntrega(envio.getZonaEntrega());
        dto.setCostoEnvio(envio.getCostoEnvio());
        dto.setQrData(envio.getQrData());
        dto.setFechaUltimoMovimiento(envio.getFechaUltimoMovimiento());
        dto.setTrackingToken(envio.getTrackingToken());
        return dto;
    }
}

