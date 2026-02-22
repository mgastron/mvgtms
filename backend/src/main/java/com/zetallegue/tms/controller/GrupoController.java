package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.GrupoDTO;
import com.zetallegue.tms.service.GrupoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/grupos")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class GrupoController {

    private final GrupoService grupoService;

    @GetMapping
    public ResponseEntity<List<GrupoDTO>> listar() {
        return ResponseEntity.ok(grupoService.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GrupoDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(grupoService.obtenerPorId(id));
    }

    @PostMapping
    public ResponseEntity<GrupoDTO> crear(@Valid @RequestBody GrupoDTO dto) {
        GrupoDTO creado = grupoService.crear(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    @PutMapping("/{id}")
    public ResponseEntity<GrupoDTO> actualizarNombre(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String nombre = body != null ? body.get("nombre") : null;
        return ResponseEntity.ok(grupoService.actualizarNombre(id, nombre));
    }
}
