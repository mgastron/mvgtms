package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.Organizacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrganizacionRepository extends JpaRepository<Organizacion, Long> {
    Optional<Organizacion> findBySlug(String slug);
    Optional<Organizacion> findBySlugAndHabilitadoTrue(String slug);
}
