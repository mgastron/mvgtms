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
    private LocalDateTime fechaAdjudicacion;
    private LocalDateTime fechaDespacho;
    private LocalDateTime fechaRetiro;
    private LocalDateTime fechaAPlanta;
    private LocalDateTime fechaCancelado;
    private LocalDateTime fechaUltimoMovimiento;
    private String origen;
    private String tracking;
    /** ID_NX: código alfanumérico único (API/columna idMvg); usado para búsqueda/filtro. */
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
    private Long choferAdjudicadoId;
    private String choferAdjudicadoNombre;
    private String rolRecibio;
    private String nombreRecibio;
    private String dniRecibio;
    private Boolean retirado;
    private String costoEnvio;
    private String idml;
    private String peso;
    private String metodoEnvio;
    private LocalDateTime deadline;
    private String mlShipmentId;
    private String trackingToken;
    /** Latitud del destino (geolocalización desde app chofer). */
    private Double latDestino;
    /** Longitud del destino (geolocalización desde app chofer). */
    private Double lngDestino;
    /** Ubicación del chofer al marcar Entregado. */
    private Double latEntrega;
    private Double lngEntrega;
    private String direccionEntrega;
}

