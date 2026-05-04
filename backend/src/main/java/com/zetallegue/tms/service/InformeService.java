package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.InformeRequestDTO;
import com.zetallegue.tms.dto.InformeResultDTO;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.model.Grupo;
import com.zetallegue.tms.model.ListaPrecio;
import com.zetallegue.tms.model.Zona;
import com.zetallegue.tms.repository.ClienteRepository;
import com.zetallegue.tms.repository.EnvioRepository;
import com.zetallegue.tms.repository.GrupoRepository;
import com.zetallegue.tms.repository.ListaPrecioRepository;
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
    /** Formato de fecha seguro para nombres de archivo (sin barras). */
    private static final DateTimeFormatter FMT_ARCHIVO = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final EnvioRepository envioRepository;
    private final ClienteRepository clienteRepository;
    private final GrupoRepository grupoRepository;
    private final ListaPrecioRepository listaPrecioRepository;

    /**
     * Genera el informe según la solicitud. Retorna archivo único (Excel o PDF) o ZIP con varios archivos + resumen,
     * y el nombre sugerido para la descarga (informe_cliente/grupo_fechainicio_fechafin.ext o informe_fechas.zip).
     */
    @Transactional(readOnly = true)
    public InformeResultDTO generarInforme(InformeRequestDTO req) throws IOException, DocumentException {
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

        boolean unSoloDestinatario = targets.size() == 1;
        String ext = esExcel ? "xlsx" : "pdf";
        String sufijoFechas = req.getFechaDesde().format(FMT_ARCHIVO) + "_" + req.getFechaHasta().format(FMT_ARCHIVO);

        for (Target target : targets) {
            List<Envio> envios = filtrarEnviosParaTarget(todosColectados, target, tomarEnvios);
            List<Envio> rechazadosCancelados = Collections.emptyList();
            if (TOMAR_RETIRADOS_EXCEPTO.equals(tomarEnvios)) {
                rechazadosCancelados = todosColectados.stream()
                        .filter(e -> perteneceATarget(e.getCliente(), target))
                        .filter(e -> ESTADO_RECHAZADO.equals(e.getEstado()) || ESTADO_CANCELADO.equals(e.getEstado()))
                        .collect(Collectors.toList());
            }
            log.info("[Informe] Target '{}' codigos={} -> envíos filtrados: {}, rechazados/cancelados: {}", target.nombre, target.codigos, envios.size(), rechazadosCancelados.size());
            ResumenData resumen = buildResumen(envios);
            Map<String, String> preciosPorZona = obtenerPreciosPorZonaParaTarget(target);
            String nombreSeguro;
            if (unSoloDestinatario) {
                nombreSeguro = "informe_" + slugParaArchivo(target.nombre) + "_" + sufijoFechas + "." + ext;
            } else {
                nombreSeguro = sanitizeFileName(target.nombre) + "." + ext;
            }
            byte[] contenido = esExcel
                    ? generarExcel(envios, resumen, target.nombre, req.getFechaDesde(), req.getFechaHasta(), rechazadosCancelados, target.esGrupo())
                    : generarPdf(envios, resumen, target.nombre, req.getFechaDesde(), req.getFechaHasta(), preciosPorZona, target.esGrupo(), rechazadosCancelados);
            reportes.add(new ReportFile(nombreSeguro, contenido));
            resumenFilas.add(new ResumenFila(target.nombre, envios.size(), resumen.precioTotal));
        }

        if (reportes.size() == 1) {
            return new InformeResultDTO(reportes.get(0).contenido, reportes.get(0).nombre);
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
        String nombreZip = "informe_" + sufijoFechas + ".zip";
        return new InformeResultDTO(zipOut.toByteArray(), nombreZip);
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
                        out.add(new Target(g.getNombre(), codigos, textosCliente, true));
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
                        out.add(new Target(nombre, Set.of(c.getCodigo()), textos, false));
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
                    out.add(new Target(g.getNombre(), codigos, textosCliente, true));
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
                    out.add(new Target(nombre, Set.of(c.getCodigo()), textos, false));
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

    /**
     * Obtiene los precios por zona acordados para el cliente/grupo del target.
     * Usa la lista de precios del primer cliente encontrado por código en el target.
     */
    private Map<String, String> obtenerPreciosPorZonaParaTarget(Target target) {
        Map<String, String> out = new LinkedHashMap<>();
        if (target.codigos() == null || target.codigos().isEmpty()) return out;
        for (String codigo : target.codigos()) {
            if (codigo == null || codigo.trim().isEmpty()) continue;
            Cliente c = clienteRepository.findByCodigo(codigo.trim()).orElse(null);
            if (c == null || c.getListaPreciosId() == null) continue;
            ListaPrecio listaPrecio = listaPrecioRepository.findById(c.getListaPreciosId()).orElse(null);
            if (listaPrecio == null) continue;
            List<Zona> zonas;
            if (Boolean.FALSE.equals(listaPrecio.getZonaPropia()) && listaPrecio.getListaPrecioSeleccionada() != null) {
                ListaPrecio ref = listaPrecioRepository.findById(listaPrecio.getListaPrecioSeleccionada()).orElse(null);
                zonas = (ref != null && Boolean.TRUE.equals(ref.getZonaPropia()) && ref.getZonas() != null) ? ref.getZonas() : new ArrayList<>();
            } else {
                zonas = (listaPrecio.getZonas() != null) ? listaPrecio.getZonas() : new ArrayList<>();
            }
            for (Zona z : zonas) {
                String nombre = (z.getNombre() != null && !z.getNombre().trim().isEmpty()) ? z.getNombre().trim() : (z.getCodigo() != null ? z.getCodigo().trim() : "Zona");
                if (!nombre.isEmpty() && z.getValor() != null && !z.getValor().trim().isEmpty()) {
                    out.putIfAbsent(nombre, z.getValor().trim());
                }
            }
            break; // un solo cliente para la lista de precios de referencia
        }
        return out;
    }

    /** Fecha de colecta efectiva: fechaColecta si existe, si no fechaUltimoMovimiento (envíos retirados sin fecha guardada). */
    private static LocalDateTime fechaColectaEfectiva(Envio e) {
        return e.getFechaColecta() != null ? e.getFechaColecta() : e.getFechaUltimoMovimiento();
    }

    private ResumenData buildResumen(List<Envio> envios) {
        double precioTotal = 0;
        double efectivo = 0;
        Map<LocalDate, Map<String, ZonaDia>> porDiaZona = new LinkedHashMap<>();
        Map<String, PorZona> porZona = new LinkedHashMap<>();

        for (Envio e : envios) {
            double costo = parseDouble(e.getCostoEnvio(), 0);
            precioTotal += costo;
            if (e.getTotalACobrar() != null && !e.getTotalACobrar().trim().isEmpty()) {
                efectivo += parseDouble(e.getTotalACobrar(), 0);
            }
            LocalDateTime fec = fechaColectaEfectiva(e);
            LocalDate dia = fec != null ? fec.toLocalDate() : null;
            final String zona = (e.getZonaEntrega() != null && !e.getZonaEntrega().trim().isEmpty()) ? e.getZonaEntrega().trim() : "Sin Zona";
            if (dia != null) {
                porDiaZona.computeIfAbsent(dia, k -> new LinkedHashMap<>())
                        .computeIfAbsent(zona, k -> new ZonaDia(zona, 0, 0))
                        .sumar(1, costo);
            }
            porZona.merge(zona, new PorZona(zona, 1, costo), (a, b) -> new PorZona(a.zona(), a.cantidad() + b.cantidad(), a.totalPrecio() + b.totalPrecio()));
        }

        return new ResumenData(porDiaZona, porZona, envios.size(), precioTotal, efectivo);
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
                               LocalDate fechaDesde, LocalDate fechaHasta, List<Envio> rechazadosCancelados, boolean esInformeGrupo) throws IOException {
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

            // Hoja Rechazados y cancelados (solo cuando hay datos)
            if (rechazadosCancelados != null && !rechazadosCancelados.isEmpty()) {
                Sheet hojaRC = wb.createSheet("Rechazados y cancelados");
                int rRC = 0;
                crearCelda(hojaRC.createRow(rRC++), 0, "Rechazados por el comprador y cancelados");
                crearCelda(hojaRC.createRow(rRC++), 0, "Envíos colectados en el período que quedaron en estado rechazado o cancelado.");
                rRC++;
                Row headerRC = hojaRC.createRow(rRC++);
                String[] headersRC = esInformeGrupo
                        ? new String[]{"Tracking", "Fecha colecta", "Cliente", "Dirección", "Estado final"}
                        : new String[]{"Tracking", "Fecha colecta", "Dirección", "Estado final"};
                for (int i = 0; i < headersRC.length; i++) {
                    Cell c = headerRC.createCell(i);
                    c.setCellValue(headersRC[i]);
                    c.setCellStyle(headerStyle);
                }
                for (Envio e : rechazadosCancelados) {
                    Row rowRC = hojaRC.createRow(rRC++);
                    rowRC.createCell(0).setCellValue(e.getTracking() != null ? e.getTracking() : "");
                    rowRC.createCell(1).setCellValue(fechaColectaEfectiva(e) != null ? fechaColectaEfectiva(e).format(FMT_DATETIME) : "");
                    int col = 2;
                    if (esInformeGrupo) {
                        rowRC.createCell(col++).setCellValue(e.getCliente() != null ? e.getCliente() : "");
                    }
                    rowRC.createCell(col++).setCellValue(e.getDireccion() != null ? e.getDireccion() : "");
                    rowRC.createCell(col).setCellValue(e.getEstado() != null ? e.getEstado() : "");
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

    // Colores marca Nexo (#1459e9 y acento)
    private static final Color COLOR_NEXO_PRIMARY = new Color(20, 89, 233);
    private static final Color COLOR_NEXO_ACCENT = new Color(59, 130, 246);
    private static final Color COLOR_GRIS_FOOTER = new Color(107, 114, 128);
    private static final Color COLOR_GRIS_CLARO = new Color(248, 250, 252);
    private static final Color COLOR_BORDE = new Color(226, 232, 240);
    private static final Color COLOR_GRIS_TEXTO = new Color(55, 65, 81);
    private static final Color COLOR_GRIS_SUBTITULO = new Color(107, 114, 128);

    private byte[] generarPdf(List<Envio> envios, ResumenData resumen, String nombreDestinatario,
                             LocalDate fechaDesde, LocalDate fechaHasta, Map<String, String> preciosPorZona, boolean esInformeGrupo,
                             List<Envio> rechazadosCancelados) throws DocumentException, IOException {
        Document doc = new Document(PageSize.A4, 40, 40, 54, 48);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        writer.setPageEvent(new NexoReportFooter());
        doc.open();

        com.lowagie.text.Font fontTitulo = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 24);
        fontTitulo.setColor(COLOR_NEXO_PRIMARY);
        com.lowagie.text.Font fontSubtitulo = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13);
        fontSubtitulo.setColor(COLOR_GRIS_TEXTO);
        com.lowagie.text.Font fontNormal = FontFactory.getFont(FontFactory.HELVETICA, 10);
        fontNormal.setColor(COLOR_GRIS_TEXTO);
        com.lowagie.text.Font fontSeccion = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13);
        fontSeccion.setColor(COLOR_NEXO_PRIMARY);
        com.lowagie.text.Font fontSubtituloSeccion = FontFactory.getFont(FontFactory.HELVETICA, 9);
        fontSubtituloSeccion.setColor(COLOR_GRIS_SUBTITULO);

        // ——— Header de marca: barra principal + franja cyan
        PdfPTable headerBar = new PdfPTable(1);
        headerBar.setWidthPercentage(100);
        headerBar.setSpacingAfter(0);
        com.lowagie.text.Font fontMarca = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20);
        fontMarca.setColor(Color.WHITE);
        com.lowagie.text.Font fontTagline = FontFactory.getFont(FontFactory.HELVETICA, 10);
        fontTagline.setColor(new Color(224, 231, 255));
        PdfPCell barraCell = new PdfPCell();
        barraCell.setBackgroundColor(COLOR_NEXO_PRIMARY);
        barraCell.setBorder(0);
        barraCell.setFixedHeight(44);
        barraCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        barraCell.setPaddingLeft(16);
        barraCell.setPaddingRight(16);
        Paragraph pMarca = new Paragraph("NEXO", fontMarca);
        pMarca.add(new Chunk("\n"));
        pMarca.add(new Phrase("Informe de pedidos colectados", fontTagline));
        barraCell.addElement(pMarca);
        headerBar.addCell(barraCell);
        doc.add(headerBar);
        PdfPTable accentBar = new PdfPTable(1);
        accentBar.setWidthPercentage(100);
        accentBar.setSpacingAfter(18);
        PdfPCell accentCell = new PdfPCell();
        accentCell.setBackgroundColor(COLOR_NEXO_ACCENT);
        accentCell.setBorder(0);
        accentCell.setFixedHeight(4);
        accentBar.addCell(accentCell);
        doc.add(accentBar);

        // Título del informe: destinatario y período
        doc.add(new Paragraph(nombreDestinatario, fontSubtitulo));
        doc.add(new Paragraph("Período: " + fechaDesde.format(FMT_DATE) + " a " + fechaHasta.format(FMT_DATE), fontNormal));
        doc.add(Chunk.NEWLINE);

        // Intro en bloque con fondo suave
        PdfPTable introBox = new PdfPTable(1);
        introBox.setWidthPercentage(100);
        introBox.setSpacingBefore(0);
        introBox.setSpacingAfter(20);
        PdfPCell introCell = new PdfPCell(new Paragraph(
                "El presente informe detalla los envíos colectados en el período indicado: tarifas acordadas por zona, desglose por zona y detalle de cada envío. "
                        + "Al final se incluye el detalle de cobros a destino, cuando corresponda.",
                fontNormal));
        introCell.setBackgroundColor(COLOR_GRIS_CLARO);
        introCell.setBorderWidth(0);
        introCell.setBorderWidthLeft(4);
        introCell.setBorderColorLeft(COLOR_NEXO_PRIMARY);
        introCell.setPadding(14);
        introBox.addCell(introCell);
        doc.add(introBox);

        // Resumen ejecutivo
        addSectionTitle(doc, fontSeccion, fontSubtituloSeccion, "Resumen ejecutivo", null);
        PdfPTable cardResumen = new PdfPTable(1);
        cardResumen.setWidthPercentage(100);
        cardResumen.setSpacingBefore(6);
        cardResumen.setSpacingAfter(22);
        cardResumen.getDefaultCell().setBorder(0);
        PdfPCell c1 = cellResumen("Cantidad de envíos: " + resumen.cantidadEnvios, false);
        c1.setBackgroundColor(COLOR_GRIS_CLARO);
        c1.setBorderWidth(0);
        c1.setBorderWidthLeft(4);
        c1.setBorderColorLeft(COLOR_NEXO_PRIMARY);
        c1.setPadding(12);
        cardResumen.addCell(c1);
        PdfPCell c2 = cellResumen("Total envíos: $ " + String.format("%.2f", resumen.precioTotal), false);
        c2.setBackgroundColor(COLOR_GRIS_CLARO);
        c2.setBorderWidth(0);
        c2.setBorderWidthLeft(4);
        c2.setBorderColorLeft(COLOR_NEXO_PRIMARY);
        c2.setPadding(12);
        cardResumen.addCell(c2);
        PdfPCell c3 = cellResumen("Cobros a destino (efectivo): $ " + String.format("%.2f", resumen.efectivo), false);
        c3.setBackgroundColor(COLOR_GRIS_CLARO);
        c3.setBorderWidth(0);
        c3.setBorderWidthLeft(4);
        c3.setBorderColorLeft(COLOR_NEXO_PRIMARY);
        c3.setPadding(12);
        cardResumen.addCell(c3);
        doc.add(cardResumen);

        // Precios por zona acordados
        if (preciosPorZona != null && !preciosPorZona.isEmpty()) {
            addSectionTitle(doc, fontSeccion, fontSubtituloSeccion, "Tarifas por zona", "Precios acordados por zona de entrega para el presente informe.");
            com.lowagie.text.Font fontLine = FontFactory.getFont(FontFactory.HELVETICA, 10);
            fontLine.setColor(COLOR_GRIS_TEXTO);
            PdfPTable preciosBox = new PdfPTable(1);
            preciosBox.setWidthPercentage(100);
            preciosBox.setSpacingBefore(4);
            preciosBox.setSpacingAfter(12);
            preciosBox.getDefaultCell().setBorder(0);
            for (Map.Entry<String, String> entry : preciosPorZona.entrySet()) {
                String zona = entry.getKey();
                String valor = entry.getValue();
                PdfPCell lineCell = new PdfPCell(new Paragraph("  · " + zona + ": $ " + valor, fontLine));
                lineCell.setBorder(0);
                lineCell.setPadding(8);
                lineCell.setPaddingLeft(14);
                lineCell.setBackgroundColor(COLOR_GRIS_CLARO);
                lineCell.setBorderWidthLeft(4);
                lineCell.setBorderColorLeft(COLOR_NEXO_ACCENT);
                preciosBox.addCell(lineCell);
            }
            doc.add(preciosBox);
            doc.add(Chunk.NEWLINE);
        }

        if (envios.isEmpty()) {
            doc.add(new Paragraph("No hay envíos en el período para este destinatario.", fontNormal));
            doc.add(Chunk.NEWLINE);
        } else {
            addSectionTitle(doc, fontSeccion, fontSubtituloSeccion, "Desglose por zonas", "Cantidad de envíos y monto total por zona en el período.");
            com.lowagie.text.Font fontLine = FontFactory.getFont(FontFactory.HELVETICA, 10);
            fontLine.setColor(COLOR_GRIS_TEXTO);
            PdfPTable desgloseBox = new PdfPTable(1);
            desgloseBox.setWidthPercentage(100);
            desgloseBox.setSpacingBefore(4);
            desgloseBox.setSpacingAfter(12);
            desgloseBox.getDefaultCell().setBorder(0);
            for (PorZona pz : resumen.porZona.values()) {
                PdfPCell lineCell = new PdfPCell(new Paragraph("  · " + pz.zona() + " — " + pz.cantidad() + " envío(s), Total $ " + String.format("%.2f", pz.totalPrecio()), fontLine));
                lineCell.setBorder(0);
                lineCell.setPadding(8);
                lineCell.setPaddingLeft(14);
                lineCell.setBackgroundColor(COLOR_GRIS_CLARO);
                lineCell.setBorderWidthLeft(4);
                lineCell.setBorderColorLeft(COLOR_NEXO_ACCENT);
                desgloseBox.addCell(lineCell);
            }
            doc.add(desgloseBox);
            doc.add(Chunk.NEWLINE);

            // Columna Cliente solo cuando el informe es de un grupo (varios clientes); si es de un solo cliente se omite.
            boolean mostrarColumnaCliente = esInformeGrupo;
            int numColsDetalle = mostrarColumnaCliente ? 6 : 5;
            float[] widthsDetalle = mostrarColumnaCliente ? new float[]{2f, 1.2f, 2f, 2.5f, 1.5f, 1.2f} : new float[]{2.2f, 1.2f, 2.8f, 2f, 1.2f};

            addSectionTitle(doc, fontSeccion, fontSubtituloSeccion, "Detalle de envíos", "Listado de envíos con tracking, fecha de colecta, dirección y precio.");
            com.lowagie.text.Font fontCelda = FontFactory.getFont(FontFactory.HELVETICA, 9);
            fontCelda.setColor(COLOR_GRIS_TEXTO);

            PdfPTable tablaDetalle = new PdfPTable(numColsDetalle);
            tablaDetalle.setWidthPercentage(100);
            tablaDetalle.setWidths(widthsDetalle);
            tablaDetalle.setSpacingBefore(6);
            tablaDetalle.setSpacingAfter(4);
            addHeaderCell(tablaDetalle, "Tracking");
            addHeaderCell(tablaDetalle, "Fecha");
            if (mostrarColumnaCliente) addHeaderCell(tablaDetalle, "Cliente");
            addHeaderCell(tablaDetalle, "Dirección");
            addHeaderCell(tablaDetalle, "Localidad");
            addHeaderCell(tablaDetalle, "Precio");

            double sumaPrecio = 0;
            for (Envio e : envios) {
                LocalDateTime fec = fechaColectaEfectiva(e);
                String fechaStr = fec != null ? fec.toLocalDate().format(FMT_DATE) : "—";
                double precio = parseDouble(e.getCostoEnvio(), 0);
                sumaPrecio += precio;
                addBodyCell(tablaDetalle, e.getTracking() != null ? e.getTracking() : "—", fontCelda);
                addBodyCell(tablaDetalle, fechaStr, fontCelda);
                if (mostrarColumnaCliente) addBodyCell(tablaDetalle, e.getCliente() != null ? e.getCliente() : "—", fontCelda);
                addBodyCell(tablaDetalle, e.getDireccion() != null ? e.getDireccion() : "—", fontCelda);
                addBodyCell(tablaDetalle, e.getLocalidad() != null ? e.getLocalidad() : "—", fontCelda);
                addBodyCell(tablaDetalle, "$ " + String.format("%.2f", precio), fontCelda);
            }
            // Fila total detalle
            com.lowagie.text.Font fontTotal = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9);
            fontTotal.setColor(COLOR_GRIS_TEXTO);
            int colSpanTotal = numColsDetalle - 1;
            PdfPCell vacioTotal = new PdfPCell(new Phrase("Total", fontTotal));
            vacioTotal.setColspan(colSpanTotal);
            vacioTotal.setPadding(8);
            vacioTotal.setBackgroundColor(COLOR_GRIS_CLARO);
            vacioTotal.setBorderWidth(1);
            vacioTotal.setBorderColor(COLOR_BORDE);
            vacioTotal.setHorizontalAlignment(Element.ALIGN_RIGHT);
            tablaDetalle.addCell(vacioTotal);
            PdfPCell totalPrecioCell = new PdfPCell(new Phrase("$ " + String.format("%.2f", sumaPrecio), fontTotal));
            totalPrecioCell.setPadding(8);
            totalPrecioCell.setBackgroundColor(COLOR_GRIS_CLARO);
            totalPrecioCell.setBorderWidth(1);
            totalPrecioCell.setBorderColor(COLOR_BORDE);
            tablaDetalle.addCell(totalPrecioCell);
            doc.add(tablaDetalle);
            doc.add(Chunk.NEWLINE);

            // Sección Cobros en destino (solo envíos con totalACobrar > 0)
            List<Envio> conCobro = envios.stream()
                    .filter(e -> e.getTotalACobrar() != null && !e.getTotalACobrar().trim().isEmpty() && parseDouble(e.getTotalACobrar(), 0) > 0)
                    .toList();
            addSectionTitle(doc, fontSeccion, fontSubtituloSeccion, "Cobros a destino", "Detalle de montos cobrados en destino por envío.");
            PdfPTable tablaCobros = new PdfPTable(4);
            tablaCobros.setWidthPercentage(100);
            tablaCobros.setWidths(new float[]{2f, 1.2f, 2.8f, 1.2f});
            tablaCobros.setSpacingBefore(6);
            tablaCobros.setSpacingAfter(4);
            addHeaderCell(tablaCobros, "Tracking");
            addHeaderCell(tablaCobros, "Fecha");
            addHeaderCell(tablaCobros, "Dirección");
            addHeaderCell(tablaCobros, "Cobrado");

            double sumaCobros = 0;
            for (Envio e : conCobro) {
                LocalDateTime fec = fechaColectaEfectiva(e);
                String fechaStr = fec != null ? fec.toLocalDate().format(FMT_DATE) : "—";
                double cobro = parseDouble(e.getTotalACobrar(), 0);
                sumaCobros += cobro;
                addBodyCell(tablaCobros, e.getTracking() != null ? e.getTracking() : "—", fontCelda);
                addBodyCell(tablaCobros, fechaStr, fontCelda);
                addBodyCell(tablaCobros, e.getDireccion() != null ? e.getDireccion() : "—", fontCelda);
                addBodyCell(tablaCobros, "$ " + String.format("%.2f", cobro), fontCelda);
            }
            PdfPCell vacioCobro = new PdfPCell(new Phrase("Total cobros a destino", fontTotal));
            vacioCobro.setColspan(3);
            vacioCobro.setPadding(8);
            vacioCobro.setBackgroundColor(COLOR_GRIS_CLARO);
            vacioCobro.setBorderWidth(1);
            vacioCobro.setBorderColor(COLOR_BORDE);
            vacioCobro.setHorizontalAlignment(Element.ALIGN_RIGHT);
            tablaCobros.addCell(vacioCobro);
            PdfPCell totalCobroCell = new PdfPCell(new Phrase("$ " + String.format("%.2f", sumaCobros), fontTotal));
            totalCobroCell.setPadding(8);
            totalCobroCell.setBackgroundColor(COLOR_GRIS_CLARO);
            totalCobroCell.setBorderWidth(1);
            totalCobroCell.setBorderColor(COLOR_BORDE);
            tablaCobros.addCell(totalCobroCell);
            doc.add(tablaCobros);

            // Cierre: importe a abonar (Total envíos − Cobros a destino)
            double importeAbonar = resumen.precioTotal - resumen.efectivo;
            doc.add(Chunk.NEWLINE);
            PdfPTable cierreBox = new PdfPTable(1);
            cierreBox.setWidthPercentage(100);
            cierreBox.setSpacingBefore(8);
            cierreBox.setSpacingAfter(8);
            com.lowagie.text.Font fontCierre = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
            fontCierre.setColor(COLOR_NEXO_PRIMARY);
            PdfPCell cierreCell = new PdfPCell();
            cierreCell.setBorder(0);
            cierreCell.setPadding(14);
            cierreCell.setBackgroundColor(COLOR_GRIS_CLARO);
            cierreCell.setBorderWidthLeft(4);
            cierreCell.setBorderColorLeft(COLOR_NEXO_PRIMARY);
            Paragraph pImporte = new Paragraph("Importe a abonar: $ " + String.format("%.2f", importeAbonar), fontCierre);
            pImporte.add(new Chunk("\n"));
            pImporte.add(new Phrase("(Total envíos menos cobros a destino)", fontSubtituloSeccion));
            cierreCell.addElement(pImporte);
            cierreCell.addElement(Chunk.NEWLINE);
            cierreCell.addElement(new Paragraph("Agradecemos su confianza y quedamos a disposición.", fontNormal));
            cierreBox.addCell(cierreCell);
            doc.add(cierreBox);
        }

        // Tabla de rechazados por el comprador y cancelados (solo cuando la opción fue "todos los retirados excepto...")
        if (rechazadosCancelados != null && !rechazadosCancelados.isEmpty()) {
            doc.add(Chunk.NEWLINE);
            addSectionTitle(doc, fontSeccion, fontSubtituloSeccion, "Rechazados por el comprador y cancelados", "Envíos colectados en el período que quedaron en estado rechazado o cancelado.");
            boolean mostrarColCliente = esInformeGrupo;
            int numColsRC = mostrarColCliente ? 5 : 4;
            float[] widthsRC = mostrarColCliente ? new float[]{2f, 1.2f, 2f, 2.5f, 1.8f} : new float[]{2.2f, 1.2f, 2.8f, 1.8f};
            PdfPTable tablaRC = new PdfPTable(numColsRC);
            tablaRC.setWidthPercentage(100);
            tablaRC.setWidths(widthsRC);
            tablaRC.setSpacingBefore(6);
            tablaRC.setSpacingAfter(12);
            addHeaderCell(tablaRC, "Tracking");
            addHeaderCell(tablaRC, "Fecha");
            if (mostrarColCliente) addHeaderCell(tablaRC, "Cliente");
            addHeaderCell(tablaRC, "Dirección");
            addHeaderCell(tablaRC, "Estado final");
            com.lowagie.text.Font fontCeldaRC = FontFactory.getFont(FontFactory.HELVETICA, 9);
            fontCeldaRC.setColor(COLOR_GRIS_TEXTO);
            for (Envio e : rechazadosCancelados) {
                LocalDateTime fec = fechaColectaEfectiva(e);
                String fechaStr = fec != null ? fec.toLocalDate().format(FMT_DATE) : "—";
                String estadoFinal = e.getEstado() != null ? e.getEstado() : "—";
                addBodyCell(tablaRC, e.getTracking() != null ? e.getTracking() : "—", fontCeldaRC);
                addBodyCell(tablaRC, fechaStr, fontCeldaRC);
                if (mostrarColCliente) addBodyCell(tablaRC, e.getCliente() != null ? e.getCliente() : "—", fontCeldaRC);
                addBodyCell(tablaRC, e.getDireccion() != null ? e.getDireccion() : "—", fontCeldaRC);
                addBodyCell(tablaRC, estadoFinal, fontCeldaRC);
            }
            doc.add(tablaRC);
        }
        doc.close();
        return out.toByteArray();
    }

    private void addSectionTitle(Document doc, com.lowagie.text.Font fontSeccion, com.lowagie.text.Font fontSub,
                                  String title, String subtitle) throws DocumentException {
        doc.add(new Paragraph(title, fontSeccion));
        if (subtitle != null && !subtitle.isEmpty()) {
            doc.add(new Paragraph(subtitle, fontSub));
        }
        PdfPTable lineTable = new PdfPTable(1);
        lineTable.setWidthPercentage(100);
        lineTable.setSpacingBefore(4);
        lineTable.setSpacingAfter(6);
        PdfPCell lineCell = new PdfPCell();
        lineCell.setBackgroundColor(COLOR_NEXO_ACCENT);
        lineCell.setBorder(0);
        lineCell.setFixedHeight(2);
        lineTable.addCell(lineCell);
        doc.add(lineTable);
    }

    private static void addHeaderCell(PdfPTable table, String text) {
        com.lowagie.text.Font f = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9);
        f.setColor(Color.WHITE);
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", f));
        c.setBackgroundColor(COLOR_NEXO_PRIMARY);
        c.setPadding(6);
        c.setHorizontalAlignment(Element.ALIGN_LEFT);
        table.addCell(c);
    }

    private static void addBodyCell(PdfPTable table, String text, com.lowagie.text.Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", font));
        c.setPadding(6);
        c.setBorderWidth(1);
        c.setBorderColor(COLOR_BORDE);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        table.addCell(c);
    }

    private static PdfPCell cellResumen(String text, boolean bold) {
        com.lowagie.text.Font f = bold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10) : FontFactory.getFont(FontFactory.HELVETICA, 10);
        f.setColor(Color.DARK_GRAY);
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", f));
        c.setPadding(4);
        c.setBorder(0);
        return c;
    }

    private static PdfPCell cell(String text, boolean bold) {
        com.lowagie.text.Font f = bold ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9) : FontFactory.getFont(FontFactory.HELVETICA, 8);
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "", f));
        c.setPadding(5);
        return c;
    }

    /** Pie de página en todas las hojas */
    private static class NexoReportFooter extends PdfPageEventHelper {
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();
            com.lowagie.text.Font fontFooter = FontFactory.getFont(FontFactory.HELVETICA, 8);
            fontFooter.setColor(COLOR_GRIS_FOOTER);
            Phrase footer = new Phrase("Powered by Nexo", fontFooter);
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

    /** Slug para nombre de archivo: sin espacios ni " - ", solo letras/números/guiones bajos. */
    private static String slugParaArchivo(String name) {
        if (name == null || name.trim().isEmpty()) return "informe";
        String s = name.trim().replace(" - ", "_").replace(" ", "_");
        return sanitizeFileName(s);
    }

    /** nombre: etiqueta del informe; codigos: códigos de cliente; textosCliente: variantes que pueden aparecer en envio.cliente; esGrupo: true si el destinatario es un grupo (mostrar columna Cliente en PDF). */
    private record Target(String nombre, Set<String> codigos, Set<String> textosCliente, boolean esGrupo) {}
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

    private record PorZona(String zona, int cantidad, double totalPrecio) {}

    private static class ResumenData {
        final Map<LocalDate, Map<String, ZonaDia>> porDiaZona;
        final Map<String, PorZona> porZona;
        final int cantidadEnvios;
        final double precioTotal;
        final double efectivo;

        ResumenData(Map<LocalDate, Map<String, ZonaDia>> porDiaZona, Map<String, PorZona> porZona, int cantidadEnvios, double precioTotal, double efectivo) {
            this.porDiaZona = porDiaZona;
            this.porZona = porZona;
            this.cantidadEnvios = cantidadEnvios;
            this.precioTotal = precioTotal;
            this.efectivo = efectivo;
        }
    }
}
