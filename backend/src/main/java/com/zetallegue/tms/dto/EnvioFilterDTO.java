package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnvioFilterDTO {
    private Integer page = 0;
    private Integer size = 50;
    private String tipoFecha;
    private String fechaDesde;
    private String fechaHasta;
    /** Compat: un solo estado. Preferir {@link #estados}. */
    private String estado;
    /** Varios estados (OR). Vacío / null = sin filtro de estado (salvo eliminados). */
    private List<String> estados;
    /** Compat: un solo origen. Preferir {@link #origenes}. */
    private String origen;
    /** Varios orígenes (OR). */
    private List<String> origenes;
    private String tracking;
    private String idVenta;
    private String logisticaInversa;
    private String domicilio;
    private String zonasEntrega;
    private String envioTurbo;
    private String fotos;
    private String adjudicado;
    /** Compat: un vendedor. Preferir {@link #nombresFantasia}. */
    private String nombreFantasia;
    /** Varios vendedores / nombres fantasía (OR). */
    private List<String> nombresFantasia;
    /** Compat: un grupo. Preferir {@link #grupoIds}. */
    private Long grupoId;
    /** Varios grupos (OR). */
    private List<Long> grupoIds;
    private String destinoNombre;
    private String destinoDireccion;
    /** Filtro por columna código postal (no usa el texto de {@code direccion}). */
    private String codigoPostal;
    private String cobranzas;
    private String codigoCliente; // Para filtrar por cliente cuando el usuario es "Cliente"
    private Long choferId; // Para filtrar por chofer adjudicado cuando el usuario es "Chofer"
}
