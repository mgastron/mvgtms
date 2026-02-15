package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.ListaPrecio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ListaPrecioRepository extends JpaRepository<ListaPrecio, Long> {
    Optional<ListaPrecio> findById(Long id);
}

