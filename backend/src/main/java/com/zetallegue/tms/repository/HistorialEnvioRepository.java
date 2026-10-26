package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.HistorialEnvio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface HistorialEnvioRepository extends JpaRepository<HistorialEnvio, Long> {
    List<HistorialEnvio> findByEnvioIdOrderByFechaDesc(Long envioId);

    @Query("SELECT h FROM HistorialEnvio h WHERE h.estado = :estado AND h.fecha >= :desde AND h.fecha <= :hasta ORDER BY h.fecha DESC")
    List<HistorialEnvio> findByEstadoAndFechaBetween(
        @Param("estado") String estado,
        @Param("desde") LocalDateTime desde,
        @Param("hasta") LocalDateTime hasta
    );
}

