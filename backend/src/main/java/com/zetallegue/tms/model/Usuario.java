package com.zetallegue.tms.model;

import com.zetallegue.tms.tenant.TenantAware;
import com.zetallegue.tms.tenant.TenantEntityListener;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

@Entity
@Table(name = "usuarios", uniqueConstraints = {
        @UniqueConstraint(name = "uk_usuarios_org_usuario", columnNames = {"organizacion_id", "usuario"})
})
@EntityListeners(TenantEntityListener.class)
@Filter(name = "tenantFilter", condition = "organizacion_id = :organizacionId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Usuario implements TenantAware {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organizacion_id")
    private Long organizacionId;

    @Column(name = "nombre", length = 100)
    private String nombre;

    @Column(name = "apellido", length = 100)
    private String apellido;

    @Column(name = "usuario", nullable = false, length = 100)
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

    /** Vendedor (perfil Cliente): acceso a todo el grupo; el front filtra por vendedor elegido. */
    @Column(name = "grupo_id")
    private Long grupoId;

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

