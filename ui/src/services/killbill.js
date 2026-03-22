import axios from 'axios';
import { getToken } from './keycloak';

// ── Routes through API Gateway → Spring Boot → Kill Bill ──

const api = axios.create({
  baseURL: '/api/kb',
  headers: { 'Content-Type': 'application/json' },
});

// Active tenant reference — set by TenantContext via setKBTenant()
let _activeTenant = null;
let _username = 'billing-ui';

export function setKBTenant(tenant, username) {
  _activeTenant = tenant;
  _username = username || 'billing-ui';
}

// Inject JWT + tenant headers — wait briefly if token not ready
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

  if (_activeTenant) {
    config.headers['X-Killbill-ApiKey'] = _activeTenant.x_kb_api_key || _activeTenant.apiKey || '';
    config.headers['X-Killbill-ApiSecret'] = _activeTenant.x_kb_api_secret || _activeTenant.apiSecret || '';
  }

  config.headers['X-Killbill-CreatedBy'] = _username;
  return config;
});

// System-level requests (no tenant headers needed)
const systemApi = axios.create({
  baseURL: '/api/kb',
  headers: { 'Content-Type': 'application/json' },
});

systemApi.interceptors.request.use(async (config) => {
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
  config.headers['X-Killbill-CreatedBy'] = _username;
  return config;
});

// ==================== TENANT MANAGEMENT ====================
export const createTenantInKB = (apiKey, apiSecret, externalKey) =>
  systemApi.post('/tenants', { apiKey, apiSecret, externalKey });

export const getTenantByApiKey = (apiKey) =>
  systemApi.get(`/tenants?apiKey=${apiKey}`);

// ==================== HEALTHCHECK ====================
export const healthcheck = () => systemApi.get('/healthcheck');

// ==================== ACCOUNTS ====================
export const getAccounts = (offset = 0, limit = 100) =>
  api.get('/accounts/pagination', { params: { offset, limit } });
export const getAccount = (id) => api.get(`/accounts/${id}?accountWithBalanceAndCBA=true`);
export const getAccountByKey = (key) => api.get(`/accounts?externalKey=${key}&accountWithBalanceAndCBA=true`);
export const createAccount = (data) => api.post('/accounts', data);

// ==================== SUBSCRIPTIONS ====================
export const getAccountBundles = (accountId) => api.get(`/accounts/${accountId}/bundles`);
export const createSubscription = (data) => api.post('/subscriptions', data);
export const cancelSubscription = (id) => api.delete(`/subscriptions/${id}`);
export const pauseSubscription = (id) => api.put(`/subscriptions/${id}/pause`);
export const resumeSubscription = (id) => api.put(`/subscriptions/${id}/resume`);
export const getSubscription = (id) => api.get(`/subscriptions/${id}`);

// ==================== INVOICES ====================
export const getAccountInvoicesList = (accountId) =>
  api.get(`/accounts/${accountId}/invoices`);
export const getInvoice = (id) => api.get(`/invoices/${id}?withItems=true`);
export const getAccountInvoices = async (accountId) => {
  const listRes = await api.get(`/accounts/${accountId}/invoices`);
  const invoices = listRes.data || [];
  const enriched = await Promise.all(
    invoices.map(async (inv) => {
      try {
        const full = await api.get(`/invoices/${inv.invoiceId}?withItems=true`);
        return full.data;
      } catch { return inv; }
    })
  );
  return { ...listRes, data: enriched };
};

// ==================== PAYMENTS ====================
export const getAccountPayments = (accountId) => api.get(`/accounts/${accountId}/payments`);
export const getAccountPaymentsWithAttempts = (accountId) =>
  api.get(`/accounts/${accountId}/payments?withAttempts=true`);
export const createPayment = (accountId, data) =>
  api.post(`/accounts/${accountId}/payments`, data);
export const getPayment = (paymentId) =>
  api.get(`/payments/${paymentId}?withAttempts=true`);

export const payInvoice = (invoiceId, accountId, amount, {
  currency = 'BDT',
  transactionExternalKey = null,
  paymentMethodId = null,
} = {}) => {
  const body = {
    accountId,
    purchasedAmount: amount,
    currency,
  };
  const params = {};
  if (!paymentMethodId) {
    params.externalPayment = true;
  } else {
    body.paymentMethodId = paymentMethodId;
  }
  if (transactionExternalKey) {
    body.paymentExternalKey = transactionExternalKey;
  }
  return api.post(`/invoices/${invoiceId}/payments`, body, { params });
};

export const getInvoicePayments = (invoiceId) =>
  api.get(`/invoices/${invoiceId}/payments`);

export const searchPayments = (searchKey, offset = 0, limit = 100) =>
  api.get('/payments/search/' + encodeURIComponent(searchKey), { params: { offset, limit } });

// ==================== CATALOG ====================
export const getCatalog = () => api.get('/catalog', { headers: { Accept: 'application/json' } });
export const uploadCatalog = (xmlContent) =>
  api.post('/catalog/xml', xmlContent, { headers: { 'Content-Type': 'text/xml' } });

// ==================== OVERDUE ====================
export const getOverdueState = (accountId) => api.get(`/accounts/${accountId}/overdue`);
export const uploadOverdueConfig = (xmlContent) =>
  api.post('/overdue/xml', xmlContent, { headers: { 'Content-Type': 'text/xml' } });

// ==================== CUSTOM FIELDS ====================
export const getSubscriptionCustomFields = (subscriptionId) =>
  api.get(`/subscriptions/${subscriptionId}/customFields`);
export const setSubscriptionCustomFields = (subscriptionId, fields) =>
  api.post(`/subscriptions/${subscriptionId}/customFields`, fields);

// ==================== TAGS ====================
export const getAccountTags = (accountId) => api.get(`/accounts/${accountId}/tags`);

// ==================== EXTERNAL CHARGES ====================
export const addExternalCharge = (accountId, charges) =>
  api.post(`/invoices/charges/${accountId}?autoCommit=true`, charges);

// ==================== PAYMENT METHODS ====================
export const addPaymentMethod = (accountId, data) =>
  api.post(`/accounts/${accountId}/paymentMethods?isDefault=true`, data);

export default api;
