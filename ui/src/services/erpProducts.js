import axios from 'axios';
import { getToken } from './keycloak';

// ── ERP Products client (experimental) ──
// Talks to /api/erp/products. Read-only for now; writes will land when the
// underlying engine's REST plugin is installed.

const api = axios.create({
  baseURL: '/api/erp/products',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  let token = getToken();
  if (!token) {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500));
      token = getToken();
      if (token) break;
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * List products. Returns { items, total, page, size }.
 *  search: optional substring on value/name/sku
 *  page:   0-indexed
 *  size:   1..200
 *  sort:   value | name | sku | producttype | isactive
 *  dir:    asc | desc
 */
export async function listProducts({ search, page = 0, size = 50, sort, dir } = {}) {
  const resp = await api.get('', { params: { search, page, size, sort, dir } });
  return resp.data;
}

/**
 * Single product by id. Header tab fields, camelCase, FK display names attached.
 */
export async function getProduct(id) {
  const resp = await api.get(`/${id}`);
  return resp.data;
}
