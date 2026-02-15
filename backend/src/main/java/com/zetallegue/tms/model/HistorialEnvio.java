package com.zetallegue.tms.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "historial_envios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HistorialEnvio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "envio_id", nullable = false)
    private Long envioId;

    @Column(name = "estado", length = 100, nullable = false)
    private String estado;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha;

    @Column(name = "quien", length = 200)
    private String quien;

    @Column(name = "observaciones", length = 1000)
    private String observaciones;

    @Column(name = "origen", length = 10)
    private String origen; // "APP" o "WEB"
}

