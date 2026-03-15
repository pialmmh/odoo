import axios from 'axios';

const ODOO_DB = 'odoo_billing';
const ODOO_USER = 'admin';
const ODOO_PASS = 'admin';

let _uid = null;

const rpc = axios.create({
  baseURL: '/odoo',
  headers: { 'Content-Type': 'application/json' },
});

async function jsonrpc(url, method, params) {
  const resp = await rpc.post(url, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'call',
    params,
  });
  if (resp.data.error) {
    throw new Error(resp.data.error.data?.message || resp.data.error.message || 'Odoo RPC error');
  }
  return resp.data.result;
}

async function getUid() {
  if (_uid) return _uid;
  _uid = await jsonrpc('/web/session/authenticate', 'call', {
    db: ODOO_DB,
    login: ODOO_USER,
    password: ODOO_PASS,
  });
  _uid = _uid.uid;
  return _uid;
}

async function call(model, method, args = [], kwargs = {}) {
  await getUid();
  return jsonrpc(`/web/dataset/call_kw/${model}/${method}`, 'call', {
    model,
    method,
    args,
    kwargs,
  });
}

// ── Products ──

export async function getProductCategories() {
  return call('product.category', 'search_read', [[]],
    { fields: ['id', 'name', 'parent_id', 'complete_name'] });
}

export async function getProductTemplates(domain = []) {
  return call('product.template', 'search_read', [domain], {
    fields: [
      'id', 'name', 'list_price', 'categ_id', 'type', 'active',
      'description_sale', 'attribute_line_ids',
      'x_kb_product_name', 'x_kb_category',
      'product_variant_count', 'product_variant_ids',
    ],
  });
}

export async function getProductTemplate(id) {
  const results = await call('product.template', 'read', [[id]], {
    fields: [
      'id', 'name', 'list_price', 'categ_id', 'type', 'active',
      'description_sale', 'attribute_line_ids',
      'x_kb_product_name', 'x_kb_category',
      'product_variant_count', 'product_variant_ids',
    ],
  });
  return results[0] || null;
}

export async function getProductVariants(domain = []) {
  return call('product.product', 'search_read', [domain], {
    fields: [
      'id', 'name', 'lst_price', 'product_tmpl_id', 'active',
      'product_template_attribute_value_ids',
      'x_kb_plan_name', 'x_kb_billing_period', 'x_kb_has_trial', 'x_kb_trial_days',
    ],
  });
}

export async function getProductVariantsByTemplate(templateId) {
  return getProductVariants([['product_tmpl_id', '=', templateId]]);
}

export async function getAttributeValues(ids) {
  if (!ids || ids.length === 0) return [];
  return call('product.template.attribute.value', 'read', [ids],
    { fields: ['id', 'name', 'attribute_id'] });
}

export async function getProductAttributes() {
  return call('product.attribute', 'search_read', [[]], {
    fields: ['id', 'name', 'display_type', 'value_ids'],
  });
}

export async function getAttributeValuesList(ids) {
  if (!ids || ids.length === 0) return [];
  return call('product.attribute.value', 'read', [ids],
    { fields: ['id', 'name', 'attribute_id'] });
}

// ── Pricing (Pricelists) ──

export async function getPricelists() {
  return call('product.pricelist', 'search_read', [[]], {
    fields: ['id', 'name', 'currency_id', 'active'],
  });
}

export async function getPricelistItems(pricelistId) {
  return call('product.pricelist.item', 'search_read',
    [[['pricelist_id', '=', pricelistId]]],
    {
      fields: [
        'id', 'product_tmpl_id', 'product_id', 'fixed_price',
        'compute_price', 'percent_price', 'date_start', 'date_end',
        'min_quantity',
      ],
    });
}

// ── Sync Log ──

export async function getSyncLogs(domain = [], limit = 50) {
  return call('kb.sync.log', 'search_read', [domain], {
    fields: [
      'id', 'name', 'operation', 'direction', 'status',
      'kb_object_id', 'odoo_object', 'error_message',
      'retry_count', 'create_date', 'company_id',
    ],
    limit,
    order: 'create_date desc',
  });
}

// ── Rate History ──

export async function getRateHistory(domain = [], limit = 200) {
  return call('product.rate.history', 'search_read', [domain], {
    fields: [
      'id', 'product_tmpl_id', 'product_id', 'variant_display',
      'price', 'currency_id', 'tax_included',
      'effective_date', 'end_date', 'is_active',
      'pricelist_tier', 'reason', 'changed_by', 'notes',
      'create_date',
    ],
    limit,
    order: 'effective_date desc, id desc',
  });
}

export async function createRateEntry(vals) {
  return call('product.rate.history', 'create', [vals]);
}

export async function updateRateEntry(id, vals) {
  return call('product.rate.history', 'write', [[id], vals]);
}

// ── Tax Rates (product.tax.rate) ──

export async function getTaxRates(domain = [], limit = 200) {
  return call('product.tax.rate', 'search_read', [domain], {
    fields: [
      'id', 'name', 'tax_type', 'rate', 'is_deduction',
      'categ_id', 'product_tmpl_id',
      'effective_date', 'end_date', 'is_active',
      'gazette_ref', 'reason', 'changed_by', 'notes',
      'odoo_tax_id', 'create_date',
    ],
    limit,
    order: 'effective_date desc, id desc',
  });
}

export async function createTaxRate(vals) {
  return call('product.tax.rate', 'create', [vals]);
}

export async function updateTaxRate(id, vals) {
  return call('product.tax.rate', 'write', [[id], vals]);
}

// ── Odoo Taxes (account.tax) ──

export async function getOdooTaxes() {
  return call('account.tax', 'search_read',
    [[['type_tax_use', '=', 'sale']]],
    { fields: ['id', 'name', 'amount', 'amount_type', 'description'] });
}

// ── Journals ──

export async function getJournals() {
  return call('account.journal', 'search_read', [[['company_id', '=', 1]]],
    { fields: ['id', 'name', 'code', 'type'], order: 'code' });
}

// ── Accounts ──

export async function getAccounts(domain = []) {
  return call('account.account', 'search_read', [domain],
    { fields: ['id', 'code', 'name', 'account_type'], order: 'code' });
}

// ── Write operations ──

export async function updateProductTemplate(id, vals) {
  return call('product.template', 'write', [[id], vals]);
}

export async function updateProductVariant(id, vals) {
  return call('product.product', 'write', [[id], vals]);
}
