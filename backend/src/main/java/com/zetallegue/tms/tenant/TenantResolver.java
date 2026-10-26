package com.zetallegue.tms.tenant;

import jakarta.servlet.http.HttpServletRequest;

import java.net.URI;

public final class TenantResolver {

    public static final String HEADER = "X-Tenant";
    public static final String DEFAULT_SLUG = "nexo";

    private TenantResolver() {}

    public static String resolveSlug(HttpServletRequest request) {
        String header = trimToNull(request.getHeader(HEADER));
        if (header != null) {
            return header.toLowerCase();
        }
        String host = hostFromUrl(request.getHeader("Origin"));
        if (host == null) {
            host = hostFromUrl(request.getHeader("Referer"));
        }
        if (host == null) {
            host = trimToNull(request.getHeader("Host"));
        }
        return slugFromHost(host);
    }

    public static String slugFromHost(String host) {
        if (host == null || host.isBlank()) {
            return DEFAULT_SLUG;
        }
        host = host.toLowerCase().split(":")[0].trim();
        if (host.equals("localhost")
                || host.equals("127.0.0.1")
                || host.equals("isnexo.net")
                || host.equals("www.isnexo.net")
                || host.equals("api.isnexo.net")
                || host.endsWith(".amplifyapp.com")
                || host.endsWith(".cloudfront.net")) {
            return DEFAULT_SLUG;
        }
        String suffix = ".isnexo.net";
        if (host.endsWith(suffix)) {
            String sub = host.substring(0, host.length() - suffix.length());
            if (!sub.isBlank() && !sub.contains(".") && !sub.equals("www") && !sub.equals("api")) {
                return sub;
            }
        }
        return DEFAULT_SLUG;
    }

    private static String hostFromUrl(String value) {
        String raw = trimToNull(value);
        if (raw == null) {
            return null;
        }
        try {
            URI uri = URI.create(raw);
            if (uri.getHost() != null) {
                return uri.getHost();
            }
        } catch (Exception ignored) {
            // no es una URL completa
        }
        return null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
