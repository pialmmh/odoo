// DEPRECATED — do not add to this file.
//
// This module used to be a hard-coded parallel catalog (plan name → features map).
// That created a second source of truth alongside the Odoo product catalog and drifted
// from real prices/features over time.
//
// Single source of truth is now the Odoo product catalog:
//   - product.template + product.product (variants) describe what we sell
//   - x_kb_plan_name links a variant to its Kill Bill plan
//   - x_package_items (JSON) on the variant describes entitlements (bandwidth, data cap, etc.)
//
// Pages that still call the functions below will gracefully degrade (plan names still
// render; feature chips disappear) until they are migrated to read x_package_items
// via getProductVariants(). See CLAUDE.md for the architecture rule.
//
// Migration TODO (tracked separately):
//   - CustomerDetail.jsx — replace getPlanFeatures(planName) with Odoo product lookup
//   - Invoices.jsx       — same
//   - Payments.jsx       — same

export function getAllPlans() {
  return {};
}

export function getPlanFeatures(_planName) {
  return null;
}

export function getProductName(_planName) {
  return '';
}

export function getFeatureLabel(key) {
  return key || '';
}
