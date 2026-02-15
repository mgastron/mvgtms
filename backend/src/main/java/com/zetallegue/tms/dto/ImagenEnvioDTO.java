package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImagenEnvioDTO {
    private Long id;
    private Long envioId;
    private String urlImagen;
    private LocalDateTime fecha;
    private String quien;
    private String tipo;
}

