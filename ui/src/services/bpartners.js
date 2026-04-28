import axios from 'axios';
import { getToken } from './keycloak';

// ── ERP Business Partners client ──
// Talks to the Spring Boot proxy at /api/erp/bpartners. The proxy forwards
// reads to the in-process ERP backend; writes return 501 until that path
// lands. UI gates the editor on /api/erp/bpartners/_caps.

const api = axios.create({
  baseURL: '/api/erp/bpartners',
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

export async function listBPartners({ search, page = 0, size = 50, sort, dir } = {}) {
  const resp = await api.get('', { params: { search, page, size, sort, dir } });
  return resp.data;
}

export async function getBPartner(id) {
  const resp = await api.get(`/${id}`);
  return resp.data;
}

export async function getCaps() {
  try {
    const resp = await api.get('/_caps');
    return resp.data || { reads: true, writes: false };
  } catch {
    return { reads: true, writes: false, writeReason: 'probe_failed' };
  }
}

// PUT instead of PATCH — APISIX route /api/erp/* doesn't whitelist PATCH.
// The Spring proxy accepts both verbs interchangeably and forwards as PUT.
export async function saveBPartner(id, changes) {
  const resp = await api.put(`/${id}`, { changes });
  return resp.data;
}

export async function createBPartner(changes) {
  const resp = await api.post('', { changes });
  return resp.data;
}

export async function deleteBPartner(id) {
  const resp = await api.delete(`/${id}`);
  return resp.data;
}

// Per-field FK picker rows. windowId+tabIndex+columnName are AD identifiers;
// the BFF builds the right MLookup (Table Direct/Table/Search/List) and
// honours AD_Val_Rule + IsParent. Goes direct to the BFF — Spring proxy
// does not need to add value here.
export async function getFieldLookup(windowId, tabIndex, columnName, q) {
  const url = `/erp-api/window/${windowId}/tab/${tabIndex}/field/${columnName}/lookup`;
  const resp = await axios.get(url, { params: q ? { q } : {} });
  return resp.data?.items || [];
}
