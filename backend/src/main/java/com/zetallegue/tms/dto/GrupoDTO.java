package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GrupoDTO {
    private Long id;
    private String nombre;
    /** Clientes asignados a este grupo (solo para lectura en listado/detalle) */
    private List<ClienteDTO> clientes;
}
