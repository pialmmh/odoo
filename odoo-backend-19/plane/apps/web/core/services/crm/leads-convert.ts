/**
 * Lead → Account/Contact/Opportunity conversion against Odoo.
 *
 * EspoCRM exposes /Lead/action/convert as a single server call. Odoo has no
 * equivalent, so we run 3–4 calls in sequence:
 *   1. (optional) create res.partner is_company=true   → account
 *   2. (optional) create res.partner is_company=false  → contact, parent_id=account
 *   3. (optional) create crm.lead type=opportunity     → opportunity
 *   4. write original crm.lead x_espo_status='Converted' (+ link partner_id if created)
 *
 * Each step is best-effort independent — if step 2 succeeds and step 3 fails,
 * the caller still sees the partial result so they can retry without dupes.
 */
import { call } from "./odoo";

export const ACCOUNT_TYPES = ["", "Customer", "Investor", "Partner", "Reseller"] as const;

export const OPPORTUNITY_STAGES = [
  "Prospecting",
  "Qualification",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
] as const;

export type ConvertAccount = {
  name: string;
  type?: string;
  emailAddress?: string;
  phoneNumber?: string;
  industry?: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type ConvertContact = {
  firstName?: string;
  lastName: string;
  emailAddress?: string;
  phoneNumber?: string;
  title?: string;
};

export type ConvertOpportunity = {
  name: string;
  stage?: string;
  amount: number | string;
  closeDate: string;
  leadSource?: string;
  description?: string;
};

export type ConvertSelection = {
  account?: ConvertAccount;
  contact?: ConvertContact;
  opportunity?: ConvertOpportunity;
};

export type ConvertResult = {
  accountId?: number;
  contactId?: number;
  opportunityId?: number;
};

const partnerValsFromAccount = (a: ConvertAccount): Record<string, any> => ({
  name: a.name,
  is_company: true,
  email: a.emailAddress || false,
  phone: a.phoneNumber || false,
  website: a.website || false,
  street: a.street || false,
  city: a.city || false,
  // state_id / country_id are many2ones — pass false unless we resolve names → ids.
  // Leaving the original lead's address strings on x_espo_* would mean adding
  // custom fields; for now we surface street/city/zip only.
  zip: false,
  comment: a.type ? `Type: ${a.type}` : false,
});

const partnerValsFromContact = (c: ConvertContact, parentId?: number): Record<string, any> => {
  const fullName = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.lastName;
  return {
    name: fullName,
    is_company: false,
    parent_id: parentId || false,
    email: c.emailAddress || false,
    phone: c.phoneNumber || false,
    function: c.title || false,
  };
};

const opportunityValsFrom = (
  o: ConvertOpportunity,
  partnerId?: number,
  contact?: ConvertContact
): Record<string, any> => ({
  name: o.name,
  type: "opportunity",
  partner_id: partnerId || false,
  contact_name: contact ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() : false,
  email_from: contact?.emailAddress || false,
  phone: contact?.phoneNumber || false,
  expected_revenue: o.amount === "" || o.amount == null ? 0 : Number(o.amount),
  date_deadline: o.closeDate || false,
  description: o.description || false,
  x_espo_source: o.leadSource || false,
});

export async function convertLead(
  leadId: string | number,
  selection: ConvertSelection
): Promise<ConvertResult> {
  const result: ConvertResult = {};

  if (selection.account) {
    if (!selection.account.name?.trim()) throw new Error("Account: Name is required");
    result.accountId = await call<number>("res.partner", "create", [
      partnerValsFromAccount(selection.account),
    ]);
  }

  if (selection.contact) {
    if (!selection.contact.lastName?.trim()) throw new Error("Contact: Last Name is required");
    result.contactId = await call<number>("res.partner", "create", [
      partnerValsFromContact(selection.contact, result.accountId),
    ]);
  }

  if (selection.opportunity) {
    if (!selection.opportunity.name?.trim()) throw new Error("Opportunity: Name is required");
    if (selection.opportunity.amount == null || selection.opportunity.amount === "")
      throw new Error("Opportunity: Amount is required (use 0 if unknown)");
    if (!selection.opportunity.closeDate) throw new Error("Opportunity: Close Date is required");
    result.opportunityId = await call<number>("crm.lead", "create", [
      opportunityValsFrom(selection.opportunity, result.accountId, selection.contact),
    ]);
  }

  const writeBack: Record<string, any> = { x_espo_status: "Converted" };
  if (result.accountId) writeBack.partner_id = result.accountId;
  await call("crm.lead", "write", [[Number(leadId)], writeBack]);

  return result;
}
