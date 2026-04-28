import axios from 'axios';
import { getToken } from './keycloak';

// ── ERP v2 client ──
// Talks only to /api/erp-v2/** on the platform API. The platform delegates
// to a vendor-neutral ErpAdapter; today that resolves to iDempiere via
// IdempiereErpAdapter.
//
// Slice 1 is read-only. Save/edit lands in slice 2 — see
// ai-docs/erp-react-clone-design.md §8.5 deferred-work tracker.

const erpV2Api = axios.create({
  baseURL: '/api/erp-v2',
  headers: { 'Content-Type': 'application/json' },
});

erpV2Api.interceptors.request.use(async (config) => {
  let token = getToken();
  if (!token) {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      token = getToken();
      if (token) break;
    }
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Products ────────────────────────────────────────────────────────

/** A page of products. The result is { items, total, page, pageSize }. */
export async function listProducts({ q, categoryId, page, pageSize, sortField, sortDir } = {}) {
  const params = {};
  if (q) params.q = q;
  if (categoryId != null) params.categoryId = categoryId;
  if (page != null) params.page = page;
  if (pageSize != null) params.pageSize = pageSize;
  if (sortField) params.sortField = sortField;
  if (sortDir) params.sortDir = sortDir;
  const resp = await erpV2Api.get('/products', { params });
  return resp.data;
}

/** One product, or null if 404. */
export async function getProduct(id) {
  try {
    const resp = await erpV2Api.get(`/products/${id}`);
    return resp.data;
  } catch (e) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}
