package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.ChoferCierreDTO;
import com.zetallegue.tms.service.EnvioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/ruteate")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class RuteateController {

    private final EnvioService envioService;

    @GetMapping("/cierre")
    public ResponseEntity<List<ChoferCierreDTO>> obtenerChoferesCierre(
            @RequestParam(defaultValue = "false") boolean soloFlex) {
        // Siempre usar la fecha actual
        LocalDate fecha = LocalDate.now();
        List<ChoferCierreDTO> choferes = envioService.obtenerChoferesCierre(fecha, soloFlex);
        return ResponseEntity.ok(choferes);
    }
}

