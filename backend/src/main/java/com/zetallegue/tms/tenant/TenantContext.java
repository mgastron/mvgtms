package com.zetallegue.tms.tenant;

import com.zetallegue.tms.model.Organizacion;

public final class TenantContext {

    private static final ThreadLocal<Organizacion> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(Organizacion organizacion) {
        CURRENT.set(organizacion);
    }

    public static Organizacion get() {
        return CURRENT.get();
    }

    public static Long getOrganizacionId() {
        Organizacion org = CURRENT.get();
        return org != null ? org.getId() : null;
    }

    public static String getSlug() {
        Organizacion org = CURRENT.get();
        return org != null ? org.getSlug() : null;
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static void runAs(Organizacion organizacion, Runnable action) {
        Organizacion previous = CURRENT.get();
        try {
            CURRENT.set(organizacion);
            action.run();
        } finally {
            if (previous != null) {
                CURRENT.set(previous);
            } else {
                CURRENT.remove();
            }
        }
    }
}
