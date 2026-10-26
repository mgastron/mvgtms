package com.zetallegue.tms.model;

import com.zetallegue.tms.tenant.TenantAware;
import com.zetallegue.tms.tenant.TenantEntityListener;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Filter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "lista_precios")
@EntityListeners(TenantEntityListener.class)
@Filter(name = "tenantFilter", condition = "organizacion_id = :organizacionId")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ListaPrecio implements TenantAware {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organizacion_id")
    private Long organizacionId;

    @Column(name = "codigo", length = 50)
    private String codigo;

    @Column(name = "nombre", length = 200)
    private String nombre;

    @Column(name = "zona_propia", nullable = false)
    private Boolean zonaPropia = true;

    @OneToMany(mappedBy = "listaPrecio", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<Zona> zonas = new ArrayList<>();

    @Column(name = "lista_precio_seleccionada")
    private Long listaPrecioSeleccionada; // ID de otra lista de precios si zonaPropia = false
}

