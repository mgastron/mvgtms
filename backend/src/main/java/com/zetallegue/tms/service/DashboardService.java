package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.DashboardDTO;
import com.zetallegue.tms.model.Envio;
import com.zetallegue.tms.model.HistorialEnvio;
import com.zetallegue.tms.repository.EnvioRepository;
import com.zetallegue.tms.repository.HistorialEnvioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardService {

    private static final String ENTREGADO = "Entregado";
    private static final String EN_CAMINO = "En camino al destinatario";
    private static final String A_RETIRAR = "A retirar";
    private static final String RETIRADO = "Retirado";
    private static final String NADIE = "Nadie";
    private static final String RECHAZADO = "Rechazado por el comprador";
    private static final String CANCELADO = "Cancelado";
    private static final String CAMBIO_DIR = "Cambio de dirección";
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final EnvioRepository envioRepository;
    private final HistorialEnvioRepository historialEnvioRepository;

    @Transactional(readOnly = true)
    public DashboardDTO obtenerDashboard(LocalDate fechaDesde, LocalDate fechaHasta, Long choferId, String zona) {
        if (fechaDesde == null || fechaHasta == null) {
            throw new IllegalArgumentException("fechaDesde y fechaHasta son obligatorios");
        }
        if (fechaDesde.isAfter(fechaHasta)) {
            throw new IllegalArgumentException("fechaDesde no puede ser posterior a fechaHasta");
        }

        LocalDateTime desde = fechaDesde.atStartOfDay();
        LocalDateTime hasta = fechaHasta.atTime(23, 59, 59, 999_000_000);

        List<Envio> envios = filtrar(com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(
                envioRepository.findParaDashboard(desde, hasta)), choferId, zona);
        Set<Long> idsEnvios = envios.stream().map(Envio::getId).collect(Collectors.toSet());
        List<HistorialEnvio> cambiosDir = historialEnvioRepository
                .findByEstadoAndFechaBetween(CAMBIO_DIR, desde, hasta)
                .stream()
                .filter(h -> idsEnvios.contains(h.getEnvioId()))
                .collect(Collectors.toList());

        long dias = ChronoUnit.DAYS.between(fechaDesde, fechaHasta) + 1;
        LocalDate antHasta = fechaDesde.minusDays(1);
        LocalDate antDesde = antHasta.minusDays(dias - 1);
        LocalDateTime antDesdeDt = antDesde.atStartOfDay();
        LocalDateTime antHastaDt = antHasta.atTime(23, 59, 59, 999_000_000);
        List<Envio> anteriores = filtrar(com.zetallegue.tms.tenant.TenantQuery.ofCurrentOrg(
                envioRepository.findParaDashboard(antDesdeDt, antHastaDt)), choferId, zona);

        DashboardDTO.Kpis kpis = buildKpis(envios, cambiosDir.size());
        DashboardDTO.Kpis kpisAnt = buildKpis(anteriores, 0);

        Double deltaTotalPct = null;
        Double deltaTasaPp = null;
        if (kpisAnt.getTotal() > 0) {
            deltaTotalPct = ((kpis.getTotal() - kpisAnt.getTotal()) * 100.0) / kpisAnt.getTotal();
        }
        deltaTasaPp = kpis.getTasaExito() - kpisAnt.getTasaExito();

        return DashboardDTO.builder()
                .fechaDesde(fechaDesde.format(FMT))
                .fechaHasta(fechaHasta.format(FMT))
                .kpis(kpis)
                .comparacion(DashboardDTO.ComparacionPeriodo.builder()
                        .periodoAnteriorDesde(antDesde.format(FMT))
                        .periodoAnteriorHasta(antHasta.format(FMT))
                        .totalAnterior(kpisAnt.getTotal())
                        .tasaExitoAnterior(kpisAnt.getTasaExito())
                        .deltaTotalPct(deltaTotalPct)
                        .deltaTasaExitoPp(deltaTasaPp)
                        .build())
                .porEstado(buildPorEstado(envios))
                .porZona(buildPorZona(envios))
                .porChofer(buildPorChofer(envios, cambiosDir))
                .porDia(buildPorDia(envios, fechaDesde, fechaHasta))
                .porOrigen(buildPorOrigen(envios))
                .alertas(buildAlertas(envios, kpis, cambiosDir))
                .build();
    }

    private List<Envio> filtrar(List<Envio> envios, Long choferId, String zona) {
        return envios.stream()
                .filter(e -> choferId == null || choferId.equals(e.getChoferAdjudicadoId()))
                .filter(e -> {
                    if (zona == null || zona.isBlank()) return true;
                    String z = e.getZonaEntrega() != null && !e.getZonaEntrega().isBlank()
                            ? e.getZonaEntrega() : "Sin Zona";
                    return zona.equalsIgnoreCase(z);
                })
                .collect(Collectors.toList());
    }

    private DashboardDTO.Kpis buildKpis(List<Envio> envios, long cambiosDireccion) {
        long entregados = countEstado(envios, ENTREGADO);
        long nadie = countEstado(envios, NADIE);
        long rechazados = countEstado(envios, RECHAZADO);
        long intentos = entregados + nadie + rechazados;
        double tasa = intentos > 0 ? (entregados * 100.0) / intentos : 0;

        long sinChofer = envios.stream()
                .filter(e -> e.getChoferAdjudicadoId() == null)
                .filter(e -> EN_CAMINO.equals(e.getEstado()) || RETIRADO.equals(e.getEstado())
                        || A_RETIRAR.equals(e.getEstado()))
                .count();

        long sinGeocode = envios.stream()
                .filter(e -> EN_CAMINO.equals(e.getEstado()) || RETIRADO.equals(e.getEstado()))
                .filter(e -> e.getLatDestino() == null || e.getLngDestino() == null)
                .count();

        return DashboardDTO.Kpis.builder()
                .total(envios.size())
                .entregados(entregados)
                .enCamino(countEstado(envios, EN_CAMINO))
                .aRetirar(countEstado(envios, A_RETIRAR))
                .retirados(countEstado(envios, RETIRADO))
                .nadie(nadie)
                .rechazados(rechazados)
                .cancelados(countEstado(envios, CANCELADO))
                .sinChofer(sinChofer)
                .sinGeocode(sinGeocode)
                .cambiosDireccion(cambiosDireccion)
                .tasaExito(round1(tasa))
                .codEsperado(sumMonto(envios, true))
                .costoEnvios(sumMonto(envios, false))
                .build();
    }

    private long countEstado(List<Envio> envios, String estado) {
        return envios.stream().filter(e -> estado.equals(e.getEstado())).count();
    }

    /** totalACobrar=true → suma COD; false → suma costoEnvio */
    private double sumMonto(List<Envio> envios, boolean totalACobrar) {
        double sum = 0;
        for (Envio e : envios) {
            String raw = totalACobrar ? e.getTotalACobrar() : e.getCostoEnvio();
            sum += parseMonto(raw);
        }
        return Math.round(sum * 100.0) / 100.0;
    }

    private double parseMonto(String raw) {
        if (raw == null || raw.isBlank()) return 0;
        try {
            return Double.parseDouble(raw.trim().replace(",", ".").replace("$", "").replace(" ", ""));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private List<DashboardDTO.SerieNombreCantidad> buildPorEstado(List<Envio> envios) {
        Map<String, Long> map = new LinkedHashMap<>();
        for (String e : List.of(A_RETIRAR, RETIRADO, EN_CAMINO, ENTREGADO, NADIE, RECHAZADO, CANCELADO, "Reprogramado por comprador")) {
            map.put(e, 0L);
        }
        for (Envio envio : envios) {
            String est = envio.getEstado() != null ? envio.getEstado() : "Sin estado";
            map.merge(est, 1L, Long::sum);
        }
        return map.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(e -> DashboardDTO.SerieNombreCantidad.builder().nombre(e.getKey()).cantidad(e.getValue()).build())
                .collect(Collectors.toList());
    }

    private List<DashboardDTO.SerieZona> buildPorZona(List<Envio> envios) {
        Map<String, List<Envio>> porZona = envios.stream()
                .collect(Collectors.groupingBy(e -> {
                    String z = e.getZonaEntrega();
                    return (z == null || z.isBlank()) ? "Sin Zona" : z;
                }));
        List<DashboardDTO.SerieZona> out = new ArrayList<>();
        for (Map.Entry<String, List<Envio>> entry : porZona.entrySet()) {
            List<Envio> list = entry.getValue();
            long ent = countEstado(list, ENTREGADO);
            long fall = countEstado(list, NADIE) + countEstado(list, RECHAZADO);
            long intentos = ent + fall;
            out.add(DashboardDTO.SerieZona.builder()
                    .nombre(entry.getKey())
                    .total(list.size())
                    .entregados(ent)
                    .fallidos(fall)
                    .tasaExito(intentos > 0 ? round1((ent * 100.0) / intentos) : 0)
                    .build());
        }
        out.sort((a, b) -> Long.compare(b.getTotal(), a.getTotal()));
        return out;
    }

    private List<DashboardDTO.SerieChofer> buildPorChofer(List<Envio> envios, List<HistorialEnvio> cambiosDir) {
        Map<Long, Long> cambiosPorEnvio = cambiosDir.stream()
                .collect(Collectors.groupingBy(HistorialEnvio::getEnvioId, Collectors.counting()));

        Map<String, List<Envio>> porChofer = envios.stream()
                .filter(e -> e.getChoferAdjudicadoId() != null)
                .collect(Collectors.groupingBy(e ->
                        e.getChoferAdjudicadoId() + "|" +
                                (e.getChoferAdjudicadoNombre() != null ? e.getChoferAdjudicadoNombre() : "Chofer")));

        List<DashboardDTO.SerieChofer> out = new ArrayList<>();
        for (Map.Entry<String, List<Envio>> entry : porChofer.entrySet()) {
            List<Envio> list = entry.getValue();
            Envio sample = list.get(0);
            long ent = countEstado(list, ENTREGADO);
            long nadie = countEstado(list, NADIE);
            long rech = countEstado(list, RECHAZADO);
            long intentos = ent + nadie + rech;
            long cambios = list.stream().mapToLong(e -> cambiosPorEnvio.getOrDefault(e.getId(), 0L)).sum();
            out.add(DashboardDTO.SerieChofer.builder()
                    .id(sample.getChoferAdjudicadoId())
                    .nombre(sample.getChoferAdjudicadoNombre() != null ? sample.getChoferAdjudicadoNombre() : "Chofer")
                    .total(list.size())
                    .entregados(ent)
                    .enCamino(countEstado(list, EN_CAMINO))
                    .nadie(nadie)
                    .rechazados(rech)
                    .cambiosDireccion(cambios)
                    .tasaExito(intentos > 0 ? round1((ent * 100.0) / intentos) : 0)
                    .codEsperado(sumMonto(list, true))
                    .build());
        }
        out.sort((a, b) -> Long.compare(b.getTotal(), a.getTotal()));
        return out;
    }

    private List<DashboardDTO.SerieDia> buildPorDia(List<Envio> envios, LocalDate desde, LocalDate hasta) {
        Map<String, List<Envio>> porDia = envios.stream()
                .collect(Collectors.groupingBy(e -> e.getFecha().toLocalDate().format(FMT)));
        List<DashboardDTO.SerieDia> out = new ArrayList<>();
        for (LocalDate d = desde; !d.isAfter(hasta); d = d.plusDays(1)) {
            String key = d.format(FMT);
            List<Envio> list = porDia.getOrDefault(key, List.of());
            out.add(DashboardDTO.SerieDia.builder()
                    .fecha(key)
                    .total(list.size())
                    .entregados(countEstado(list, ENTREGADO))
                    .fallidos(countEstado(list, NADIE) + countEstado(list, RECHAZADO))
                    .enCamino(countEstado(list, EN_CAMINO))
                    .build());
        }
        return out;
    }

    private List<DashboardDTO.SerieNombreCantidad> buildPorOrigen(List<Envio> envios) {
        Map<String, Long> map = new HashMap<>();
        for (Envio e : envios) {
            String o = e.getOrigen();
            if (o == null || o.isBlank()) o = "Directo";
            if ("Flex".equals(o)) o = "Mercado Libre";
            map.merge(o, 1L, Long::sum);
        }
        return map.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(e -> DashboardDTO.SerieNombreCantidad.builder().nombre(e.getKey()).cantidad(e.getValue()).build())
                .collect(Collectors.toList());
    }

    private List<DashboardDTO.Alerta> buildAlertas(List<Envio> envios, DashboardDTO.Kpis kpis, List<HistorialEnvio> cambiosDir) {
        List<DashboardDTO.Alerta> alertas = new ArrayList<>();

        if (kpis.getSinChofer() > 0) {
            alertas.add(alerta("warning", "SIN_CHOFER", "Pedidos sin adjudicar",
                    "Hay envíos pendientes o en tránsito sin chofer asignado.", kpis.getSinChofer()));
        }
        if (kpis.getSinGeocode() > 0) {
            alertas.add(alerta("warning", "SIN_GEOCODE", "Sin geolocalización",
                    "Envíos en ruta o retirados sin coordenadas de destino.", kpis.getSinGeocode()));
        }

        long intentos = kpis.getEntregados() + kpis.getNadie() + kpis.getRechazados();
        if (intentos >= 5) {
            double pctNadie = (kpis.getNadie() * 100.0) / intentos;
            double pctRech = (kpis.getRechazados() * 100.0) / intentos;
            if (pctNadie >= 15) {
                alertas.add(alerta("critical", "TASA_NADIE", "Alta tasa de «Nadie»",
                        String.format(Locale.ROOT, "%.0f%% de intentos terminaron en Nadie en domicilio.", pctNadie),
                        kpis.getNadie()));
            }
            if (pctRech >= 10) {
                alertas.add(alerta("critical", "TASA_RECHAZO", "Alta tasa de rechazo",
                        String.format(Locale.ROOT, "%.0f%% de intentos fueron rechazados por el comprador.", pctRech),
                        kpis.getRechazados()));
            }
            if (kpis.getTasaExito() < 70 && intentos >= 10) {
                alertas.add(alerta("warning", "TASA_EXITO_BAJA", "Tasa de éxito baja",
                        String.format(Locale.ROOT, "La tasa de entrega es %.1f%% (objetivo orientativo ≥ 70%%).", kpis.getTasaExito()),
                        intentos));
            }
        }

        if (kpis.getEnCamino() > 0) {
            long vencidos = envios.stream()
                    .filter(e -> EN_CAMINO.equals(e.getEstado()))
                    .filter(e -> e.getDeadline() != null && e.getDeadline().isBefore(LocalDateTime.now()))
                    .count();
            if (vencidos > 0) {
                alertas.add(alerta("critical", "DEADLINE", "Deadline vencido",
                        "Envíos en camino con deadline superado.", vencidos));
            }
        }

        if (!cambiosDir.isEmpty()) {
            alertas.add(alerta("info", "CAMBIO_DIR", "Cambios de dirección",
                    "Correcciones de dirección hechas desde la app (revisar en Actividad del pedido).",
                    cambiosDir.size()));
        }

        // Choferes con muchos fallidos
        Map<String, long[]> fallidosChofer = new HashMap<>();
        for (Envio e : envios) {
            if (e.getChoferAdjudicadoNombre() == null) continue;
            if (!NADIE.equals(e.getEstado()) && !RECHAZADO.equals(e.getEstado())) continue;
            fallidosChofer.computeIfAbsent(e.getChoferAdjudicadoNombre(), k -> new long[]{0})[0]++;
        }
        fallidosChofer.entrySet().stream()
                .filter(e -> e.getValue()[0] >= 3)
                .sorted((a, b) -> Long.compare(b.getValue()[0], a.getValue()[0]))
                .limit(3)
                .forEach(e -> alertas.add(alerta("warning", "CHOFER_FALLIDOS",
                        "Fallidos: " + e.getKey(),
                        "Nadie + rechazados en el período.",
                        e.getValue()[0])));

        double codEnCamino = envios.stream()
                .filter(e -> EN_CAMINO.equals(e.getEstado()))
                .mapToDouble(e -> parseMonto(e.getTotalACobrar()))
                .sum();
        if (codEnCamino >= 50000) {
            alertas.add(alerta("info", "COD_RUTA", "COD en ruta elevado",
                    String.format(Locale.ROOT, "Hay $%.0f a cobrar en envíos en camino.", codEnCamino),
                    Math.round(codEnCamino)));
        }

        alertas.sort((a, b) -> {
            int sa = sevRank(a.getSeveridad());
            int sb = sevRank(b.getSeveridad());
            return Integer.compare(sa, sb);
        });
        return alertas;
    }

    private int sevRank(String s) {
        if ("critical".equals(s)) return 0;
        if ("warning".equals(s)) return 1;
        return 2;
    }

    private DashboardDTO.Alerta alerta(String sev, String codigo, String titulo, String detalle, long cantidad) {
        return DashboardDTO.Alerta.builder()
                .severidad(sev)
                .codigo(codigo)
                .titulo(titulo)
                .detalle(detalle)
                .cantidad(cantidad)
                .build();
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
