package com.zetallegue.tms.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardDTO {

    private String fechaDesde;
    private String fechaHasta;
    private Kpis kpis;
    private ComparacionPeriodo comparacion;

    @Builder.Default
    private List<SerieNombreCantidad> porEstado = new ArrayList<>();
    @Builder.Default
    private List<SerieZona> porZona = new ArrayList<>();
    @Builder.Default
    private List<SerieChofer> porChofer = new ArrayList<>();
    @Builder.Default
    private List<SerieDia> porDia = new ArrayList<>();
    @Builder.Default
    private List<SerieNombreCantidad> porOrigen = new ArrayList<>();
    @Builder.Default
    private List<Alerta> alertas = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Kpis {
        private long total;
        private long entregados;
        private long enCamino;
        @JsonProperty("aRetirar")
        private long aRetirar;
        private long retirados;
        private long nadie;
        private long rechazados;
        private long cancelados;
        private long sinChofer;
        private long sinGeocode;
        private long cambiosDireccion;
        /** Entregados / (entregados + nadie + rechazados), 0–100. */
        private double tasaExito;
        private double codEsperado;
        private double costoEnvios;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ComparacionPeriodo {
        private String periodoAnteriorDesde;
        private String periodoAnteriorHasta;
        private long totalAnterior;
        private double tasaExitoAnterior;
        /** Variación % del volumen vs período anterior. */
        private Double deltaTotalPct;
        private Double deltaTasaExitoPp;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SerieNombreCantidad {
        private String nombre;
        private long cantidad;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SerieZona {
        private String nombre;
        private long total;
        private long entregados;
        private long fallidos;
        private double tasaExito;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SerieChofer {
        private Long id;
        private String nombre;
        private long total;
        private long entregados;
        private long enCamino;
        private long nadie;
        private long rechazados;
        private long cambiosDireccion;
        private double tasaExito;
        private double codEsperado;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SerieDia {
        private String fecha;
        private long total;
        private long entregados;
        private long fallidos;
        private long enCamino;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Alerta {
        /** critical | warning | info */
        private String severidad;
        private String codigo;
        private String titulo;
        private String detalle;
        private long cantidad;
    }
}
