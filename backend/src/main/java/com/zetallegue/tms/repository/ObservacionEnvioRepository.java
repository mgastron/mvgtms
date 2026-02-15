package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.ObservacionEnvio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ObservacionEnvioRepository extends JpaRepository<ObservacionEnvio, Long> {
    List<ObservacionEnvio> findByEnvioIdOrderByFechaDesc(Long envioId);
}

