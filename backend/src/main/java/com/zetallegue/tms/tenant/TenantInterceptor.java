package com.zetallegue.tms.tenant;

import com.zetallegue.tms.model.Organizacion;
import com.zetallegue.tms.repository.OrganizacionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.Session;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
@Slf4j
public class TenantInterceptor implements HandlerInterceptor {

    private final OrganizacionRepository organizacionRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String slug = TenantResolver.resolveSlug(request);
        Organizacion org = organizacionRepository.findBySlugAndHabilitadoTrue(slug).orElse(null);
        if (org == null) {
            log.warn("Organización no encontrada para slug '{}' ({} {})", slug, request.getMethod(), request.getRequestURI());
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"Organización no encontrada\"}");
            return false;
        }

        TenantContext.set(org);
        try {
            Session session = entityManager.unwrap(Session.class);
            session.enableFilter("tenantFilter").setParameter("organizacionId", org.getId());
        } catch (Exception e) {
            log.warn("No se pudo activar tenantFilter para '{}': {}", slug, e.getMessage());
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        TenantContext.clear();
    }
}
