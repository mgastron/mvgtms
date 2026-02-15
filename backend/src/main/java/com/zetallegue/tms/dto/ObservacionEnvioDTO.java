package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ObservacionEnvioDTO {
    private Long id;
    private Long envioId;
    private String observacion;
    private LocalDateTime fecha;
    private String quien;
}

