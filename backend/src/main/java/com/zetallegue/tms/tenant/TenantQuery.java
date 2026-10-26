package com.zetallegue.tms.tenant;

import java.util.List;
import java.util.stream.Collectors;

public final class TenantQuery {

    private TenantQuery() {}

    public static <T extends TenantAware> List<T> ofCurrentOrg(List<T> items) {
        Long orgId = TenantContext.getOrganizacionId();
        if (orgId == null || items == null || items.isEmpty()) {
            return items;
        }
        return items.stream()
                .filter(item -> orgId.equals(item.getOrganizacionId()))
                .collect(Collectors.toList());
    }

    public static void assertCurrentOrg(Long entityOrgId) {
        Long current = TenantContext.getOrganizacionId();
        if (current != null && entityOrgId != null && !current.equals(entityOrgId)) {
            throw new RuntimeException("No encontrado");
        }
    }

    public static void assertCurrentOrg(TenantAware entity) {
        if (entity != null) {
            assertCurrentOrg(entity.getOrganizacionId());
        }
    }
}
