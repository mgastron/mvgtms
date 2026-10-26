package com.zetallegue.tms.service;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.model.HistorialEnvio;
import com.zetallegue.tms.model.ImagenEnvio;
import com.zetallegue.tms.repository.EnvioRepository;
import com.zetallegue.tms.repository.HistorialEnvioRepository;
import com.zetallegue.tms.repository.ImagenEnvioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Genera PDF de prueba de entrega / constancia de intento (PoD) con estilo Nexo.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PodPdfService {

    private static final Set<String> ESTADOS_POD = Set.of(
            "Entregado",
            "Nadie",
            "Rechazado por el comprador"
    );

    private static final Color COLOR_NEXO = new Color(21, 112, 239);
    private static final Color COLOR_NEXO_DARK = new Color(20, 89, 233);
    private static final Color COLOR_OK = new Color(22, 163, 74);
    private static final Color COLOR_WARN = new Color(234, 88, 12);
    private static final Color COLOR_BAD = new Color(220, 38, 38);
    private static final Color COLOR_CARD = Color.WHITE;
    private static final Color COLOR_BORDER = new Color(230, 234, 244);
    private static final Color COLOR_TEXT = new Color(31, 36, 51);
    private static final Color COLOR_MUTED = new Color(107, 114, 137);
    private static final Color COLOR_LABEL = new Color(77, 85, 113);

    private static final DateTimeFormatter FMT_FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter FMT_FULL = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final EnvioRepository envioRepository;
    private final HistorialEnvioRepository historialEnvioRepository;
    private final ImagenEnvioRepository imagenEnvioRepository;

    /** Opcional. Si está vacío se usa un mapa estático OpenStreetMap. */
    @Value("${google.maps.api-key:}")
    private String googleMapsApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    public record PodPdfResult(byte[] contenido, String nombreArchivo) {}

    @Transactional(readOnly = true)
    public PodPdfResult generar(Long envioId, Long historialId) throws DocumentException {
        Envio envio = envioRepository.findById(envioId)
                .orElseThrow(() -> new IllegalArgumentException("Envío no encontrado"));

        List<HistorialEnvio> historial = historialEnvioRepository.findByEnvioIdOrderByFechaDesc(envioId);
        HistorialEnvio evento = resolverEvento(historial, historialId, envio);
        if (evento == null || !ESTADOS_POD.contains(evento.getEstado())) {
            throw new IllegalArgumentException(
                    "No hay un evento de Entregado, Nadie o Rechazado para generar el PoD");
        }

        String estado = evento.getEstado();
        String titulo = tituloParaEstado(estado);
        String slug = slugEstado(estado);
        String tracking = envio.getTracking() != null ? envio.getTracking() : String.valueOf(envio.getId());
        String filename = "pod-" + slug + "-" + tracking + "-" +
                (evento.getFecha() != null ? evento.getFecha().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm")) : "evento")
                + ".pdf";

        List<ImagenEnvio> imagenes = imagenEnvioRepository.findByEnvioIdOrderByFechaDesc(envioId);
        ImagenEnvio foto = elegirFoto(imagenes, evento);

        Document doc = new Document(PageSize.A4, 36, 36, 36, 40);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter.getInstance(doc, out);
        doc.open();

        com.lowagie.text.Font fontMarca = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.WHITE);
        com.lowagie.text.Font fontTag = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(224, 231, 255));
        com.lowagie.text.Font fontH1 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, COLOR_TEXT);
        com.lowagie.text.Font fontSection = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, COLOR_NEXO_DARK);
        com.lowagie.text.Font fontLabel = FontFactory.getFont(FontFactory.HELVETICA, 8, COLOR_LABEL);
        com.lowagie.text.Font fontValue = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, COLOR_TEXT);
        com.lowagie.text.Font fontNormal = FontFactory.getFont(FontFactory.HELVETICA, 9, COLOR_TEXT);
        com.lowagie.text.Font fontMuted = FontFactory.getFont(FontFactory.HELVETICA, 8, COLOR_MUTED);
        com.lowagie.text.Font fontBadge = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);

        // Header marca
        PdfPTable header = new PdfPTable(1);
        header.setWidthPercentage(100);
        PdfPCell headerCell = new PdfPCell();
        headerCell.setBackgroundColor(COLOR_NEXO);
        headerCell.setBorder(Rectangle.NO_BORDER);
        headerCell.setPadding(14);
        Paragraph marca = new Paragraph("NEXO", fontMarca);
        marca.add(Chunk.NEWLINE);
        marca.add(new Phrase("Prueba de entrega · Evidencia operativa", fontTag));
        headerCell.addElement(marca);
        header.addCell(headerCell);
        doc.add(header);

        PdfPTable accent = new PdfPTable(1);
        accent.setWidthPercentage(100);
        accent.setSpacingAfter(14);
        PdfPCell accentCell = new PdfPCell();
        accentCell.setBackgroundColor(new Color(59, 130, 246));
        accentCell.setBorder(Rectangle.NO_BORDER);
        accentCell.setFixedHeight(3);
        accent.addCell(accentCell);
        doc.add(accent);

        // Título + badge
        PdfPTable titleRow = new PdfPTable(new float[]{3.2f, 1.4f});
        titleRow.setWidthPercentage(100);
        titleRow.setSpacingAfter(8);
        PdfPCell titleCell = new PdfPCell();
        titleCell.setBorder(Rectangle.NO_BORDER);
        titleCell.addElement(new Paragraph(titulo, fontH1));
        titleCell.addElement(new Paragraph(
                "Envío #" + nz(envio.getTracking()) +
                        (envio.getIdMvg() != null && !envio.getIdMvg().isBlank() ? "  ·  ID " + envio.getIdMvg() : ""),
                fontMuted));
        titleRow.addCell(titleCell);

        PdfPCell badgeCell = new PdfPCell(new Phrase(estadoCorto(estado), fontBadge));
        badgeCell.setBackgroundColor(colorEstado(estado));
        badgeCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        badgeCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        badgeCell.setPadding(8);
        badgeCell.setBorder(Rectangle.NO_BORDER);
        titleRow.addCell(badgeCell);
        doc.add(titleRow);

        // Card: datos del pedido
        doc.add(sectionCard("Datos del pedido", fontSection, () -> {
            PdfPTable grid = twoCol(fontLabel, fontValue,
                    "Cliente", nz(envio.getCliente()),
                    "Destinatario", nz(envio.getNombreDestinatario()),
                    "Teléfono", nz(envio.getTelefono()),
                    "Dirección", nz(envio.getDireccion()),
                    "CP / Localidad", trimJoin(envio.getCodigoPostal(), envio.getLocalidad()),
                    "Zona", nz(envio.getZonaEntrega()),
                    "Chofer", nz(envio.getChoferAdjudicadoNombre()),
                    "Origen canal", origenCanal(envio.getOrigen())
            );
            return grid;
        }));

        // Card: evento
        LocalDateTime fechaEvt = evento.getFecha() != null ? evento.getFecha() : LocalDateTime.now();
        String ubicacionTxt = resolverUbicacion(evento, envio, estado);
        double[] coords = resolverCoords(evento, envio, estado);
        doc.add(sectionCard("Registro del evento", fontSection, () -> twoCol(fontLabel, fontValue,
                "Fecha", fechaEvt.format(FMT_FECHA),
                "Hora", fechaEvt.format(FMT_HORA),
                "Marcado por", nz(evento.getQuien()),
                "Origen", origenAppWeb(evento.getOrigen()),
                "Ubicación al marcar", ubicacionTxt,
                "Coordenadas", coords != null
                        ? String.format(Locale.ROOT, "%.5f, %.5f", coords[0], coords[1])
                        : "—"
        )));

        // Mapa estático debajo de la ubicación
        if (coords != null) {
            try {
                Image mapImg = fetchStaticMap(coords[0], coords[1]);
                if (mapImg != null) {
                    mapImg.scaleToFit(480f, 240f);
                    mapImg.setAlignment(Element.ALIGN_CENTER);
                    PdfPTable mapCard = new PdfPTable(1);
                    mapCard.setWidthPercentage(100);
                    mapCard.setSpacingAfter(10);
                    PdfPCell shell = new PdfPCell();
                    shell.setBorderColor(COLOR_BORDER);
                    shell.setBorderWidth(1f);
                    shell.setBackgroundColor(COLOR_CARD);
                    shell.setPadding(12);
                    shell.addElement(new Paragraph("Mapa de ubicación al marcar", fontSection));
                    shell.addElement(Chunk.NEWLINE);
                    shell.addElement(mapImg);
                    Paragraph cap = new Paragraph(
                            String.format(Locale.ROOT, "Pin en %.5f, %.5f", coords[0], coords[1]),
                            fontMuted);
                    cap.setSpacingBefore(6);
                    shell.addElement(cap);
                    mapCard.addCell(shell);
                    doc.add(mapCard);
                }
            } catch (Exception e) {
                log.warn("No se pudo incrustar mapa en PoD envio {}: {}", envioId, e.getMessage());
            }
        }

        // Receptor solo entregado
        if ("Entregado".equals(estado)) {
            doc.add(sectionCard("Recepción", fontSection, () -> twoCol(fontLabel, fontValue,
                    "Rol", nz(envio.getRolRecibio()),
                    "Nombre quien recibió", nz(envio.getNombreRecibio()),
                    "DNI", nz(envio.getDniRecibio()),
                    "Ubicación al entregar",
                    firstNonBlank(envio.getDireccionEntrega(), ubicacionTxt)
            )));
        }

        // Motivo / observaciones (ignorar basura legacy "Foto adjunta: data:image...")
        final String obsRaw = evento.getObservaciones();
        final String obs = (obsRaw != null && !obsRaw.isBlank() && !esObservacionFotoBasura(obsRaw))
                ? obsRaw.trim()
                : null;
        doc.add(sectionCard(
                "Entregado".equals(estado) ? "Notas" : "Motivo / observaciones",
                fontSection,
                () -> {
                    PdfPTable t = new PdfPTable(1);
                    t.setWidthPercentage(100);
                    Paragraph p = new Paragraph(
                            obs != null ? obs : "Sin observaciones registradas.",
                            fontNormal);
                    PdfPCell c = new PdfPCell();
                    c.setBorder(Rectangle.NO_BORDER);
                    c.setPadding(0);
                    c.addElement(p);
                    t.addCell(c);
                    return t;
                }
        ));

        // Foto
        if (foto != null && foto.getUrlImagen() != null && !foto.getUrlImagen().isBlank()) {
            try {
                Image img = decodeImage(foto.getUrlImagen());
                if (img != null) {
                    float maxW = 420f;
                    float maxH = 280f;
                    img.scaleToFit(maxW, maxH);
                    img.setAlignment(Element.ALIGN_CENTER);

                    PdfPTable photoCard = new PdfPTable(1);
                    photoCard.setWidthPercentage(100);
                    photoCard.setSpacingAfter(12);
                    PdfPCell shell = new PdfPCell();
                    shell.setBorderColor(COLOR_BORDER);
                    shell.setBorderWidth(1f);
                    shell.setBackgroundColor(COLOR_CARD);
                    shell.setPadding(12);
                    shell.addElement(new Paragraph("Evidencia fotográfica", fontSection));
                    shell.addElement(Chunk.NEWLINE);
                    shell.addElement(img);
                    Paragraph cap = new Paragraph(
                            "Tomada el " + (foto.getFecha() != null ? foto.getFecha().format(FMT_FULL) : "—")
                                    + (foto.getQuien() != null ? " · " + foto.getQuien() : ""),
                            fontMuted);
                    cap.setSpacingBefore(6);
                    shell.addElement(cap);
                    photoCard.addCell(shell);
                    doc.add(photoCard);
                }
            } catch (Exception e) {
                log.warn("No se pudo incrustar foto en PoD envio {}: {}", envioId, e.getMessage());
            }
        }

        // Footer
        Paragraph foot = new Paragraph(
                "Documento generado por NEXO · " + LocalDateTime.now().format(FMT_FULL)
                        + " · Evidencia del envío " + tracking,
                fontMuted);
        foot.setSpacingBefore(8);
        doc.add(foot);

        doc.close();
        return new PodPdfResult(out.toByteArray(), filename);
    }

    private HistorialEnvio resolverEvento(List<HistorialEnvio> historial, Long historialId, Envio envio) {
        if (historialId != null) {
            return historial.stream()
                    .filter(h -> historialId.equals(h.getId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Evento de historial no encontrado"));
        }
        // Preferir Entregado si el envío está entregado
        if ("Entregado".equals(envio.getEstado())) {
            return historial.stream()
                    .filter(h -> "Entregado".equals(h.getEstado()))
                    .findFirst()
                    .orElse(null);
        }
        return historial.stream()
                .filter(h -> ESTADOS_POD.contains(h.getEstado()))
                .findFirst()
                .orElse(null);
    }

    private ImagenEnvio elegirFoto(List<ImagenEnvio> imagenes, HistorialEnvio evento) {
        if (imagenes == null || imagenes.isEmpty()) return null;
        if ("Nadie".equals(evento.getEstado())) {
            return imagenes.stream()
                    .filter(i -> "nadie_en_domicilio".equalsIgnoreCase(i.getTipo())
                            || i.getTipo() == null
                            || i.getTipo().isBlank())
                    .min(Comparator.comparingLong(i ->
                            Math.abs(java.time.Duration.between(
                                    i.getFecha() != null ? i.getFecha() : LocalDateTime.MIN,
                                    evento.getFecha() != null ? evento.getFecha() : LocalDateTime.MIN
                            ).toMinutes())))
                    .orElse(imagenes.get(0));
        }
        // Entregado / Rechazado: primera imagen del envío si hay
        return imagenes.isEmpty() ? null : imagenes.get(0);
    }

    private String resolverUbicacion(HistorialEnvio evento, Envio envio, String estado) {
        if (evento.getUbicacionDireccion() != null && !evento.getUbicacionDireccion().isBlank()) {
            return evento.getUbicacionDireccion().trim();
        }
        if ("Entregado".equals(estado) && envio.getDireccionEntrega() != null && !envio.getDireccionEntrega().isBlank()) {
            return envio.getDireccionEntrega().trim();
        }
        double[] c = resolverCoords(evento, envio, estado);
        if (c != null) {
            return String.format(Locale.ROOT, "%.5f, %.5f", c[0], c[1]);
        }
        return "—";
    }

    private double[] resolverCoords(HistorialEnvio evento, Envio envio, String estado) {
        Double lat = evento.getLatitud();
        Double lng = evento.getLongitud();
        if ((lat == null || lng == null) && "Entregado".equals(estado)) {
            lat = envio.getLatEntrega();
            lng = envio.getLngEntrega();
        }
        if (lat == null || lng == null) return null;
        return new double[]{lat, lng};
    }

    private Image fetchStaticMap(double lat, double lng) throws Exception {
        java.util.List<String> urls = new java.util.ArrayList<>();
        if (googleMapsApiKey != null && !googleMapsApiKey.isBlank()
                && !"YOUR_API_KEY".equals(googleMapsApiKey)
                && !googleMapsApiKey.startsWith("your-")) {
            String marker = URLEncoder.encode("color:0x1570EF|label:N|" + lat + "," + lng, StandardCharsets.UTF_8);
            urls.add("https://maps.googleapis.com/maps/api/staticmap"
                    + "?center=" + lat + "," + lng
                    + "&zoom=16&size=640x320&scale=2&maptype=roadmap"
                    + "&markers=" + marker
                    + "&key=" + URLEncoder.encode(googleMapsApiKey.trim(), StandardCharsets.UTF_8));
        }
        // Fallback sin key (Yandex usa longitud,latitud)
        urls.add("https://static-maps.yandex.ru/1.x/?lang=es_ES"
                + "&ll=" + lng + "," + lat
                + "&z=16&l=map&size=650,350"
                + "&pt=" + lng + "," + lat + ",pm2blm");

        Exception last = null;
        for (String url : urls) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(12))
                        .header("User-Agent", "NexoTMS-PoD/1.0")
                        .GET()
                        .build();
                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    log.warn("Static map HTTP {} para {}", response.statusCode(),
                            url.replaceAll("key=[^&]+", "key=***"));
                    continue;
                }
                byte[] bytes = response.body();
                if (bytes == null || bytes.length < 500) continue;
                String head = new String(bytes, 0, Math.min(32, bytes.length), StandardCharsets.UTF_8);
                if (head.startsWith("{") || head.startsWith("<") || head.toLowerCase(Locale.ROOT).contains("error")) {
                    continue;
                }
                return Image.getInstance(bytes);
            } catch (Exception e) {
                last = e;
                log.warn("Fallo fetch mapa: {}", e.getMessage());
            }
        }
        if (last != null) throw last;
        return null;
    }

    private Image decodeImage(String raw) throws Exception {
        String data = raw.trim();
        if (data.startsWith("data:")) {
            int comma = data.indexOf(',');
            if (comma < 0) return null;
            data = data.substring(comma + 1);
        }
        // Algunas fotos llegan con espacios/newlines en el base64
        data = data.replaceAll("\\s", "");
        byte[] bytes = Base64.getDecoder().decode(data);
        if (bytes.length == 0) return null;
        return Image.getInstance(bytes);
    }

    private interface TableSupplier {
        PdfPTable get() throws DocumentException;
    }

    private PdfPTable sectionCard(String title, com.lowagie.text.Font fontSection, TableSupplier body)
            throws DocumentException {
        PdfPTable card = new PdfPTable(1);
        card.setWidthPercentage(100);
        card.setSpacingAfter(10);

        PdfPCell shell = new PdfPCell();
        shell.setBorderColor(COLOR_BORDER);
        shell.setBorderWidth(1f);
        shell.setBackgroundColor(COLOR_CARD);
        shell.setPadding(12);

        shell.addElement(new Paragraph(title, fontSection));
        shell.addElement(Chunk.NEWLINE);
        PdfPTable content = body.get();
        content.setWidthPercentage(100);
        shell.addElement(content);
        card.addCell(shell);
        return card;
    }

    private PdfPTable twoCol(com.lowagie.text.Font fontLabel, com.lowagie.text.Font fontValue, String... pairs) {
        PdfPTable grid = new PdfPTable(new float[]{1f, 1f});
        grid.setWidthPercentage(100);
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            grid.addCell(fieldCell(pairs[i], pairs[i + 1], fontLabel, fontValue));
        }
        if (pairs.length % 2 != 0) {
            // shouldn't happen
        }
        // If odd number of fields, last row incomplete — pad
        int fields = pairs.length / 2;
        if (fields % 2 != 0) {
            PdfPCell pad = new PdfPCell();
            pad.setBorder(Rectangle.NO_BORDER);
            grid.addCell(pad);
        }
        return grid;
    }

    private PdfPCell fieldCell(String label, String value, com.lowagie.text.Font fontLabel, com.lowagie.text.Font fontValue) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setPadding(4);
        c.setPaddingBottom(8);
        Paragraph p = new Paragraph(label.toUpperCase(Locale.ROOT), fontLabel);
        p.add(Chunk.NEWLINE);
        p.add(new Phrase(value != null && !value.isBlank() ? value : "—", fontValue));
        c.addElement(p);
        return c;
    }

    private boolean esObservacionFotoBasura(String obs) {
        String t = obs.trim().toLowerCase(Locale.ROOT);
        return t.startsWith("foto adjunta:")
                || t.startsWith("sin foto adjunta")
                || t.contains("data:image/");
    }

    private String tituloParaEstado(String estado) {
        return switch (estado) {
            case "Entregado" -> "Prueba de entrega";
            case "Nadie" -> "Constancia de intento — Nadie en domicilio";
            case "Rechazado por el comprador" -> "Constancia de intento — Rechazo";
            default -> "Evidencia operativa";
        };
    }

    private String slugEstado(String estado) {
        return switch (estado) {
            case "Entregado" -> "entregado";
            case "Nadie" -> "nadie";
            case "Rechazado por el comprador" -> "rechazado";
            default -> "pod";
        };
    }

    private String estadoCorto(String estado) {
        if ("Rechazado por el comprador".equals(estado)) return "Rechazado";
        return estado;
    }

    private Color colorEstado(String estado) {
        return switch (estado) {
            case "Entregado" -> COLOR_OK;
            case "Nadie" -> COLOR_WARN;
            case "Rechazado por el comprador" -> COLOR_BAD;
            default -> COLOR_NEXO;
        };
    }

    private String origenAppWeb(String origen) {
        if (origen == null || origen.isBlank()) return "—";
        if ("APP".equalsIgnoreCase(origen)) return "App móvil";
        if ("WEB".equalsIgnoreCase(origen)) return "Web";
        return origen;
    }

    private String origenCanal(String origen) {
        if (origen == null || origen.isBlank()) return "Directo";
        if ("Flex".equals(origen)) return "Mercado Libre";
        return origen;
    }

    private String nz(String s) {
        return s == null || s.isBlank() ? "—" : s.trim();
    }

    private String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a.trim();
        if (b != null && !b.isBlank()) return b.trim();
        return "—";
    }

    private String trimJoin(String a, String b) {
        String left = a != null ? a.trim() : "";
        String right = b != null ? b.trim() : "";
        if (left.isEmpty() && right.isEmpty()) return "—";
        if (left.isEmpty()) return right;
        if (right.isEmpty()) return left;
        return left + " · " + right;
    }
}
