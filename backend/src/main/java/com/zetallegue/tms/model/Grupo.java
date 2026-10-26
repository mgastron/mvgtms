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
@Table(name = "grupos")
@EntityListeners(TenantEntityListener.class)
@Filter(name = "tenantFilter", condition = "organizacion_id = :organizacionId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Grupo implements TenantAware {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organizacion_id")
    private Long organizacionId;

    @Column(name = "nombre", nullable = false, length = 200)
    @NotBlank(message = "El nombre del grupo es obligatorio")
    private String nombre;
}
