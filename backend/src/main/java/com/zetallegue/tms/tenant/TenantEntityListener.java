package com.zetallegue.tms.tenant;

import jakarta.persistence.PrePersist;

public class TenantEntityListener {

    @PrePersist
    public void assignTenant(Object entity) {
        if (!(entity instanceof TenantAware tenantAware)) {
            return;
        }
        if (tenantAware.getOrganizacionId() != null) {
            return;
        }
        Long orgId = TenantContext.getOrganizacionId();
        if (orgId != null) {
            tenantAware.setOrganizacionId(orgId);
        }
    }
}
