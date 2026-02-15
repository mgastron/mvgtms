package com.zetallegue.tms.repository;

import com.zetallegue.tms.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByUsuario(String usuario);
    Optional<Usuario> findByUsuarioAndContraseña(String usuario, String contraseña);
    boolean existsByUsuario(String usuario);
    List<Usuario> findByPerfilAndHabilitadoTrueAndBloqueadoFalse(String perfil);
    List<Usuario> findAllById(Iterable<Long> ids);
}

