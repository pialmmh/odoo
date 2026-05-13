/**
 * Odoo client — proxied through Plane's Caddy → host APISIX gateway → Spring Boot → Odoo 19.
 *
 * Mirrors orchestrix-v2/ui/src/services/odoo.js so the field-translation layer
 * (crm-via-odoo.ts) ports across without changes.
 *
 * TODO(auth): currently fetches a Keycloak JWT via direct grant for dev. Once Plane is
 * configured as a Keycloak OIDC client (or we wire keycloak-js into the web app),
 * read the token from that flow instead of localStorage.
 */
import axios from "axios";

const ODOO_API_BASE = "/odoo-api";

// Dev-only direct-grant token cache. NOT for production.
const KEYCLOAK_URL = "http://localhost:7104";
const KEYCLOAK_REALM = "telcobright";
const KEYCLOAK_CLIENT_ID = "platform-ui";
const DEV_USERNAME = "btcl-admin";
const DEV_PASSWORD = "password";
const DEFAULT_TENANT_SLUG = "btcl";

let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getDevToken(): Promise<string> {
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 30_000) return _cachedToken.token;
  const body = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    grant_type: "password",
    username: DEV_USERNAME,
    password: DEV_PASSWORD,
  });
  const resp = await axios.post(
    `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    body.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const token: string = resp.data.access_token;
  const ttlSec: number = resp.data.expires_in ?? 300;
  _cachedToken = { token, expiresAt: Date.now() + ttlSec * 1000 };
  return token;
}

const api = axios.create({
  baseURL: ODOO_API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await getDevToken();
  config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-Tenant-Slug"] = DEFAULT_TENANT_SLUG;
  return config;
});

/**
 * Generic Odoo model call.
 * POST /odoo-api/{model}/{method}  { args, kwargs } → result
 */
export async function call<T = any>(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: Record<string, any> = {}
): Promise<T> {
  const resp = await api.post(`/${model}/${method}`, { args, kwargs });
  return resp.data as T;
}
