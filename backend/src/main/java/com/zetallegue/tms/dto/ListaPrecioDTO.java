package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ListaPrecioDTO {
    private Long id;
    private String codigo;
    private String nombre;
    private Boolean zonaPropia;
    private List<ZonaDTO> zonas;
    private String listaPrecioSeleccionada; // String para compatibilidad con frontend
}

