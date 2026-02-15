package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChoferCierreDTO {
    private Long id;
    private String nombreCompleto;
    private Long cantidadEnvios;
}

