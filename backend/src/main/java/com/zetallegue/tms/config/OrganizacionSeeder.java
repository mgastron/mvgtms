package com.zetallegue.tms.config;

import com.zetallegue.tms.model.Organizacion;
import com.zetallegue.tms.model.Usuario;
import com.zetallegue.tms.repository.OrganizacionRepository;
import com.zetallegue.tms.repository.UsuarioRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class OrganizacionSeeder implements ApplicationRunner {

    public static final String NEXO_SLUG = "nexo";
    public static final String LDP_SLUG = "mensajerialdp";
    public static final String LDP_ADMIN_USER = "admin";
    public static final String LDP_ADMIN_PASSWORD = "Ldp2026";

    private final OrganizacionRepository organizacionRepository;
    private final UsuarioRepository usuarioRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Organizacion nexo = ensureOrg(
                NEXO_SLUG,
                "Nexo",
                "/logos/nexo-logo-white.png",
                "#1459e9"
        );
        Organizacion ldp = ensureOrg(
                LDP_SLUG,
                "Mensajería LDP",
                "/tenants/mensajerialdp/logo.jpg",
                "#0A2A6B"
        );

        dropLegacyUniques();
        assignExistingRows(nexo.getId());
        seedLdpAdmin(ldp);
        log.info("Tenants listos: nexo id={}, mensajerialdp id={}", nexo.getId(), ldp.getId());
    }

    private Organizacion ensureOrg(String slug, String nombre, String logoUrl, String color) {
        return organizacionRepository.findBySlug(slug).map(existing -> {
            boolean dirty = false;
            if (existing.getNombre() == null || existing.getNombre().isBlank()) {
                existing.setNombre(nombre);
                dirty = true;
            }
            if (existing.getLogoUrl() == null || existing.getLogoUrl().isBlank()) {
                existing.setLogoUrl(logoUrl);
                dirty = true;
            }
            if (existing.getColorPrimario() == null || existing.getColorPrimario().isBlank()) {
                existing.setColorPrimario(color);
                dirty = true;
            }
            if (existing.getHabilitado() == null) {
                existing.setHabilitado(true);
                dirty = true;
            }
            return dirty ? organizacionRepository.save(existing) : existing;
        }).orElseGet(() -> {
            Organizacion org = new Organizacion();
            org.setSlug(slug);
            org.setNombre(nombre);
            org.setLogoUrl(logoUrl);
            org.setColorPrimario(color);
            org.setHabilitado(true);
            return organizacionRepository.save(org);
        });
    }

    private void dropLegacyUniques() {
        executeQuiet("ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS uk_usuarios_usuario");
        executeQuiet("ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_usuario_key");
        executeQuiet("ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_codigo_key");
        executeQuiet("ALTER TABLE clientes DROP CONSTRAINT IF EXISTS uk_clientes_codigo");
    }

    private void assignExistingRows(Long nexoId) {
        updateIfColumnExists("usuarios", nexoId);
        updateIfColumnExists("clientes", nexoId);
        updateIfColumnExists("grupos", nexoId);
        updateIfColumnExists("envios", nexoId);
        updateIfColumnExists("lista_precios", nexoId);
    }

    private void updateIfColumnExists(String table, Long nexoId) {
        executeQuiet("UPDATE " + table + " SET organizacion_id = " + nexoId + " WHERE organizacion_id IS NULL");
    }

    private void seedLdpAdmin(Organizacion ldp) {
        if (usuarioRepository.existsByOrganizacionIdAndUsuario(ldp.getId(), LDP_ADMIN_USER)) {
            return;
        }
        Usuario admin = new Usuario();
        admin.setNombre("Administrador");
        admin.setApellido("LDP");
        admin.setUsuario(LDP_ADMIN_USER);
        admin.setContraseña(LDP_ADMIN_PASSWORD);
        admin.setPerfil("Administrativo");
        admin.setHabilitado(true);
        admin.setBloqueado(false);
        admin.setOrganizacionId(ldp.getId());
        usuarioRepository.save(admin);
        log.info("Usuario admin de Mensajería LDP creado");
    }

    private void executeQuiet(String sql) {
        try {
            entityManager.createNativeQuery(sql).executeUpdate();
        } catch (Exception e) {
            log.debug("SQL opcional ignorado ({}): {}", sql, e.getMessage());
        }
    }
}
