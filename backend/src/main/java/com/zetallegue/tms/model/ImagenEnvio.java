package com.zetallegue.tms.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "imagenes_envios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImagenEnvio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "envio_id", nullable = false)
    private Long envioId;

    @Lob
    @Column(name = "url_imagen", nullable = false, columnDefinition = "CLOB")
    private String urlImagen;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha;

    @Column(name = "quien", length = 200)
    private String quien;

    @Column(name = "tipo", length = 50)
    private String tipo; // "nadie_en_domicilio", "otro", etc.
}

