package com.zetallegue.tms.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

@Entity
@Table(name = "organizaciones", uniqueConstraints = {
        @UniqueConstraint(name = "uk_organizaciones_slug", columnNames = "slug")
})
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "organizacionId", type = org.hibernate.type.descriptor.java.LongJavaType.class))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Organizacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "slug", nullable = false, length = 80)
    private String slug;

    @Column(name = "nombre", nullable = false, length = 200)
    private String nombre;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "color_primario", length = 20)
    private String colorPrimario;

    @Column(name = "habilitado", nullable = false)
    private Boolean habilitado = true;
}
