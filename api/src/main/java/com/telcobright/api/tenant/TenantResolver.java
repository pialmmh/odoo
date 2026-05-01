package com.telcobright.api.tenant;

import com.telcobright.api.config.OdooProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Resolves the active tenant for an incoming request.
 *
 * Order of precedence:
 *  1. {@code X-Tenant-Slug} header (set by React from the URL path).
 *  2. Empty / missing → null (caller falls back to default DB).
 *
 * If a JWT is present, the resolved tenant is validated against the
 * {@code allowed_tenants} claim. Mismatch → {@link TenantAccessDeniedException}.
 */
@Component
public class TenantResolver {

    private static final Logger log = LoggerFactory.getLogger(TenantResolver.class);
    private static final Pattern SLUG_PATTERN = Pattern.compile("[a-z0-9][a-z0-9_-]{0,62}");

    private final OdooProperties props;

    public TenantResolver(OdooProperties props) {
        this.props = props;
    }

    /** Returns the tenant slug for this request, or null if none was supplied. */
    public String resolveSlug(HttpServletRequest req) {
        String slug = req.getHeader("X-Tenant-Slug");
        if (slug == null || slug.isBlank()) return null;
        slug = slug.trim().toLowerCase();
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new TenantAccessDeniedException("Invalid tenant slug: " + slug);
        }
        validateAgainstJwt(slug);
        return slug;
    }

    /** Returns the Odoo DB name for this request: tenant DB if header present, else default. */
    public String resolveDb(HttpServletRequest req) {
        String slug = resolveSlug(req);
        return props.dbFor(slug); // null/blank → default DB
    }

    @SuppressWarnings("unchecked")
    private void validateAgainstJwt(String slug) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken jwtAuth)) return;
        Jwt jwt = jwtAuth.getToken();
        // super-admin role bypasses the per-tenant allow-list
        Object roles = jwt.getClaim("roles");
        if (roles instanceof List<?> rs && rs.contains("super_admin")) return;

        Object allowed = jwt.getClaim("allowed_tenants");
        if (allowed instanceof List<?> list) {
            for (Object o : list) {
                if (slug.equalsIgnoreCase(String.valueOf(o))) return;
            }
            log.warn("JWT subject {} not authorized for tenant {}", jwt.getSubject(), slug);
            throw new TenantAccessDeniedException("Not authorized for tenant: " + slug);
        }
        // No claim → unrestricted (back-compat until Keycloak issues the claim).
    }

    public static class TenantAccessDeniedException extends RuntimeException {
        public TenantAccessDeniedException(String msg) { super(msg); }
    }
}
