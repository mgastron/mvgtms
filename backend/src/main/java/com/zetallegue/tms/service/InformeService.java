package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.InformeRequestDTO;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.model.Grupo;
import com.zetallegue.tms.repository.ClienteRepository;
import com.zetallegue.tms.repository.EnvioRepository;
import com.zetallegue.tms.repository.GrupoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class InformeService {

    public static final String TIPO_GRUPOS = "GRUPOS";
    public static final String TIPO_CUENTAS = "CUENTAS";
    public static final String TIPO_TODOS_GRUPOS = "TODOS_GRUPOS";
    public static final String TIPO_TODAS_CUENTAS = "TODAS_CUENTAS";
    public static final String FORMATO_EXCEL = "EXCEL";
    public static final String FORMATO_PDF = "PDF";
    public static final String TOMAR_SOLO_ENTREGADOS = "SOLO_ENTREGADOS";
    public static final String TOMAR_RETIRADOS_EXCEPTO = "RETIRADOS_EXCEPTO_RECHAZADOS_CANCELADOS";
    private static final String ESTADO_ENTREGADO = "Entregado";
    private static final String ESTADO_RECHAZADO = "Rechazado por el comprador";
    private static final String ESTADO_CANCELADO = "Cancelado";
    private static final DateTimeFormatter FMT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_DATETIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final EnvioRepository envioRepository;
    private final ClienteRepository clienteRepository;
    private final GrupoRepository grupoRepository;

    /**
     * Genera el informe según la solicitud. Retorna archivo único (Excel o PDF) o ZIP con varios archivos + resumen.
     */
    @Transactional(readOnly = true)
    public byte[] generarInforme(InformeRequestDTO req) throws IOException, DocumentException {
        if (req.getFechaDesde() == null || req.getFechaHasta() == null) {
            throw new IllegalArgumentException("fechaDesde y fechaHasta son obligatorios");
        }
        if (req.getFechaDesde().isAfter(req.getFechaHasta())) {
            throw new IllegalArgumentException("fechaDesde no puede ser posterior a fechaHasta");
        }

        LocalDateTime desde = req.getFechaDesde().atStartOfDay();
        LocalDateTime hasta = req.getFechaHasta().atTime(23, 59, 59, 999_000_000);
        List<Envio> todosColectados = envioRepository.findEnviosColectadosEntreFechas(desde, hasta);

        log.info("[Informe] Fechas desde={} hasta={}; envíos colectados en rango: {}", desde, hasta, todosColectados.size());
        if (!todosColectados.isEmpty()) {
            for (int i = 0; i < Math.min(5, todosColectados.size()); i++) {
                Envio e = todosColectados.get(i);
                log.info("[Informe] Muestra envío id={} cliente='{}' fechaColecta={} estado={}",
                        e.getId(), e.getCliente(), e.getFechaColecta(), e.getEstado());
            }
        }

        List<Target> targets = resolveTargets(req);
        if (targets.isEmpty()) {
            throw new IllegalArgumentException("No hay destinatarios seleccionados");
        }
        log.info("[Informe] Targets resueltos: {}", targets.size());
        for (int i = 0; i < targets.size(); i++) {
            Target t = targets.get(i);
            log.info("[Informe] Target[{}] nombre='{}' codigos={}", i, t.nombre, t.codigos);
        }

        String formato = req.getFormato() != null ? req.getFormato().toUpperCase(Locale.ROOT) : FORMATO_EXCEL;
        String tomarEnvios = req.getTomarEnvios() != null ? req.getTomarEnvios().toUpperCase(Locale.ROOT) : TOMAR_RETIRADOS_EXCEPTO;
        boolean esExcel = FORMATO_EXCEL.equals(formato);

        List<ReportFile> reportes = new ArrayList<>();
        List<ResumenFila> resumenFilas = new ArrayList<>();

        for (Target target : targets) {
            List<Envio> envios = filtrarEnviosParaTarget(todosColectados, target, tomarEnvios);
            log.info("[Informe] Target '{}' codigos={} -> envíos filtrados: {}", target.nombre, target.codigos, envios.size());
            ResumenData resumen = buildResumen(envios);
            String nombreSeguro = sanitizeFileName(target.nombre) + (esExcel ? ".xlsx" : ".pdf");
            byte[] contenido = esExcel
                    ? generarExcel(envios, resumen, target.nombre, req.getFechaDesde(), req.getFechaHasta())
                    : generarPdf(envios, resumen, target.nombre, req.getFechaDesde(), req.getFechaHasta());
            reportes.add(new ReportFile(nombreSeguro, contenido));
            resumenFilas.add(new ResumenFila(target.nombre, envios.size(), resumen.precioTotal));
        }

        if (reportes.size() == 1) {
            return reportes.get(0).contenido;
        }

        ByteArrayOutputStream zipOut = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(zipOut)) {
            for (ReportFile rf : reportes) {
                zos.putNextEntry(new ZipEntry(rf.nombre));
                zos.write(rf.contenido);
                zos.closeEntry();
            }
            byte[] resumenExcel = generarExcelResumen(resumenFilas, req.getFechaDesde(), req.getFechaHasta());
            zos.putNextEntry(new ZipEntry("resumen.xlsx"));
            zos.write(resumenExcel);
            zos.closeEntry();
        }
        return zipOut.toByteArray();
    }

    private List<Target> resolveTargets(InformeRequestDTO req) {
        String tipo = req.getTipoDestinatario() != null ? req.getTipoDestinatario().toUpperCase(Locale.ROOT) : "";
        List<Target> out = new ArrayList<>();

        switch (tipo) {
            case TIPO_GRUPOS:
                if (req.getIdsGrupos() != null) {
                    for (Long gid : req.getIdsGrupos()) {
                        Grupo g = grupoRepository.findById(gid).orElse(null);
                        if (g == null) continue;
                        List<Cliente> clientes = clienteRepository.findByGrupoId(gid);
                        Set<String> codigos = new java.util.HashSet<>();
                        Set<String> textosCliente = new java.util.HashSet<>();
                        for (Cliente c : clientes) {
                            if (c.getCodigo() != null) codigos.add(c.getCodigo().trim());
                            String nom = (c.getCodigo() != null ? c.getCodigo() : "") + (c.getNombreFantasia() != null ? " - " + c.getNombreFantasia() : "");
                            if (!nom.trim().isEmpty()) textosCliente.add(nom.trim());
                            if (c.getNombreFantasia() != null && !c.getNombreFantasia().trim().isEmpty()) textosCliente.add(c.getNombreFantasia().trim());
                        }
                        out.add(new Target(g.getNombre(), codigos, textosCliente));
                    }
                }
                break;
            case TIPO_CUENTAS:
                if (req.getIdsCuentas() != null) {
                    for (Long cid : req.getIdsCuentas()) {
                        Cliente c = clienteRepository.findById(cid).orElse(null);
                        if (c == null) continue;
                        String nombre = (c.getCodigo() != null ? c.getCodigo() : "") + (c.getNombreFantasia() != null ? " - " + c.getNombreFantasia() : "");
                        Set<String> textos = new java.util.HashSet<>();
                        textos.add(nombre.trim());
                        if (c.getCodigo() != null) textos.add(c.getCodigo().trim());
                        if (c.getNombreFantasia() != null) textos.add(c.getNombreFantasia().trim());
                        out.add(new Target(nombre, Set.of(c.getCodigo()), textos));
                    }
                }
                break;
            case TIPO_TODOS_GRUPOS:
                for (Grupo g : grupoRepository.findAll()) {
                    List<Cliente> clientes = clienteRepository.findByGrupoId(g.getId());
                    Set<String> codigos = new java.util.HashSet<>();
                    Set<String> textosCliente = new java.util.HashSet<>();
                    for (Cliente c : clientes) {
                        if (c.getCodigo() != null) codigos.add(c.getCodigo().trim());
                        String nom = (c.getCodigo() != null ? c.getCodigo() : "") + (c.getNombreFantasia() != null ? " - " + c.getNombreFantasia() : "");
                        if (!nom.trim().isEmpty()) textosCliente.add(nom.trim());
                        if (c.getNombreFantasia() != null && !c.getNombreFantasia().trim().isEmpty()) textosCliente.add(c.getNombreFantasia().trim());
                    }
                    out.add(new Target(g.getNombre(), codigos, textosCliente));
                }
                break;
            case TIPO_TODAS_CUENTAS:
                for (Cliente c : clienteRepository.findAll()) {
                    if (c.getCodigo() == null) continue;
                    String nombre = c.getCodigo() + (c.getNombreFantasia() != null ? " - " + c.getNombreFantasia() : "");
                    Set<String> textos = new java.util.HashSet<>();
                    textos.add(nombre.trim());
                    textos.add(c.getCodigo().trim());
                    if (c.getNombreFantasia() != null) textos.add(c.getNombreFantasia().trim());
                    out.add(new Target(nombre, Set.of(c.getCodigo()), textos));
                }
                break;
            default:
                break;
        }
        return out;
    }

    private List<Envio> filtrarEnviosParaTarget(List<Envio> envios, Target target, String tomarEnvios) {
        List<Envio> list = envios.stream()
                .filter(e -> perteneceATarget(e.getCliente(), target))
                .collect(Collectors.toList());

        if (TOMAR_SOLO_ENTREGADOS.equals(tomarEnvios)) {
            list = list.stream().filter(e -> ESTADO_ENTREGADO.equals(e.getEstado())).collect(Collectors.toList());
        } else {
            list = list.stream()
                    .filter(e -> !ESTADO_RECHAZADO.equals(e.getEstado()) && !ESTADO_CANCELADO.equals(e.getEstado()))
                    .collect(Collectors.toList());
        }
        return list;
    }

    /**
     * Determina si el string cliente de un envío corresponde al target.
     * Coincide si: (1) el código extraído del envío está en target.codigos, o
     * (2) envio.cliente (trim, ignore case) coincide con alguna variante en target.textosCliente
     * ("codigo - nombreFantasia", "nombreFantasia" solo, o codigo). Así se cubre cuando en BD
     * el envío tiene cliente = "PRODUCCION PRUEBA" y el target es PROD / "PROD - PRODUCCION PRUEBA".
     */
    private boolean perteneceATarget(String clienteStr, Target target) {
        if (clienteStr == null) return false;
        String c = clienteStr.trim();
        if (c.isEmpty()) return false;
        if (target.textosCliente() != null) {
            for (String t : target.textosCliente()) {
                if (t != null && c.equalsIgnoreCase(t.trim())) return true;
            }
        }
        if (target.codigos() == null) return false;
        String codigoEnEnvio = c.contains(" - ") ? c.split(" - ", 2)[0].trim() : c;
        if (codigoEnEnvio.isEmpty()) codigoEnEnvio = c;
        for (String codigo : target.codigos()) {
            if (codigo == null) continue;
            String cod = codigo.trim();
            if (cod.isEmpty()) continue;
            if (codigoEnEnvio.equalsIgnoreCase(cod)) return true;
            if (c.equalsIgnoreCase(cod)) return true;
            String sepGuion = cod + " - ";
            if (c.length() >= sepGuion.length() && c.regionMatches(true, 0, sepGuion, 0, sepGuion.length())) return true;
            String sepSpace = cod + " ";
            if (c.length() >= sepSpace.length() && c.regionMatches(true, 0, sepSpace, 0, sepSpace.length())) return true;
            String sepMinus = cod + "-";
            if (c.length() >= sepMinus.length() && c.regionMatches(true, 0, sepMinus, 0, sepMinus.length())) return true;
        }
        return false;
    }

    /** Fecha de colecta efectiva: fechaColecta si existe, si no fechaUltimoMovimiento (envíos retirados sin fecha guardada). */
    private static LocalDateTime fechaColectaEfectiva(Envio e) {
        return e.getFechaColecta() != null ? e.getFechaColecta() : e.getFechaUltimoMovimiento();
    }

    private ResumenData buildResumen(List<Envio> envios) {
        double precioTotal = 0;
        double efectivo = 0;
        Map<LocalDate, Map<String, ZonaDia>> porDiaZona = new LinkedHashMap<>();

        for (Envio e : envios) {
            double costo = parseDouble(e.getCostoEnvio(), 0);
            precioTotal += costo;
            if (e.getTotalACobrar() != null && !e.getTotalACobrar().trim().isEmpty()) {
                efectivo += parseDouble(e.getTotalACobrar(), 0);
            }
            LocalDateTime fec = fechaColectaEfectiva(e);
            LocalDate dia = fec != null ? fec.toLocalDate() : null;
            if (dia == null) continue;
            String zona = e.getZonaEntrega() != null ? e.getZonaEntrega().trim() : "(sin zona)";
            porDiaZona.computeIfAbsent(dia, k -> new LinkedHashMap<>())
                    .computeIfAbsent(zona, k -> new ZonaDia(zona, 0, 0))
                    .sumar(1, costo);
        }

        return new ResumenData(porDiaZona, envios.size(), precioTotal, efectivo);
    }

    private static double parseDouble(String s, double def) {
        if (s == null || s.trim().isEmpty()) return def;
        try {
            return Double.parseDouble(s.trim().replace(",", "."));
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private byte[] generarExcel(List<Envio> envios, ResumenData resumen, String nombreDestinatario,
                               LocalDate fechaDesde, LocalDate fechaHasta) throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet detalle = wb.createSheet("Detalle");
            Sheet hojaResumen = wb.createSheet("Resumen");
            CellStyle headerStyle = createHeaderStyle(wb);
            int rowNum = 0;

            // Título
            Row titulo = detalle.createRow(rowNum++);
            titulo.createCell(0).setCellValue("Informe de pedidos colectados - " + nombreDestinatario);
            rowNum++;
            Row subtitulo = detalle.createRow(rowNum++);
            subtitulo.createCell(0).setCellValue("Colectados desde " + fechaDesde.format(FMT_DATE) + " hasta " + fechaHasta.format(FMT_DATE));
            rowNum++;

            // Headers detalle
            String[] headers = {"Tracking", "Cliente", "Fecha colecta", "Estado", "Zona", "Destinatario", "Dirección", "Costo envío", "Total a cobrar"};
            Row headerRow = detalle.createRow(rowNum++);
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }
            if (envios.isEmpty()) {
                Row msgRow = detalle.createRow(rowNum++);
                msgRow.createCell(0).setCellValue("No hay envíos en el período para este destinatario.");
            }
            for (Envio e : envios) {
                Row r = detalle.createRow(rowNum++);
                r.createCell(0).setCellValue(e.getTracking() != null ? e.getTracking() : "");
                r.createCell(1).setCellValue(e.getCliente() != null ? e.getCliente() : "");
                r.createCell(2).setCellValue(fechaColectaEfectiva(e) != null ? fechaColectaEfectiva(e).format(FMT_DATETIME) : "");
                r.createCell(3).setCellValue(e.getEstado() != null ? e.getEstado() : "");
                r.createCell(4).setCellValue(e.getZonaEntrega() != null ? e.getZonaEntrega() : "");
                r.createCell(5).setCellValue(e.getNombreDestinatario() != null ? e.getNombreDestinatario() : "");
                r.createCell(6).setCellValue(e.getDireccion() != null ? e.getDireccion() : "");
                r.createCell(7).setCellValue(e.getCostoEnvio() != null ? e.getCostoEnvio() : "");
                r.createCell(8).setCellValue(e.getTotalACobrar() != null ? e.getTotalACobrar() : "");
            }
            rowNum++;
            Row totalRow = detalle.createRow(rowNum++);
            totalRow.createCell(0).setCellValue("Total envíos: " + envios.size());
            totalRow.createCell(7).setCellValue("Precio total: " + String.format("%.2f", resumen.precioTotal));
            totalRow.createCell(8).setCellValue("Plata retirada en efectivo: " + String.format("%.2f", resumen.efectivo));

            // Hoja Resumen
            int rResumen = 0;
            crearCelda(hojaResumen.createRow(rResumen++), 0, "RESUMEN - " + nombreDestinatario);
            crearCelda(hojaResumen.createRow(rResumen++), 0, "Pedidos colectados desde " + fechaDesde.format(FMT_DATE) + " hasta " + fechaHasta.format(FMT_DATE));
            rResumen++;
            crearCelda(hojaResumen.createRow(rResumen++), 0, "Total envíos");
            crearCelda(hojaResumen.createRow(rResumen - 1), 1, String.valueOf(resumen.cantidadEnvios));
            crearCelda(hojaResumen.createRow(rResumen++), 0, "Precio total");
            crearCelda(hojaResumen.createRow(rResumen - 1), 1, String.format("%.2f", resumen.precioTotal));
            crearCelda(hojaResumen.createRow(rResumen++), 0, "Plata retirada en efectivo");
            crearCelda(hojaResumen.createRow(rResumen - 1), 1, String.format("%.2f", resumen.efectivo));
            rResumen++;
            crearCelda(hojaResumen.createRow(rResumen++), 0, "Por día y zona");
            Row hRow = hojaResumen.createRow(rResumen++);
            hRow.createCell(0).setCellValue("Fecha");
            hRow.createCell(1).setCellValue("Zona");
            hRow.createCell(2).setCellValue("Cantidad");
            hRow.createCell(3).setCellValue("Precio");
            for (Map.Entry<LocalDate, Map<String, ZonaDia>> entry : resumen.porDiaZona.entrySet()) {
                for (ZonaDia zd : entry.getValue().values()) {
                    Row rr = hojaResumen.createRow(rResumen++);
                    rr.createCell(0).setCellValue(entry.getKey().format(FMT_DATE));
                    rr.createCell(1).setCellValue(zd.zona);
                    rr.createCell(2).setCellValue(zd.cantidad);
                    rr.createCell(3).setCellValue(String.format("%.2f", zd.precio));
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    private void crearCelda(Row row, int col, String value) {
        row.createCell(col).setCellValue(value);
    }

    private CellStyle createHeaderStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        return s;
    }

    // Colores marca MVG TMS
    private static final Color COLOR_MVG_INDIGO = new Color(79, 70, 229);
    private static final Color COLOR_MVG_CYAN = new Color(6, 182, 212);
    private static final Color COLOR_GRIS_FOOTER = new Color(107, 114, 128);
    private static final Color COLOR_GRIS_CLARO = new Color(248, 250, 252);
    private static final Color COLOR_BORDE = new Color(226, 232, 240);

    private byte[] generarPdf(List<Envio> envios, ResumenData resumen, String nombreDestinatario,
                             LocalDate fechaDesde, LocalDate fechaHasta) throws DocumentException, IOException {
        Document doc = new Document(PageSize.A4, 36, 36, 50, 44);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        writer.setPageEvent(new MvgReportFooter());
        doc.open();

        Font fontTitulo = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22);
        fontTitulo.setColor(COLOR_MVG_INDIGO);
        Font fontSubtitulo = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
        fontSubtitulo.setColor(Color.DARK_GRAY);
        Font fontNormal = FontFactory.getFont(FontFactory.HELVETICA, 10);
        fontNormal.setColor(Color.DARK_GRAY);
        Font fontBold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
        Font fontSeccion = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
        fontSeccion.setColor(COLOR_MVG_INDIGO);

        // Barra de marca (MVG) arriba
        PdfPTable barraMarca = new PdfPTable(1);
        barraMarca.setWidthPercentage(100);
        barraMarca.setSpacingAfter(10);
        barraMarca.setTotalWidth(doc.getPageSize().getWidth() - doc.leftMargin() - doc.rightMargin());
        Font fontMarca = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
        fontMarca.setColor(Color.WHITE);
        PdfPCell barraCell = new PdfPCell(new Phrase("  MVG", fontMarca));
        barraCell.setBackgroundColor(COLOR_MVG_INDIGO);
        barraCell.setBorder(0);
        barraCell.setFixedHeight(28);
        barraCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        barraMarca.addCell(barraCell);
        doc.add(barraMarca);

        // Cabecera con marca
        Paragraph pTitulo = new Paragraph("Informe de pedidos colectados", fontTitulo);
        pTitulo.setSpacingAfter(6);
        doc.add(pTitulo);
        doc.add(new Paragraph(nombreDestinatario, fontSubtitulo));
        doc.add(new Paragraph("Colectados desde " + fechaDesde.format(FMT_DATE) + " hasta " + fechaHasta.format(FMT_DATE), fontNormal));
        doc.add(Chunk.NEWLINE);

        Paragraph intro = new Paragraph(
                "Este informe resume los pedidos que fueron colectados (retirados) en el rango de fechas indicado. "
                        + "Incluye totales por día y zona, el detalle de cada envío y el monto retirado en efectivo cuando corresponde.",
                fontNormal);
        intro.setSpacingAfter(16);
        doc.add(intro);

        // Bloque Resumen con fondo
        doc.add(new Paragraph("Resumen", fontSeccion));
        doc.add(Chunk.NEWLINE);
        PdfPTable cardResumen = new PdfPTable(1);
        cardResumen.setWidthPercentage(100);
        cardResumen.setSpacingBefore(4);
        cardResumen.setSpacingAfter(12);
        cardResumen.setBackgroundColor(COLOR_GRIS_CLARO);
        cardResumen.setBorderColor(COLOR_BORDE);
        cardResumen.setBorderWidth(0.5f);
        cardResumen.setPadding(12);
        cardResumen.addCell(cellResumen("Total envíos: " + resumen.cantidadEnvios, false));
        cardResumen.addCell(cellResumen("Precio total: $ " + String.format("%.2f", resumen.precioTotal), false));
        cardResumen.addCell(cellResumen("Plata retirada en efectivo: $ " + String.format("%.2f", resumen.efectivo), false));
        doc.add(cardResumen);

        if (envios.isEmpty()) {
            doc.add(new Paragraph("No hay envíos en el período para este destinatario.", fontNormal));
            doc.add(Chunk.NEWLINE);
        } else {
            doc.add(new Paragraph("Por día y zona", fontSeccion));
            doc.add(new Paragraph("Desglose de cantidades y precios por fecha y zona de entrega.", FontFactory.getFont(FontFactory.HELVETICA, 9)));
            doc.add(Chunk.NEWLINE);
            PdfPTable tablaResumen = new PdfPTable(4);
            tablaResumen.setWidthPercentage(100);
            tablaResumen.setWidths(new float[]{2f, 3f, 2f, 2f});
            tablaResumen.setSpacingBefore(4);
            tablaResumen.setSpacingAfter(14);
            addHeaderCell(tablaResumen, "Fecha");
            addHeaderCell(tablaResumen, "Zona");
            addHeaderCell(tablaResumen, "Cant.");
            addHeaderCell(tablaResumen, "Precio");
            for (Map.Entry<LocalDate, Map<String, ZonaDia>> entry : resumen.porDiaZona.entrySet()) {
                for (ZonaDia zd : entry.getValue().values()) {
                    tablaResumen.addCell(cell(entry.getKey().format(FMT_DATE), false));
                    tablaResumen.addCell(cell(zd.zona, false));
                    tablaResumen.addCell(cell(String.valueOf(zd.cantidad), false));
                    tablaResumen.addCell(cell(String.format("%.2f", zd.precio), false));
                }
            }
            doc.add(tablaResumen);

            doc.add(new Paragraph("Detalle de envíos", fontSeccion));
            doc.add(new Paragraph("Listado de cada envío con tracking, cliente, fecha de colecta, estado y costo.", FontFactory.getFont(FontFactory.HELVETICA, 9)));
            doc.add(Chunk.NEWLINE);
            PdfPTable tabla = new PdfPTable(new float[]{2.5f, 2.5f, 2f, 2f, 1.5f, 2f});
            tabla.setWidthPercentage(100);
            tabla.setSpacingBefore(4);
            addHeaderCell(tabla, "Tracking");
            addHeaderCell(tabla, "Cliente");
            addHeaderCell(tabla, "Fecha colecta");
            addHeaderCell(tabla, "Estado");
            addHeaderCell(tabla, "Zona");
            addHeaderCell(tabla, "Costo");
            for (Envio e : envios) {
                tabla.addCell(cell(e.getTracking() != null ? e.getTracking() : "", false));
                tabla.addCell(cell(e.getCliente() != null ? e.getCliente() : "", false));
                tabla.addCell(cell(fechaColectaEfectiva(e) != null ? fechaColectaEfectiva(e).format(FMT_DATETIME) : "", false));
                tabla.addCell(cell(e.getEstado() != null ? e.getEstado() : "", false));
                tabla.addCell(cell(e.getZonaEntrega() != null ? e.getZonaEntrega() : "", false));
                tabla.addCell(cell(e.getCostoEnvio() != null ? e.getCostoEnvio() : "", false));
            }
            doc.add(tabla);
        }
        doc.close();
        return out.toByteArray();
    }

    private static void addHeaderCell(PdfPTable table, String text) {
        Font f = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9);
        f.setColor(Color.WHITE);
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", f));
        c.setBackgroundColor(COLOR_MVG_INDIGO);
        c.setPadding(6);
        c.setHorizontalAlignment(Element.ALIGN_LEFT);
        table.addCell(c);
    }

    private static PdfPCell cellResumen(String text, boolean bold) {
        Font f = bold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10) : FontFactory.getFont(FontFactory.HELVETICA, 10);
        f.setColor(Color.DARK_GRAY);
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", f));
        c.setPadding(4);
        c.setBorder(0);
        return c;
    }

    private static PdfPCell cell(String text, boolean bold) {
        Font f = bold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9) : FontFactory.getFont(FontFactory.HELVETICA, 8);
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", f));
        c.setPadding(5);
        return c;
    }

    /** Pie de página en todas las hojas: "Powered by MVG TMS" */
    private static class MvgReportFooter extends PdfPageEventHelper {
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();
            Font fontFooter = FontFactory.getFont(FontFactory.HELVETICA, 8);
            fontFooter.setColor(COLOR_GRIS_FOOTER);
            Phrase footer = new Phrase("Powered by MVG TMS", fontFooter);
            float x = (document.left() + document.right()) / 2f;
            float y = document.bottom() - 12;
            ColumnText.showTextAligned(cb, Element.ALIGN_CENTER, footer, x, y, 0);
        }
    }

    private byte[] generarExcelResumen(List<ResumenFila> filas, LocalDate fechaDesde, LocalDate fechaHasta) throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sh = wb.createSheet("Resumen");
            int r = 0;
            sh.createRow(r++).createCell(0).setCellValue("Resumen por cliente/grupo - Colectados desde " + fechaDesde.format(FMT_DATE) + " hasta " + fechaHasta.format(FMT_DATE));
            r++;
            Row header = sh.createRow(r++);
            header.createCell(0).setCellValue("Cliente / Grupo");
            header.createCell(1).setCellValue("Cantidad");
            header.createCell(2).setCellValue("Precio total");
            for (ResumenFila f : filas) {
                Row row = sh.createRow(r++);
                row.createCell(0).setCellValue(f.nombre);
                row.createCell(1).setCellValue(f.cantidad);
                row.createCell(2).setCellValue(String.format("%.2f", f.precioTotal));
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    private static String sanitizeFileName(String name) {
        if (name == null) return "informe";
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }

    /** nombre: etiqueta del informe; codigos: códigos de cliente; textosCliente: variantes que pueden aparecer en envio.cliente (codigo, "codigo - nombre", nombreFantasia). */
    private record Target(String nombre, Set<String> codigos, Set<String> textosCliente) {}
    private record ReportFile(String nombre, byte[] contenido) {}
    private record ResumenFila(String nombre, int cantidad, double precioTotal) {}

    private static class ZonaDia {
        final String zona;
        int cantidad;
        double precio;

        ZonaDia(String zona, int cantidad, double precio) {
            this.zona = zona;
            this.cantidad = cantidad;
            this.precio = precio;
        }

        void sumar(int c, double p) {
            this.cantidad += c;
            this.precio += p;
        }
    }

    private static class ResumenData {
        final Map<LocalDate, Map<String, ZonaDia>> porDiaZona;
        final int cantidadEnvios;
        final double precioTotal;
        final double efectivo;

        ResumenData(Map<LocalDate, Map<String, ZonaDia>> porDiaZona, int cantidadEnvios, double precioTotal, double efectivo) {
            this.porDiaZona = porDiaZona;
            this.cantidadEnvios = cantidadEnvios;
            this.precioTotal = precioTotal;
            this.efectivo = efectivo;
        }
    }
}
