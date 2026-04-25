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

/**
 * Update a single-PK row. `changes` keys are AD column names ("Name",
 * "IsActive", "M_Product_Category_ID"). Bundle re-reads the row and returns it.
 */
export async function saveRow(windowId, tabIndex, recordId, changes) {
  const resp = await api.put(
    `/window/${windowId}/tab/${tabIndex}/row/${recordId}`,
    { changes }
  );
  return resp.data;
}

/**
 * Update a composite-key row. `keys` is an object whose keys are AD column
 * names of the row's primary key (multiple for tables like M_ProductPrice,
 * M_Product_Acct, etc.) and whose values identify the row.
 */
export async function saveRowByKeys(windowId, tabIndex, keys, changes) {
  const resp = await api.put(
    `/window/${windowId}/tab/${tabIndex}/row`,
    { keys, changes }
  );
  return resp.data;
}

/**
 * Create a new row. Goes through PO.save() so sequences, validators, and
 * change-log all fire. Returns the new row including the assigned ID.
 */
export async function createRow(windowId, tabIndex, changes) {
  const resp = await api.post(
    `/window/${windowId}/tab/${tabIndex}/row`,
    { changes }
  );
  return resp.data;
}
