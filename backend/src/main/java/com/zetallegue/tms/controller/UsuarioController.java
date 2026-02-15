package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.LoginRequestDTO;
import com.zetallegue.tms.dto.LoginResponseDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.dto.UsuarioDTO;
import com.zetallegue.tms.service.EnvioService;
import com.zetallegue.tms.service.UsuarioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final EnvioService envioService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO loginRequest) {
        LoginResponseDTO response = usuarioService.login(loginRequest);
        if (response.getSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
    }

    @GetMapping
    public ResponseEntity<PageResponseDTO<UsuarioDTO>> obtenerUsuarios(
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "10") Integer size
    ) {
        Page<UsuarioDTO> usuarios = usuarioService.obtenerUsuarios(page, size);
        PageResponseDTO<UsuarioDTO> response = new PageResponseDTO<>(
                usuarios.getContent(),
                usuarios.getTotalPages(),
                usuarios.getTotalElements(),
                usuarios.getNumber(),
                usuarios.getSize()
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UsuarioDTO> obtenerUsuario(@PathVariable Long id) {
        UsuarioDTO usuario = usuarioService.obtenerUsuarioPorId(id);
        return ResponseEntity.ok(usuario);
    }

    @PostMapping
    public ResponseEntity<UsuarioDTO> crearUsuario(@Valid @RequestBody UsuarioDTO usuarioDTO) {
        UsuarioDTO usuario = usuarioService.crearUsuario(usuarioDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(usuario);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UsuarioDTO> actualizarUsuario(
            @PathVariable Long id,
            @Valid @RequestBody UsuarioDTO usuarioDTO
    ) {
        UsuarioDTO usuario = usuarioService.actualizarUsuario(id, usuarioDTO);
        return ResponseEntity.ok(usuario);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarUsuario(@PathVariable Long id) {
        usuarioService.eliminarUsuario(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/choferes")
    public ResponseEntity<List<UsuarioDTO>> obtenerChoferes() {
        List<UsuarioDTO> choferes = usuarioService.obtenerChoferes();
        return ResponseEntity.ok(choferes);
    }

    @PutMapping("/{id}/ubicacion")
    public ResponseEntity<UsuarioDTO> actualizarUbicacion(
            @PathVariable Long id,
            @RequestBody UbicacionRequest request
    ) {
        UsuarioDTO usuario = usuarioService.actualizarUbicacion(id, request.getLatitud(), request.getLongitud(), request.getBateria());
        return ResponseEntity.ok(usuario);
    }

    // Clase interna para el request body
    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    static class UbicacionRequest {
        private Double latitud;
        private Double longitud;
        private Integer bateria;
    }

    @GetMapping("/choferes-con-envios")
    public ResponseEntity<List<com.zetallegue.tms.dto.ChoferConUbicacionDTO>> obtenerChoferesConEnvios() {
        List<com.zetallegue.tms.dto.ChoferConUbicacionDTO> choferes = envioService.obtenerChoferesConEnviosAsignados();
        return ResponseEntity.ok(choferes);
    }
}

