package com.zetallegue.tms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "grupos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Grupo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", nullable = false, length = 200)
    @NotBlank(message = "El nombre del grupo es obligatorio")
    private String nombre;
}
