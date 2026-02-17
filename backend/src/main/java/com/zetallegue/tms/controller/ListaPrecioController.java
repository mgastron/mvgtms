package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.ListaPrecioDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.service.ListaPrecioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/lista-precios")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ListaPrecioController {

    private final ListaPrecioService listaPrecioService;

    @GetMapping
    public ResponseEntity<PageResponseDTO<ListaPrecioDTO>> obtenerTodasLasListasPrecios(
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "10") Integer size
    ) {
        PageResponseDTO<ListaPrecioDTO> response = listaPrecioService.obtenerTodasLasListasPrecios(page, size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ListaPrecioDTO> obtenerListaPrecio(@PathVariable Long id) {
        try {
            ListaPrecioDTO listaPrecio = listaPrecioService.obtenerListaPrecioPorId(id);
            return ResponseEntity.ok(listaPrecio);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<ListaPrecioDTO> crearListaPrecio(@RequestBody ListaPrecioDTO dto) {
        ListaPrecioDTO creada = listaPrecioService.crearListaPrecio(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ListaPrecioDTO> actualizarListaPrecio(
            @PathVariable Long id,
            @RequestBody ListaPrecioDTO dto
    ) {
        try {
            ListaPrecioDTO actualizada = listaPrecioService.actualizarListaPrecio(id, dto);
            return ResponseEntity.ok(actualizada);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}

