/**
 * Placeholder CRM-integration provider — no-ops for outbound-only
 * bootstrap. Will grow into Espo Lead/Contact/Account lookup,
 * Call-entity logging, and screen-pop routing.
 */
export class StubCrmIntegrationProvider {
  async lookupCaller(_variants) { return { primary: null, all: [] }; }
  openRecord(_match) { /* no-op */ }
  openRecordById(_module, _id) { /* no-op */ }
  openCreateRecord(_module, _context) { /* no-op */ }
  notifyUnknownCaller(_call) { /* no-op */ }
  async createCallLog(_entry) { return null; }
  async updateCallLog(_entry) { /* no-op */ }
}
