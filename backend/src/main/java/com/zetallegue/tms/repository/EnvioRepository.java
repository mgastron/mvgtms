package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.Envio;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EnvioRepository extends JpaRepository<Envio, Long>, JpaSpecificationExecutor<Envio> {
    
    // Query optimizada para obtener envíos de la última semana (para caché)
    @Query("SELECT e FROM Envio e WHERE e.fecha >= :fechaDesde AND e.eliminado = false ORDER BY e.fecha DESC")
    List<Envio> findEnviosRecientes(@Param("fechaDesde") LocalDateTime fechaDesde, Pageable pageable);
    
    // Contar envíos de la última semana
    @Query("SELECT COUNT(e) FROM Envio e WHERE e.fecha >= :fechaDesde AND e.eliminado = false")
    Long countEnviosRecientes(@Param("fechaDesde") LocalDateTime fechaDesde);
    
    // Buscar por tracking (índice)
    Page<Envio> findByTrackingContainingIgnoreCaseAndEliminadoFalse(String tracking, Pageable pageable);
    
    // Buscar por cliente (índice)
    Page<Envio> findByClienteContainingIgnoreCaseAndEliminadoFalse(String cliente, Pageable pageable);
    
    // Buscar por QR data (solo envíos colectados y no eliminados - para vistas)
    Envio findByQrDataAndEliminadoFalse(String qrData);
    
    // Buscar por QR data sin filtrar por colectado (para permitir escanear envíos Flex no colectados)
    Envio findByQrDataAndEliminadoFalseAndColectadoTrue(String qrData);
    
    // Buscar por QR data sin filtrar por colectado (para el proceso de colectar)
    @Query("SELECT e FROM Envio e WHERE e.qrData = :qrData AND e.eliminado = false")
    Envio findByQrDataParaColectar(@Param("qrData") String qrData);
    
    // Buscar por tracking (para evitar duplicados)
    // Devuelve lista porque puede haber duplicados, tomamos el primero
    List<Envio> findByTrackingAndEliminadoFalse(String tracking);
    
    // Buscar envíos asignados a un chofer en estado específico (solo colectados o NULL)
    @Query("SELECT e FROM Envio e WHERE e.choferAsignadoId = :choferId AND e.estado = :estado AND e.eliminado = false AND (e.colectado = true OR e.colectado IS NULL)")
    List<Envio> findByChoferAsignadoIdAndEstadoAndEliminadoFalseAndColectadoTrue(@Param("choferId") Long choferAsignadoId, @Param("estado") String estado);
    
    // Obtener IDs únicos de choferes con envíos en estado específico (solo colectados o NULL)
    @Query("SELECT DISTINCT e.choferAsignadoId FROM Envio e WHERE e.estado = :estado AND e.eliminado = false AND (e.colectado = true OR e.colectado IS NULL) AND e.choferAsignadoId IS NOT NULL")
    List<Long> findChoferIdsConEnviosEnEstado(@Param("estado") String estado);
    
    // Contar envíos por chofer y fecha para cierre (solo colectados o NULL)
    @Query("SELECT e.choferAsignadoId, COUNT(e) FROM Envio e " +
           "WHERE e.estado = 'En camino al destinatario' " +
           "AND e.eliminado = false " +
           "AND (e.colectado = true OR e.colectado IS NULL) " +
           "AND CAST(e.fecha AS date) = :fecha " +
           "AND e.choferAsignadoId IS NOT NULL " +
           "AND (:soloFlex = false OR e.cliente LIKE '%Flex%' OR e.origen = 'Flex') " +
           "GROUP BY e.choferAsignadoId")
    List<Object[]> countEnviosPorChoferYFecha(@Param("fecha") LocalDate fecha, @Param("soloFlex") boolean soloFlex);
    
    // Obtener envíos Flex para polling (no eliminados, no en estados finales, con mlShipmentId)
    @Query("SELECT e FROM Envio e WHERE e.origen = 'Flex' " +
           "AND e.eliminado = false " +
           "AND e.mlShipmentId IS NOT NULL AND e.mlShipmentId != '' " +
           "AND e.estado NOT IN ('Entregado', 'Cancelado', 'Rechazado por el comprador')")
    List<Envio> findEnviosFlexParaPolling();
    
    // Buscar envío por mlShipmentId (para Flex)
    @Query("SELECT e FROM Envio e WHERE e.mlShipmentId = :mlShipmentId AND e.eliminado = false")
    java.util.Optional<Envio> findByMlShipmentId(@Param("mlShipmentId") String mlShipmentId);
    
    // Buscar envío por trackingToken (para link público)
    @Query("SELECT e FROM Envio e WHERE e.trackingToken = :trackingToken AND e.eliminado = false")
    List<Envio> findByTrackingTokenAndEliminadoFalse(@Param("trackingToken") String trackingToken);
    
    // Buscar envíos de Tienda Nube del mismo cliente con fecha de venta y destinatario similares (para evitar duplicados)
    @Query("SELECT e FROM Envio e WHERE e.origen = 'Tienda Nube' " +
           "AND e.eliminado = false " +
           "AND e.cliente = :cliente " +
           "AND e.fechaVenta >= :fechaDesde AND e.fechaVenta <= :fechaHasta " +
           "AND LOWER(TRIM(e.nombreDestinatario)) = LOWER(TRIM(:destinatario))")
    List<Envio> findEnviosTiendaNubeDuplicados(
        @Param("cliente") String cliente,
        @Param("fechaDesde") LocalDateTime fechaDesde,
        @Param("fechaHasta") LocalDateTime fechaHasta,
        @Param("destinatario") String destinatario
    );
    
    // Buscar envíos de Shopify del mismo cliente con fecha de venta y destinatario similares (para evitar duplicados)
    @Query("SELECT e FROM Envio e WHERE e.origen = 'Shopify' " +
           "AND e.eliminado = false " +
           "AND e.cliente = :cliente " +
           "AND e.fechaVenta >= :fechaDesde AND e.fechaVenta <= :fechaHasta " +
           "AND LOWER(TRIM(e.nombreDestinatario)) = LOWER(TRIM(:destinatario))")
    List<Envio> findEnviosShopifyDuplicados(
        @Param("cliente") String cliente,
        @Param("fechaDesde") LocalDateTime fechaDesde,
        @Param("fechaHasta") LocalDateTime fechaHasta,
        @Param("destinatario") String destinatario
    );
}

