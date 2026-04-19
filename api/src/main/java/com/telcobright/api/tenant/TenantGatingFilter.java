package com.telcobright.api.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Rejects API requests that name a tenant (via X-Tenant header) that is not
 * present in the enabled set loaded by TenantConfigRegistry.
 *
 * - Header absent  → pass through (shared / unauthenticated endpoints).
 * - Header present and tenant enabled → pass through.
 * - Header present and tenant unknown or disabled → 404.
 *
 * 404 (not 403) is intentional: we don't admit whether the tenant exists.
 */
@Component
public class TenantGatingFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Tenant";

    private final TenantConfigRegistry registry;

    public TenantGatingFilter(TenantConfigRegistry registry) {
        this.registry = registry;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String slug = request.getHeader(HEADER);
        if (slug != null && !slug.isBlank() && !registry.isEnabled(slug.trim().toLowerCase())) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"tenant not found\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
