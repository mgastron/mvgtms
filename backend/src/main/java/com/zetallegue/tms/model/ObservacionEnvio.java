package com.zetallegue.tms.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "observaciones_envios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ObservacionEnvio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "envio_id", nullable = false)
    private Long envioId;

    @Column(name = "observacion", length = 1000, nullable = false)
    private String observacion;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha;

    @Column(name = "quien", length = 200, nullable = false)
    private String quien;
}

