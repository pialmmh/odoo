import axios from 'axios';
import { getToken } from './keycloak';

// ── Tax-rates client: ERP-neutral, talks only to /api/catalog/tax-rates ──
// Underlying ERP (Odoo today) is invisible to the caller. DTO shape comes
// from the Spring controller, not from any ERP model.

const api = axios.create({
  baseURL: '/api/catalog/tax-rates',
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
 * Returns TaxRateDto[] — camelCase, flat. See backend TaxRateDto.java.
 */
export async function getTaxRates(limit = 200) {
  const resp = await api.get('', { params: { limit } });
  return resp.data;
}

/**
 * payload shape: TaxRateUpsertRequest (camelCase camelCase, null for "unset").
 * Returns the created TaxRateDto.
 */
export async function createTaxRate(payload) {
  const resp = await api.post('', payload);
  return resp.data;
}

/**
 * payload shape: TaxRateUpsertRequest. Returns the updated TaxRateDto.
 */
export async function updateTaxRate(id, payload) {
  const resp = await api.put(`/${id}`, payload);
  return resp.data;
}

/**
 * Lookup list of base taxes from the underlying accounting engine —
 * used to populate the "linked base tax" picker on the authoring form.
 * Returns BaseTaxDto[].
 */
export async function getBaseTaxes() {
  const resp = await api.get('/base-taxes');
  return resp.data;
}
