package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.HistorialEnvio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HistorialEnvioRepository extends JpaRepository<HistorialEnvio, Long> {
    List<HistorialEnvio> findByEnvioIdOrderByFechaDesc(Long envioId);
}

