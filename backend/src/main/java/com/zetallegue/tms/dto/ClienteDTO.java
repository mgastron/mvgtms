package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClienteDTO {
    private Long id;
    private String codigo;
    private String nombreFantasia;
    private String razonSocial;
    private String numeroDocumento;
    private Boolean habilitado;
    private String integraciones;
    private String flexIdVendedor;
    private String flexUsername;
    private String flexAccessToken;
    private String flexRefreshToken;
    private java.time.LocalDateTime flexTokenExpiresAt;
    private String tiendanubeUrl;
    private String tiendanubeAccessToken;
    private String tiendanubeRefreshToken;
    private java.time.LocalDateTime tiendanubeTokenExpiresAt;
    private String tiendanubeStoreId;
    private String tiendanubeMetodoEnvio;
    private String shopifyUrl;
    private String shopifyClaveUnica;
    private String shopifyMetodoEnvio;
    private String vtexUrl;
    private String vtexKey;
    private String vtexToken;
    private String vtexIdLogistica;
    private Long listaPreciosId;
}

