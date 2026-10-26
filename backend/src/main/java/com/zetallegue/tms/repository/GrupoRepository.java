package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.Grupo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrupoRepository extends JpaRepository<Grupo, Long> {
    boolean existsByNombreIgnoreCase(String nombre);
    List<Grupo> findByOrganizacionId(Long organizacionId);
}
