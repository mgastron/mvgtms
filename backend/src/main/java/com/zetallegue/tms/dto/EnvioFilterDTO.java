package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnvioFilterDTO {
    private Integer page = 0;
    private Integer size = 50;
    private String tipoFecha;
    private String fechaDesde;
    private String fechaHasta;
    private String estado;
    private String origen;
    private String tracking;
    private String idVenta;
    private String logisticaInversa;
    private String domicilio;
    private String zonasEntrega;
    private String envioTurbo;
    private String fotos;
    private String asignado;
    private String nombreFantasia;
    private String destinoNombre;
    private String destinoDireccion;
    private String cobranzas;
    private String codigoCliente; // Para filtrar por cliente cuando el usuario es "Cliente"
    private Long choferId; // Para filtrar por chofer asignado cuando el usuario es "Chofer"
}

