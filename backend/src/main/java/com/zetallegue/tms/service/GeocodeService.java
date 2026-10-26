package com.zetallegue.tms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zetallegue.tms.util.ZonaEntregaUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Slf4j
public class GeocodeService {

    public static final class Resultado {
        public final double lat;
        public final double lng;
        public final String codigoPostal;
        public final String localidad;

        public Resultado(double lat, double lng, String codigoPostal, String localidad) {
            this.lat = lat;
            this.lng = lng;
            this.codigoPostal = codigoPostal;
            this.localidad = localidad;
        }
    }

    private static final String NOMINATIM = "https://nominatim.openstreetmap.org/search";
    private static final String USER_AGENT = "NexoTMS/1.0 (https://isnexo.net)";
    private static final long MIN_INTERVAL_MS = 1100;
    /** AMBA + cordón 3 (La Plata, Luján, Zárate). */
    private static final String AMBA_VIEWBOX = "-59.15,-34.05,-57.85,-35.05";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();
    private long lastCallAt = 0;

    public Optional<double[]> geocode(String direccion, String localidad, String codigoPostal) {
        return geocodeDetallado(direccion, localidad, codigoPostal, false)
                .map(r -> new double[]{r.lat, r.lng});
    }

    public Optional<Resultado> geocodeDetallado(String direccion, String localidad, String codigoPostal, boolean forzarAmba) {
        if (direccion == null || direccion.isBlank() || "Dirección pendiente".equalsIgnoreCase(direccion.trim())) {
            return Optional.empty();
        }
        if (forzarAmba) {
            return geocodeEnAmba(direccion);
        }
        String query = Stream.of(direccion, localidad, codigoPostal, "Argentina")
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .collect(Collectors.joining(", "));
        return nominatim(query, false).filter(this::estaEnAmba);
    }

    /**
     * Flex entrega solo en AMBA: ignora ciudad/CP que ML manda del interior
     * y busca la calle dentro de CABA/GBA.
     */
    public Optional<Resultado> geocodeEnAmba(String direccion) {
        String street = limpiarCalle(direccion);
        if (street.isBlank()) {
            return Optional.empty();
        }
        List<String> queries = new ArrayList<>();
        queries.add(street + ", Buenos Aires, Argentina");
        queries.add(street + ", CABA, Argentina");
        queries.add(street);
        for (String q : queries) {
            Optional<Resultado> bounded = nominatim(q, true);
            if (bounded.isPresent() && estaEnAmba(bounded.get())) {
                log.info("Flex AMBA '{}' → {} / {} ({}, {})", street,
                        bounded.get().localidad, bounded.get().codigoPostal,
                        bounded.get().lat, bounded.get().lng);
                return bounded;
            }
        }
        Optional<Resultado> biased = nominatim(street + ", Buenos Aires, Argentina", false);
        if (biased.isPresent() && estaEnAmba(biased.get())) {
            return biased;
        }
        log.warn("No se pudo geocodificar en AMBA: {}", street);
        return Optional.empty();
    }

    private Optional<Resultado> nominatim(String query, boolean bounded) {
        try {
            throttle();
            String url = NOMINATIM
                    + "?format=json&limit=1&countrycodes=ar&addressdetails=1"
                    + "&viewbox=" + URLEncoder.encode(AMBA_VIEWBOX, StandardCharsets.UTF_8)
                    + (bounded ? "&bounded=1" : "")
                    + "&q=" + URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(12))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .header("Accept-Language", "es")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Nominatim HTTP {} para '{}'", response.statusCode(), query);
                return Optional.empty();
            }
            JsonNode arr = objectMapper.readTree(response.body());
            if (!arr.isArray() || arr.isEmpty()) {
                return Optional.empty();
            }
            JsonNode first = arr.get(0);
            double lat = first.get("lat").asDouble();
            double lng = first.get("lon").asDouble();
            JsonNode address = first.path("address");
            String cp = ZonaEntregaUtil.limpiarCp(texto(address, "postcode"));
            String localidad = primerTexto(address, "suburb", "neighbourhood", "town", "city", "village");
            return Optional.of(new Resultado(lat, lng, cp, localidad));
        } catch (Exception e) {
            log.warn("Error geocodificando '{}': {}", query, e.getMessage());
            return Optional.empty();
        }
    }

    private boolean estaEnAmba(Resultado r) {
        if (r == null) return false;
        if (ZonaEntregaUtil.zonaAmba(r.codigoPostal) != null) return true;
        return r.lat <= -34.05 && r.lat >= -35.05 && r.lng >= -59.15 && r.lng <= -57.85;
    }

    private String limpiarCalle(String direccion) {
        String s = direccion == null ? "" : direccion.trim();
        s = s.replaceAll("(?i)\\bcalle\\s+", "");
        s = s.replaceAll("(?i)\\s+-?ruta\\s*\\d+-?", " ");
        s = s.replaceAll("(?i)\\s+km\\.?\\s*\\d+.*$", "");
        s = s.replaceAll("(?i)\\s+SN\\b", "");
        s = s.replaceAll("(?i)\\s+S/?N\\b", "");
        s = s.replaceAll("[-,]+", " ");
        s = s.replaceAll("\\s+", " ").trim();
        return s;
    }

    private String texto(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return "";
        return node.get(field).asText("");
    }

    private String primerTexto(JsonNode node, String... fields) {
        for (String f : fields) {
            String v = texto(node, f);
            if (!v.isBlank() && !v.toLowerCase().startsWith("partido de")) {
                return v;
            }
        }
        return "";
    }

    private synchronized void throttle() throws InterruptedException {
        long wait = MIN_INTERVAL_MS - (System.currentTimeMillis() - lastCallAt);
        if (wait > 0) {
            Thread.sleep(wait);
        }
        lastCallAt = System.currentTimeMillis();
    }
}
