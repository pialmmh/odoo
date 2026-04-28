import axios from 'axios';
import { getToken } from './keycloak';

// ── ERP inventory client ──
// All write paths go through the BFF, which posts the relevant iDempiere
// document (Physical Inventory, Material Receipt, Inventory Move,
// Internal Use Inventory) and completes it via processIt("CO"). The BFF
// also runs Doc.postImmediate so Fact_Acct is written synchronously.
//
// The React side stays "as dumb as the ZK client": no client-side
// validation, no business logic — the user fills the form, we POST,
// iDempiere validates and either posts the document or returns a 422
// with a plain-text reason that we surface to the user.

const inventoryApi = axios.create({
  baseURL: '/api/erp/inventory',
  headers: { 'Content-Type': 'application/json' },
});

const warehouseApi = axios.create({
  baseURL: '/api/erp',
  headers: { 'Content-Type': 'application/json' },
});

const tokenInterceptor = async (config) => {
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
};
inventoryApi.interceptors.request.use(tokenInterceptor);
warehouseApi.interceptors.request.use(tokenInterceptor);

// ── Writes ──────────────────────────────────────────────────────────────

/** Adjust on-hand to an absolute quantity (Physical Inventory, "Difference"
 *  variance). Returns { ok, inventoryId, documentNo, docStatus }. */
export async function adjustStock({ productId, locatorId, newQty, description }) {
  const resp = await inventoryApi.post('/adjust', {
    productId, locatorId,
    newQty: String(newQty),
    description: description || null,
  });
  return resp.data;
}

/** Receive goods from a vendor. Posts a Material Receipt (M_InOut,
 *  IsSOTrx=N). Returns { ok, inoutId, documentNo, docStatus }. */
export async function receiveStock({ productId, locatorId, bpartnerId, qty, description }) {
  const resp = await inventoryApi.post('/receive', {
    productId, locatorId, bpartnerId,
    qty: String(qty),
    description: description || null,
  });
  return resp.data;
}

/** Move stock between two locators. Returns
 *  { ok, movementId, documentNo, docStatus }. */
export async function moveStock({ productId, fromLocatorId, toLocatorId, qty, description }) {
  const resp = await inventoryApi.post('/move', {
    productId, fromLocatorId, toLocatorId,
    qty: String(qty),
    description: description || null,
  });
  return resp.data;
}

/** Internal Use / scrap / write-off. The chargeId selects the cost
 *  account the consumed inventory posts against. If omitted, the BFF
 *  picks the first active charge for the client. */
export async function issueStock({ productId, locatorId, qty, chargeId, description }) {
  const resp = await inventoryApi.post('/issue', {
    productId, locatorId,
    qty: String(qty),
    chargeId: chargeId || 0,
    description: description || null,
  });
  return resp.data;
}

// ── Reads (warehouse + bpartner pickers) ────────────────────────────────

/** List all active warehouses for the current client. */
export async function listWarehouses() {
  const resp = await warehouseApi.get('/warehouses');
  return resp.data?.items || [];
}

/** List locators in a warehouse with on-hand rollup per locator. */
export async function listLocators(warehouseId) {
  const resp = await warehouseApi.get(`/warehouses/${warehouseId}/locators`);
  return resp.data?.items || [];
}

/** Product-by-locator stock breakdown for a warehouse. */
export async function getWarehouseStock(warehouseId) {
  const resp = await warehouseApi.get(`/warehouses/${warehouseId}/stock`);
  return resp.data?.items || [];
}

/** Picker-shaped business-partner list. role: 'vendor' | 'customer' | undefined. */
export async function listBPartners({ role, q } = {}) {
  const params = {};
  if (role) params.role = role;
  if (q) params.q = q;
  const resp = await warehouseApi.get('/bpartners/list', { params });
  return resp.data?.items || [];
}

/** Picker-shaped charge list — for the Issue / Internal Use dialog. */
export async function listCharges() {
  const resp = await warehouseApi.get('/charges/list');
  return resp.data?.items || [];
}
