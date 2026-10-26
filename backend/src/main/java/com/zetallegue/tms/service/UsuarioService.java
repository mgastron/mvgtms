package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.LoginRequestDTO;
import com.zetallegue.tms.dto.LoginResponseDTO;
import com.zetallegue.tms.dto.UsuarioDTO;
import com.zetallegue.tms.model.Organizacion;
import com.zetallegue.tms.model.Usuario;
import com.zetallegue.tms.repository.OrganizacionRepository;
import com.zetallegue.tms.repository.UsuarioRepository;
import com.zetallegue.tms.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final OrganizacionRepository organizacionRepository;

    public LoginResponseDTO login(LoginRequestDTO loginRequest) {
        Long orgId = TenantContext.getOrganizacionId();
        Usuario usuario = orgId != null
                ? usuarioRepository.findByOrganizacionIdAndUsuarioAndContraseña(
                        orgId, loginRequest.getUsuario(), loginRequest.getContraseña()).orElse(null)
                : usuarioRepository.findByUsuarioAndContraseña(
                        loginRequest.getUsuario(), loginRequest.getContraseña()).orElse(null);

        if (usuario == null) {
            return new LoginResponseDTO(false, "Usuario o contraseña incorrectos", null, null);
        }

        if (!usuario.getHabilitado()) {
            return new LoginResponseDTO(false, "Usuario deshabilitado", null, null);
        }

        if (usuario.getBloqueado()) {
            return new LoginResponseDTO(false, "Usuario bloqueado", null, null);
        }

        // Validar que usuarios tipo "Cliente" no puedan usar la app móvil
        if ("Cliente".equals(usuario.getPerfil())) {
            return new LoginResponseDTO(false, "Los usuarios tipo Cliente deben iniciar sesión a través de la web", null, null);
        }

        UsuarioDTO usuarioDTO = toDTO(usuario);
        return new LoginResponseDTO(true, "Login exitoso", usuarioDTO, null);
    }

    public Page<UsuarioDTO> obtenerUsuarios(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Long orgId = TenantContext.getOrganizacionId();
        Page<Usuario> usuarios = orgId != null
                ? usuarioRepository.findByOrganizacionId(orgId, pageable)
                : usuarioRepository.findAll(pageable);
        return usuarios.map(this::toDTO);
    }

    public UsuarioDTO obtenerUsuarioPorId(Long id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        com.zetallegue.tms.tenant.TenantQuery.assertCurrentOrg(usuario.getOrganizacionId());
        return toDTO(usuario);
    }

    @Transactional
    public UsuarioDTO crearUsuario(UsuarioDTO usuarioDTO) {
        if (usuarioExisteEnOrg(usuarioDTO.getUsuario())) {
            throw new RuntimeException("El usuario ya existe");
        }
        Usuario usuario = toEntity(usuarioDTO);
        usuario = usuarioRepository.save(usuario);
        return toDTO(usuario);
    }

    @Transactional
    public UsuarioDTO actualizarUsuario(Long id, UsuarioDTO usuarioDTO) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        
        // Verificar si el usuario cambió y si ya existe
        if (!usuario.getUsuario().equals(usuarioDTO.getUsuario()) &&
            usuarioExisteEnOrg(usuarioDTO.getUsuario())) {
            throw new RuntimeException("El usuario ya existe");
        }

        usuario.setNombre(usuarioDTO.getNombre());
        usuario.setApellido(usuarioDTO.getApellido());
        usuario.setUsuario(usuarioDTO.getUsuario());
        usuario.setContraseña(usuarioDTO.getContraseña());
        usuario.setPerfil(usuarioDTO.getPerfil());
        usuario.setCodigoCliente(usuarioDTO.getCodigoCliente());
        usuario.setGrupoId(usuarioDTO.getGrupoId());
        usuario.setHabilitado(usuarioDTO.getHabilitado());
        usuario.setBloqueado(usuarioDTO.getBloqueado());

        usuario = usuarioRepository.save(usuario);
        return toDTO(usuario);
    }

    @Transactional
    public void eliminarUsuario(Long id) {
        usuarioRepository.deleteById(id);
    }

    public List<UsuarioDTO> obtenerChoferes() {
        Long orgId = TenantContext.getOrganizacionId();
        List<Usuario> choferes = orgId != null
                ? usuarioRepository.findByOrganizacionIdAndPerfilAndHabilitadoTrueAndBloqueadoFalse(orgId, "Chofer")
                : usuarioRepository.findByPerfilAndHabilitadoTrueAndBloqueadoFalse("Chofer");
        return choferes.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public UsuarioDTO actualizarUbicacion(Long choferId, Double latitud, Double longitud, Integer bateria) {
        Usuario chofer = usuarioRepository.findById(choferId)
                .orElseThrow(() -> new RuntimeException("Chofer no encontrado"));
        
        if (!"Chofer".equals(chofer.getPerfil())) {
            throw new RuntimeException("El usuario no es un chofer");
        }
        
        chofer.setLatitud(latitud);
        chofer.setLongitud(longitud);
        if (bateria != null) {
            chofer.setBateria(bateria);
        }
        chofer.setUltimaActualizacionUbicacion(java.time.LocalDateTime.now());
        
        chofer = usuarioRepository.save(chofer);
        return toDTO(chofer);
    }

    private UsuarioDTO toDTO(Usuario usuario) {
        UsuarioDTO dto = new UsuarioDTO();
        dto.setId(usuario.getId());
        dto.setNombre(usuario.getNombre());
        dto.setApellido(usuario.getApellido());
        dto.setUsuario(usuario.getUsuario());
        dto.setContraseña(usuario.getContraseña());
        dto.setPerfil(usuario.getPerfil());
        dto.setCodigoCliente(usuario.getCodigoCliente());
        dto.setGrupoId(usuario.getGrupoId());
        dto.setHabilitado(usuario.getHabilitado());
        dto.setBloqueado(usuario.getBloqueado());
        dto.setLatitud(usuario.getLatitud());
        dto.setLongitud(usuario.getLongitud());
        dto.setUltimaActualizacionUbicacion(usuario.getUltimaActualizacionUbicacion());
        dto.setBateria(usuario.getBateria());
        dto.setOrganizacionId(usuario.getOrganizacionId());
        Organizacion org = TenantContext.get();
        if (org == null && usuario.getOrganizacionId() != null) {
            org = organizacionRepository.findById(usuario.getOrganizacionId()).orElse(null);
        }
        if (org != null) {
            dto.setOrganizacionSlug(org.getSlug());
            dto.setOrganizacionNombre(org.getNombre());
        }
        return dto;
    }

    private boolean usuarioExisteEnOrg(String usuario) {
        Long orgId = TenantContext.getOrganizacionId();
        if (orgId != null) {
            return usuarioRepository.existsByOrganizacionIdAndUsuario(orgId, usuario);
        }
        return usuarioRepository.existsByUsuario(usuario);
    }

    private Usuario toEntity(UsuarioDTO dto) {
        Usuario usuario = new Usuario();
        usuario.setOrganizacionId(dto.getOrganizacionId() != null ? dto.getOrganizacionId() : TenantContext.getOrganizacionId());
        usuario.setId(dto.getId());
        usuario.setNombre(dto.getNombre());
        usuario.setApellido(dto.getApellido());
        usuario.setUsuario(dto.getUsuario());
        usuario.setContraseña(dto.getContraseña());
        usuario.setPerfil(dto.getPerfil());
        usuario.setCodigoCliente(dto.getCodigoCliente());
        usuario.setGrupoId(dto.getGrupoId());
        usuario.setHabilitado(dto.getHabilitado() != null ? dto.getHabilitado() : true);
        usuario.setBloqueado(dto.getBloqueado() != null ? dto.getBloqueado() : false);
        usuario.setLatitud(dto.getLatitud());
        usuario.setLongitud(dto.getLongitud());
        usuario.setUltimaActualizacionUbicacion(dto.getUltimaActualizacionUbicacion());
        usuario.setBateria(dto.getBateria());
        return usuario;
    }
}

