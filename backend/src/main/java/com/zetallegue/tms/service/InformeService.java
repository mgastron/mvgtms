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
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;
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

        List<Target> targets = resolveTargets(req);
        if (targets.isEmpty()) {
            throw new IllegalArgumentException("No hay destinatarios seleccionados");
        }

        String formato = req.getFormato() != null ? req.getFormato().toUpperCase(Locale.ROOT) : FORMATO_EXCEL;
        String tomarEnvios = req.getTomarEnvios() != null ? req.getTomarEnvios().toUpperCase(Locale.ROOT) : TOMAR_RETIRADOS_EXCEPTO;
        boolean esExcel = FORMATO_EXCEL.equals(formato);

        List<ReportFile> reportes = new ArrayList<>();
        List<ResumenFila> resumenFilas = new ArrayList<>();

        for (Target target : targets) {
            List<Envio> envios = filtrarEnviosParaTarget(todosColectados, target, tomarEnvios);
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

        // Varios destinatarios: ZIP con un archivo por destinatario + Excel de resumen
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
                        Set<String> codigos = clientes.stream().map(Cliente::getCodigo).filter(Objects::nonNull).collect(Collectors.toSet());
                        out.add(new Target(g.getNombre(), codigos));
                    }
                }
                break;
            case TIPO_CUENTAS:
                if (req.getIdsCuentas() != null) {
                    for (Long cid : req.getIdsCuentas()) {
                        Cliente c = clienteRepository.findById(cid).orElse(null);
                        if (c == null) continue;
                        String nombre = (c.getCodigo() != null ? c.getCodigo() : "") + (c.getNombreFantasia() != null ? " - " + c.getNombreFantasia() : "");
                        out.add(new Target(nombre, Set.of(c.getCodigo())));
                    }
                }
                break;
            case TIPO_TODOS_GRUPOS:
                for (Grupo g : grupoRepository.findAll()) {
                    List<Cliente> clientes = clienteRepository.findByGrupoId(g.getId());
                    Set<String> codigos = clientes.stream().map(Cliente::getCodigo).filter(Objects::nonNull).collect(Collectors.toSet());
                    out.add(new Target(g.getNombre(), codigos));
                }
                break;
            case TIPO_TODAS_CUENTAS:
                for (Cliente c : clienteRepository.findAll()) {
                    if (c.getCodigo() == null) continue;
                    String nombre = c.getCodigo() + (c.getNombreFantasia() != null ? " - " + c.getNombreFantasia() : "");
                    out.add(new Target(nombre, Set.of(c.getCodigo())));
                }
                break;
            default:
                break;
        }
        return out;
    }

    private List<Envio> filtrarEnviosParaTarget(List<Envio> envios, Target target, String tomarEnvios) {
        List<Envio> list = envios.stream()
                .filter(e -> perteneceACodigos(e.getCliente(), target.codigos))
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

    private boolean perteneceACodigos(String clienteStr, Set<String> codigos) {
        if (clienteStr == null || codigos == null) return false;
        String c = clienteStr.trim();
        for (String codigo : codigos) {
            if (codigo == null) continue;
            String cod = codigo.trim();
            if (cod.isEmpty()) continue;
            if (c.equals(cod)) return true;
            if (c.startsWith(cod + " - ")) return true;
            if (c.startsWith(cod + " ")) return true;
            if (c.startsWith(cod + "-")) return true;
        }
        return false;
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
            LocalDate dia = e.getFechaColecta() != null ? e.getFechaColecta().toLocalDate() : null;
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
                r.createCell(2).setCellValue(e.getFechaColecta() != null ? e.getFechaColecta().format(FMT_DATETIME) : "");
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

    private byte[] generarPdf(List<Envio> envios, ResumenData resumen, String nombreDestinatario,
                             LocalDate fechaDesde, LocalDate fechaHasta) throws DocumentException, IOException {
        Document doc = new Document(PageSize.A4.rotate(), 20, 20, 30, 30);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter.getInstance(doc, out);
        doc.open();

        com.lowagie.text.Font fontTitulo = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14);
        com.lowagie.text.Font fontNormal = FontFactory.getFont(FontFactory.HELVETICA, 10);
        com.lowagie.text.Font fontBold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);

        doc.add(new Paragraph("Informe de pedidos colectados", fontTitulo));
        doc.add(new Paragraph(nombreDestinatario, fontBold));
        doc.add(new Paragraph("Colectados desde " + fechaDesde.format(FMT_DATE) + " hasta " + fechaHasta.format(FMT_DATE), fontNormal));
        doc.add(Chunk.NEWLINE);

        doc.add(new Paragraph("Resumen", fontBold));
        doc.add(new Paragraph("Total envíos: " + resumen.cantidadEnvios, fontNormal));
        doc.add(new Paragraph("Precio total: " + String.format("%.2f", resumen.precioTotal), fontNormal));
        doc.add(new Paragraph("Plata retirada en efectivo: " + String.format("%.2f", resumen.efectivo), fontNormal));
        if (envios.isEmpty()) {
            doc.add(new Paragraph("No hay envíos en el período para este destinatario.", fontNormal));
        }
        doc.add(Chunk.NEWLINE);

        doc.add(new Paragraph("Por día y zona", fontBold));
        PdfPTable tablaResumen = new PdfPTable(4);
        tablaResumen.setWidths(new float[]{2f, 3f, 2f, 2f});
        tablaResumen.addCell(cell("Fecha", true));
        tablaResumen.addCell(cell("Zona", true));
        tablaResumen.addCell(cell("Cant.", true));
        tablaResumen.addCell(cell("Precio", true));
        for (Map.Entry<LocalDate, Map<String, ZonaDia>> entry : resumen.porDiaZona.entrySet()) {
            for (ZonaDia zd : entry.getValue().values()) {
                tablaResumen.addCell(cell(entry.getKey().format(FMT_DATE), false));
                tablaResumen.addCell(cell(zd.zona, false));
                tablaResumen.addCell(cell(String.valueOf(zd.cantidad), false));
                tablaResumen.addCell(cell(String.format("%.2f", zd.precio), false));
            }
        }
        doc.add(tablaResumen);
        doc.add(Chunk.NEWLINE);

        doc.add(new Paragraph("Detalle de envíos", fontBold));
        if (envios.isEmpty()) {
            doc.add(new Paragraph("No hay envíos en el período para este destinatario.", fontNormal));
        } else {
        PdfPTable tabla = new PdfPTable(new float[]{2.5f, 2.5f, 2f, 2f, 1.5f, 2f});
        tabla.setWidthPercentage(100);
        tabla.addCell(cell("Tracking", true));
        tabla.addCell(cell("Cliente", true));
        tabla.addCell(cell("Fecha colecta", true));
        tabla.addCell(cell("Estado", true));
        tabla.addCell(cell("Zona", true));
        tabla.addCell(cell("Costo", true));
        for (Envio e : envios) {
            tabla.addCell(cell(e.getTracking() != null ? e.getTracking() : "", false));
            tabla.addCell(cell(e.getCliente() != null ? e.getCliente() : "", false));
            tabla.addCell(cell(e.getFechaColecta() != null ? e.getFechaColecta().format(FMT_DATETIME) : "", false));
            tabla.addCell(cell(e.getEstado() != null ? e.getEstado() : "", false));
            tabla.addCell(cell(e.getZonaEntrega() != null ? e.getZonaEntrega() : "", false));
            tabla.addCell(cell(e.getCostoEnvio() != null ? e.getCostoEnvio() : "", false));
        }
        doc.add(tabla);
        }
        doc.close();
        return out.toByteArray();
    }

    private static PdfPCell cell(String text, boolean bold) {
        com.lowagie.text.Font f = bold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9) : FontFactory.getFont(FontFactory.HELVETICA, 8);
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", f));
        c.setPadding(4);
        return c;
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

    private record Target(String nombre, Set<String> codigos) {}
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
