package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrganizacionDTO {
    private Long id;
    private String slug;
    private String nombre;
    private String logoUrl;
    private String colorPrimario;
}
