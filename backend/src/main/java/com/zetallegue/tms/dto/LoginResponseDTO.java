package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponseDTO {
    private Boolean success;
    private String message;
    private UsuarioDTO usuario;
    private String token; // Para futura implementación de JWT si se necesita
}

