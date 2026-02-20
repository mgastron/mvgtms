package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnvioDTO {
    private Long id;
    private LocalDateTime fecha;
    private LocalDateTime fechaVenta;
    private LocalDateTime fechaLlegue;
    private LocalDateTime fechaEntregado;
    private LocalDateTime fechaAsignacion;
    private LocalDateTime fechaDespacho;
    private LocalDateTime fechaColecta;
    private LocalDateTime fechaAPlanta;
    private LocalDateTime fechaCancelado;
    private LocalDateTime fechaUltimoMovimiento;
    private String origen;
    private String tracking;
    /** ID_MVG: código alfanumérico único generado por MVG; usado para búsqueda/filtro. */
    private String idMvg;
    private String cliente;
    private String direccion;
    private String nombreDestinatario;
    private String telefono;
    private String email;
    private String impreso;
    private String observaciones;
    private String totalACobrar;
    private String cambioRetiro;
    private String localidad;
    private String codigoPostal;
    private String zonaEntrega;
    private String qrData;
    private String estado;
    private Boolean eliminado;
    private Long choferAsignadoId;
    private String choferAsignadoNombre;
    private String rolRecibio;
    private String nombreRecibio;
    private String dniRecibio;
    private Boolean colectado;
    private String costoEnvio;
    private String idml;
    private String peso;
    private String metodoEnvio;
    private LocalDateTime deadline;
    private String mlShipmentId;
    private String trackingToken;
}

