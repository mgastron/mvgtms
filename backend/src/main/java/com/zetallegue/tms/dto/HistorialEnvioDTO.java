package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HistorialEnvioDTO {
    private Long id;
    private Long envioId;
    private String estado;
    private LocalDateTime fecha;
    private String quien;
    private String observaciones;
    private String origen; // "APP" o "WEB"
}

