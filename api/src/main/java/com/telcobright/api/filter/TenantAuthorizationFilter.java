package com.telcobright.api.filter;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

/**
 * Defense-in-depth: validates that the tenant requested via X-Killbill-ApiKey
 * matches one of the user's Keycloak groups (/tenants/{slug}).
 *
 * Super admins (realm role "super_admin") bypass this check.
 * Public endpoints (health, tenant loading) are not JWT-protected so they skip this filter.
 */
@Component
@Order(1)
public class TenantAuthorizationFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(TenantAuthorizationFilter.class);
    private static final String TENANT_GROUP_PREFIX = "/tenants/";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        // Only check KB proxy requests that carry a tenant header
        String kbApiKey = req.getHeader("X-Killbill-ApiKey");
        if (kbApiKey == null || kbApiKey.isBlank()) {
            chain.doFilter(request, response);
            return;
        }

        // Get JWT from security context (set by Spring Security oauth2 resource server)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            // No JWT present — let Spring Security handle 401
            chain.doFilter(request, response);
            return;
        }

        // Super admin bypasses tenant check
        List<String> roles = extractRealmRoles(jwt);
        if (roles.contains("super_admin")) {
            chain.doFilter(request, response);
            return;
        }

        // Extract allowed tenant slugs from groups claim
        List<String> groups = jwt.getClaimAsStringList("groups");
        if (groups == null) groups = Collections.emptyList();

        List<String> allowedSlugs = groups.stream()
                .filter(g -> g.startsWith(TENANT_GROUP_PREFIX))
                .map(g -> g.substring(TENANT_GROUP_PREFIX.length()))
                .toList();

        if (!allowedSlugs.contains(kbApiKey)) {
            log.warn("Tenant access denied: user={} requested tenant={} allowed={}",
                    jwt.getClaimAsString("preferred_username"), kbApiKey, allowedSlugs);
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"tenant_access_denied\",\"message\":\"You are not authorized to access this tenant\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    @SuppressWarnings("unchecked")
    private List<String> extractRealmRoles(Jwt jwt) {
        var realmAccess = jwt.getClaimAsMap("realm_access");
        if (realmAccess == null) return Collections.emptyList();
        Object roles = realmAccess.get("roles");
        if (roles instanceof List<?> list) return (List<String>) list;
        return Collections.emptyList();
    }
}
