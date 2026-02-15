package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClienteRepository extends JpaRepository<Cliente, Long>, JpaSpecificationExecutor<Cliente> {
    Optional<Cliente> findByCodigo(String codigo);
    boolean existsByCodigo(String codigo);
    Optional<Cliente> findByFlexIdVendedor(String flexIdVendedor);
    List<Cliente> findByTiendanubeAccessTokenIsNotNull();
    List<Cliente> findByVtexKeyIsNotNull();
}

