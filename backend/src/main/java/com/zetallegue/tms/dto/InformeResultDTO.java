package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Resultado de la generación de un informe: contenido del archivo y nombre sugerido para la descarga.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InformeResultDTO {
    private byte[] contenido;
    private String nombreArchivo;
}
