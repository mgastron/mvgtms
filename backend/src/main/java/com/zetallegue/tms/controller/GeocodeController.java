package com.zetallegue.tms.controller;

import com.zetallegue.tms.service.EnvioService;
import com.zetallegue.tms.service.GeocodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class GeocodeController {

    private final GeocodeService geocodeService;
    private final EnvioService envioService;

    @GetMapping("/geocode")
    public ResponseEntity<?> geocode(
            @RequestParam String direccion,
            @RequestParam(required = false) String localidad,
            @RequestParam(required = false) String codigoPostal,
            @RequestParam(required = false) String ambito
    ) {
        boolean amba = ambito != null && ambito.equalsIgnoreCase("amba");
        java.util.Optional<GeocodeService.Resultado> geo =
                geocodeService.geocodeDetallado(direccion, localidad, codigoPostal, amba);
        if (geo.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "No se encontró la dirección"));
        }
        GeocodeService.Resultado r = geo.get();
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("lat", r.lat);
        body.put("lng", r.lng);
        body.put("codigoPostal", r.codigoPostal == null ? "" : r.codigoPostal);
        body.put("localidad", r.localidad == null ? "" : r.localidad);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/envios/geocodificar-pendientes")
    public ResponseEntity<?> geocodificarPendientes(
            @RequestParam(defaultValue = "40") int limite
    ) {
        int n = envioService.geocodificarPendientes(Math.min(Math.max(limite, 1), 80));
        return ResponseEntity.ok(Map.of("geocodificados", n));
    }
}
