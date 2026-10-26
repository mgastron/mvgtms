package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChoferHistorialDTO {
    private int entregados;
    private int rechazados;
    private int nadie;
    private List<DiaHistorialDTO> dias = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiaHistorialDTO {
        /** YYYY-MM-DD */
        private String fecha;
        private int entregados;
        private int rechazados;
        private int nadie;
        private List<PedidoHistorialDTO> pedidos = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PedidoHistorialDTO {
        private Long id;
        private String tracking;
        private String direccion;
        private String estado;
        /** Resultado legible: Entregado / Rechazado / Nadie en domicilio */
        private String resultado;
        private String fechaResultado;
    }
}
