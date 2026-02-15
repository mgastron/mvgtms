package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClienteFilterDTO {
    private String codigo;
    private String nombreFantasia;
    private String razonSocial;
    private String numeroDocumento;
    private String habilitado; // "todos", "habilitado", "deshabilitado"
    private String integraciones;
    private Integer page = 0;
    private Integer size = 10;
}

