package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioDTO {
    private Long id;
    private String nombre;
    private String apellido;
    private String usuario;
    private String contraseña;
    private String perfil;
    private String codigoCliente;
    private Boolean habilitado;
    private Boolean bloqueado;
    private Double latitud;
    private Double longitud;
    private LocalDateTime ultimaActualizacionUbicacion;
    private Integer bateria; // Porcentaje de batería (0-100)
}

