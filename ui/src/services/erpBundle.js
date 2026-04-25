// Direct client to the iDempiere-embedded /erp-api/* bundle.
// In dev: Vite proxies /erp-api/* → http://localhost:7079.
// In prod: APISIX route proxies /erp-api/* the same way (TODO: wire JWT).

import axios from 'axios';

const api = axios.create({
  baseURL: '/erp-api',
  headers: { 'Content-Type': 'application/json' },
});

export async function getWindowSpec(windowId) {
  const resp = await api.get(`/window/${windowId}/spec`);
  return resp.data;
}

export async function getTabRows(windowId, tabIndex, params = {}) {
  const resp = await api.get(`/window/${windowId}/tab/${tabIndex}/rows`, { params });
  return resp.data;
}
