package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.ImagenEnvio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ImagenEnvioRepository extends JpaRepository<ImagenEnvio, Long> {
    List<ImagenEnvio> findByEnvioIdOrderByFechaDesc(Long envioId);
}

