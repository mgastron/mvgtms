package com.zetallegue.tms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", length = 100)
    private String nombre;

    @Column(name = "apellido", length = 100)
    private String apellido;

    @Column(name = "usuario", unique = true, nullable = false, length = 100)
    @NotBlank(message = "El usuario es obligatorio")
    private String usuario;

    @Column(name = "contraseña", nullable = false, length = 255)
    @NotBlank(message = "La contraseña es obligatoria")
    private String contraseña;

    @Column(name = "perfil", nullable = false, length = 50)
    @NotBlank(message = "El perfil es obligatorio")
    private String perfil; // Administrativo, Cliente, Chofer, Coordinador, Logística Externa

    @Column(name = "codigo_cliente", length = 50)
    private String codigoCliente;

    @Column(name = "habilitado", nullable = false)
    private Boolean habilitado = true;

    @Column(name = "bloqueado", nullable = false)
    private Boolean bloqueado = false;

    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    @Column(name = "ultima_actualizacion_ubicacion")
    private java.time.LocalDateTime ultimaActualizacionUbicacion;

    @Column(name = "bateria")
    private Integer bateria; // Porcentaje de batería (0-100)
}

