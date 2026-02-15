package com.zetallegue.tms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "clientes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo", unique = true, nullable = false, length = 50)
    @NotBlank(message = "El código es obligatorio")
    private String codigo;

    @Column(name = "nombre_fantasia", length = 200)
    private String nombreFantasia;

    @Column(name = "razon_social", length = 200)
    private String razonSocial;

    @Column(name = "numero_documento", length = 50)
    private String numeroDocumento;

    @Column(name = "habilitado", nullable = false)
    private Boolean habilitado = true;

    @Column(name = "integraciones", length = 500)
    private String integraciones;

    @Column(name = "flex_id_vendedor", length = 100)
    private String flexIdVendedor;

    @Column(name = "flex_username", length = 100)
    private String flexUsername;

    @Column(name = "flex_access_token", length = 1000)
    private String flexAccessToken;

    @Column(name = "flex_refresh_token", length = 1000)
    private String flexRefreshToken;

    @Column(name = "flex_token_expires_at")
    private java.time.LocalDateTime flexTokenExpiresAt;

    @Column(name = "tiendanube_url", length = 500)
    private String tiendanubeUrl;

    // Tokens de Tienda Nube (OAuth)
    @Column(name = "tiendanube_access_token", length = 1000)
    private String tiendanubeAccessToken;

    @Column(name = "tiendanube_refresh_token", length = 1000)
    private String tiendanubeRefreshToken;

    @Column(name = "tiendanube_token_expires_at")
    private java.time.LocalDateTime tiendanubeTokenExpiresAt;

    // ID de la tienda en Tienda Nube (se obtiene después de la vinculación)
    @Column(name = "tiendanube_store_id", length = 100)
    private String tiendanubeStoreId;

    // Método de envío configurado en Tienda Nube
    @Column(name = "tiendanube_metodo_envio", length = 200)
    private String tiendanubeMetodoEnvio;

    @Column(name = "shopify_url", length = 500)
    private String shopifyUrl;

    @Column(name = "shopify_clave_unica", length = 200)
    private String shopifyClaveUnica;

    // Método de envío configurado en Shopify
    @Column(name = "shopify_metodo_envio", length = 200)
    private String shopifyMetodoEnvio;

    @Column(name = "vtex_url", length = 500)
    private String vtexUrl;

    @Column(name = "vtex_key", length = 200)
    private String vtexKey;

    @Column(name = "vtex_token", length = 500)
    private String vtexToken;

    @Column(name = "vtex_id_logistica", length = 100)
    private String vtexIdLogistica;

    @Column(name = "lista_precios_id")
    private Long listaPreciosId;
}

