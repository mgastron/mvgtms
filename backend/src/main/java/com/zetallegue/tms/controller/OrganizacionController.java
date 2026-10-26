package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.OrganizacionDTO;
import com.zetallegue.tms.model.Organizacion;
import com.zetallegue.tms.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/organizaciones")
public class OrganizacionController {

    @GetMapping("/actual")
    public ResponseEntity<OrganizacionDTO> actual() {
        Organizacion org = TenantContext.get();
        if (org == null) {
            return ResponseEntity.notFound().build();
        }
        OrganizacionDTO dto = new OrganizacionDTO(
                org.getId(),
                org.getSlug(),
                org.getNombre(),
                org.getLogoUrl(),
                org.getColorPrimario()
        );
        return ResponseEntity.ok(dto);
    }
}
