package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.Grupo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GrupoRepository extends JpaRepository<Grupo, Long> {
    boolean existsByNombreIgnoreCase(String nombre);
}
