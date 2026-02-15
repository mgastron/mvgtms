package com.zetallegue.tms.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "zonas")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Zona {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo", length = 50)
    private String codigo;

    @Column(name = "nombre", length = 200)
    private String nombre;

    @Column(name = "cps", length = 1000)
    private String cps; // Códigos postales separados por comas o rangos (ej: "1000-1599" o "1000,1001,1002")

    @Column(name = "valor", length = 50)
    private String valor; // Precio como string

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lista_precios_id")
    private ListaPrecio listaPrecio;
}

