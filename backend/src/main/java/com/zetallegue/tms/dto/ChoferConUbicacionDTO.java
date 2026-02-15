package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChoferConUbicacionDTO {
    private Long id;
    private String nombre;
    private String apellido;
    private String nombreCompleto;
    private Double latitud;
    private Double longitud;
    private LocalDateTime ultimaActualizacionUbicacion;
    private Integer bateria; // Porcentaje de batería (0-100)
    private Integer cantidadEnvios;
    private List<EnvioDTO> envios;
}

