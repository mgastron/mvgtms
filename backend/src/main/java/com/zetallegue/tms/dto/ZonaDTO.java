package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ZonaDTO {
    private String id;
    private String codigo;
    private String nombre;
    private String cps;
    private String valor;
}

