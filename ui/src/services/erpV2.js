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

/**
 * Patch a product. Slice 2a — only fields whose iDempiere mapping is
 * `equivalent` are accepted server-side; anything else is silently
 * dropped on the BFF. Pass `updatedMs` from the prior GET so the
 * server can detect concurrent edits and 409 you out.
 *
 * Returns the fresh ProductDto on success.
 * Throws an Error with `.status === 409` on stale-token; the server's
 * current ProductDto is on `.current`.
 */
export async function updateProduct(id, patch, updatedMs) {
  try {
    const resp = await erpV2Api.patch(`/products/${id}`, { patch, updatedMs });
    return resp.data;
  } catch (e) {
    if (e.response?.status === 409) {
      const err = new Error(e.response.data?.message || 'Stale token');
      err.status = 409;
      err.current = e.response.data?.current;
      throw err;
    }
    throw e;
  }
}

/** Create a new product. Required: { name, value }. Returns ProductDto. */
export async function createProduct(values) {
  try {
    const resp = await erpV2Api.post('/products', values);
    return resp.data;
  } catch (e) {
    if (e.response?.status === 400) {
      const err = new Error(e.response.data?.message || 'Validation error');
      err.status = 400;
      throw err;
    }
    throw e;
  }
}

/** Archive (soft-delete) a product. Honors concurrency token via ?updatedMs. */
export async function archiveProduct(id, updatedMs) {
  try {
    const params = updatedMs != null ? { updatedMs } : {};
    const resp = await erpV2Api.delete(`/products/${id}`, { params });
    return resp.data;
  } catch (e) {
    if (e.response?.status === 409) {
      const err = new Error(e.response.data?.message || 'Stale token');
      err.status = 409;
      err.current = e.response.data?.current;
      throw err;
    }
    throw e;
  }
}

// ── Lookups for m2o pickers ────────────────────────────────────────────
let _lookupCache = {};
async function _lookup(key, path) {
  if (_lookupCache[key]) return _lookupCache[key];
  const resp = await erpV2Api.get(path);
  _lookupCache[key] = resp.data;
  return resp.data;
}
export const listCategories    = () => _lookup('cat',     '/products/lookups/categories');
export const listUoms          = () => _lookup('uom',     '/products/lookups/uoms');
export const listTaxCategories = () => _lookup('taxcat',  '/products/lookups/tax-categories');
export const listProductTypes  = () => _lookup('ptype',   '/products/lookups/product-types');

// ── Pricing (slice 2b) ─────────────────────────────────────────────────
export async function getPrice(id) {
  const resp = await erpV2Api.get(`/products/${id}/price`);
  return resp.data;
}
export async function setPrice(id, listPrice, standardPrice) {
  const resp = await erpV2Api.put(`/products/${id}/price`, { listPrice, standardPrice });
  return resp.data;
}
