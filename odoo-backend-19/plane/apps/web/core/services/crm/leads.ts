/**
 * Lead CRUD via Odoo crm.lead — Espo-shape adapter.
 *
 * Ported from orchestrix-v2/ui/src/services/crm-via-odoo.js (lead slice only).
 * Same field names / shapes so future ports of Contacts/Opportunities reuse the
 * same translation pattern. `mobile` is intentionally omitted — Odoo 19's
 * crm.lead doesn't expose it.
 */
import { call } from "./odoo";

export const LEAD_STATUSES = [
  "New",
  "Assigned",
  "In Process",
  "Converted",
  "Recycled",
  "Dead",
] as const;

export const LEAD_NOT_ACTUAL_STATUSES = ["Converted", "Recycled", "Dead"] as const;

export const LEAD_SOURCES = [
  "Call",
  "Email",
  "Existing Customer",
  "Partner",
  "Public Relations",
  "Web Site",
  "Campaign",
  "Other",
] as const;

export const LEAD_SALUTATIONS = ["", "Mr.", "Ms.", "Mrs.", "Dr."] as const;

const READ_FIELDS = [
  "id",
  "name",
  "type",
  "contact_name",
  "partner_name",
  "partner_id",
  "email_from",
  "phone",
  "function",
  "website",
  "description",
  "street",
  "street2",
  "city",
  "state_id",
  "zip",
  "country_id",
  "expected_revenue",
  "probability",
  "company_currency",
  "date_deadline",
  "user_id",
  "team_id",
  "stage_id",
  "campaign_id",
  "create_date",
  "write_date",
  "create_uid",
  "write_uid",
  "message_partner_ids",
  "x_espo_status",
  "x_espo_source",
  "x_industry",
  "x_do_not_call",
  "x_salutation",
  "x_first_name",
  "x_last_name",
];

export type LeadRow = {
  id: string;
  name: string;
  type: string;
  firstName: string;
  lastName: string;
  contactName: string;
  salutationName: string;
  title: string;
  accountName: string;
  accountId: number | null;
  emailAddress: string;
  phoneNumber: string;
  status: string;
  source: string;
  industry: string;
  stageId: number | null;
  stageName: string;
  probability: number | null;
  opportunityAmount: number | null;
  opportunityAmountCurrency: string;
  closeDate: string | null;
  doNotCall: boolean;
  website: string;
  description: string;
  addressStreet: string;
  addressStreet2: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  addressPostalCode: string;
  assignedUserId: number | null;
  assignedUserName: string;
  teamsIds: number[];
  teamsNames: Record<number, string> | null;
  campaignId: number | null;
  campaignName: string;
  createdAt: string;
  modifiedAt: string;
  createdById: number | null;
  createdByName: string;
  modifiedById: number | null;
  modifiedByName: string;
  convertedAt: string | null;
  isFollowed: boolean;
  followersIds: number[];
};

const m2o = (v: any): [number | null, string] => (Array.isArray(v) ? v : [null, ""]);

const toIsoLocal = (s: string | undefined | null): string => {
  if (!s) return "";
  const d = new Date(String(s).replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? String(s) : d.toLocaleString();
};

function odooToEspoLead(r: any): LeadRow {
  const [userId, userName] = m2o(r.user_id);
  const [, teamName] = m2o(r.team_id);
  const teamId = Array.isArray(r.team_id) ? r.team_id[0] : null;
  const [stageId, stageName] = m2o(r.stage_id);
  const [partnerId] = m2o(r.partner_id);
  const [, stateName] = m2o(r.state_id);
  const [, countryName] = m2o(r.country_id);
  const [campId, campName] = m2o(r.campaign_id);
  const [createUid, createUidNm] = m2o(r.create_uid);
  const [writeUid, writeUidNm] = m2o(r.write_uid);
  const [, currencyNm] = m2o(r.company_currency);

  let firstName = r.x_first_name || "";
  let lastName = r.x_last_name || "";
  if (!firstName && !lastName && r.contact_name) {
    const parts = String(r.contact_name).trim().split(/\s+/);
    if (parts.length === 1) lastName = parts[0];
    else {
      firstName = parts.slice(0, -1).join(" ");
      lastName = parts.slice(-1)[0];
    }
  }

  const isConverted = r.x_espo_status === "Converted";

  return {
    id: String(r.id),
    name: r.name || "",
    type: r.type || "lead",
    firstName,
    lastName,
    contactName: r.contact_name || "",
    salutationName: r.x_salutation || "",
    title: r.function || "",
    accountName: r.partner_name || "",
    accountId: partnerId,
    emailAddress: r.email_from || "",
    phoneNumber: r.phone || "",
    status: r.x_espo_status || "New",
    source: r.x_espo_source || "",
    industry: r.x_industry || "",
    stageId,
    stageName: stageName || "",
    probability: r.probability ?? null,
    opportunityAmount: r.expected_revenue ?? null,
    opportunityAmountCurrency: currencyNm || "",
    closeDate: r.date_deadline || null,
    doNotCall: !!r.x_do_not_call,
    website: r.website || "",
    description: r.description || "",
    addressStreet: r.street || "",
    addressStreet2: r.street2 || "",
    addressCity: r.city || "",
    addressState: stateName || "",
    addressCountry: countryName || "",
    addressPostalCode: r.zip || "",
    assignedUserId: userId,
    assignedUserName: userName || "",
    teamsIds: teamId ? [teamId] : [],
    teamsNames: teamId && teamName ? { [teamId]: teamName } : null,
    campaignId: campId,
    campaignName: campName || "",
    createdAt: toIsoLocal(r.create_date),
    modifiedAt: toIsoLocal(r.write_date),
    createdById: createUid,
    createdByName: createUidNm || "",
    modifiedById: writeUid,
    modifiedByName: writeUidNm || "",
    convertedAt: isConverted ? toIsoLocal(r.write_date) : null,
    isFollowed: Array.isArray(r.message_partner_ids) && r.message_partner_ids.length > 0,
    followersIds: r.message_partner_ids || [],
  };
}

function espoToOdooVals(v: Partial<LeadRow> & Record<string, any>) {
  const out: Record<string, any> = {};
  if (v.name !== undefined) out.name = v.name;
  if (v.firstName !== undefined || v.lastName !== undefined) {
    const fn = v.firstName ?? "";
    const ln = v.lastName ?? "";
    out.contact_name = `${fn} ${ln}`.trim();
    out.x_first_name = fn || false;
    out.x_last_name = ln || false;
    // NOTE: do NOT auto-fill out.name from contact_name here — that would clobber
    // the Opportunity name on update. createLead() applies the fallback when needed.
  }
  if (v.salutationName !== undefined) out.x_salutation = v.salutationName || false;
  if (v.title !== undefined) out.function = v.title || false;
  if (v.accountName !== undefined) out.partner_name = v.accountName || false;
  if (v.emailAddress !== undefined) out.email_from = v.emailAddress || false;
  if (v.phoneNumber !== undefined) out.phone = v.phoneNumber || false;
  if (v.status !== undefined) out.x_espo_status = v.status || false;
  if (v.source !== undefined) out.x_espo_source = v.source || false;
  if (v.industry !== undefined) out.x_industry = v.industry || false;
  if (v.doNotCall !== undefined) out.x_do_not_call = !!v.doNotCall;
  if (v.website !== undefined) out.website = v.website || false;
  if (v.description !== undefined) out.description = v.description || false;
  if (v.opportunityAmount !== undefined)
    out.expected_revenue =
      v.opportunityAmount === null || v.opportunityAmount === undefined
        ? 0
        : Number(v.opportunityAmount);
  if (v.probability !== undefined)
    out.probability = v.probability == null ? false : Number(v.probability);
  if (v.closeDate !== undefined) out.date_deadline = v.closeDate || false;
  return out;
}

export type ListParams = {
  search?: string;
  statusFilter?: string;
  limit?: number;
  offset?: number;
  order?: string;
};

export async function listLeads(
  params: ListParams = {}
): Promise<{ list: LeadRow[]; total: number }> {
  const { search = "", statusFilter = "", limit = 25, offset = 0, order = "create_date desc" } = params;
  const domain: any[] = [["type", "=", "lead"]];
  if (statusFilter) domain.push(["x_espo_status", "=", statusFilter]);
  if (search) {
    // Mirrors orchestrix-v2's textFilter — OR across name+contact+email+phone+partner_name.
    domain.push(
      "|",
      "|",
      "|",
      "|",
      ["name", "ilike", search],
      ["contact_name", "ilike", search],
      ["email_from", "ilike", search],
      ["phone", "ilike", search],
      ["partner_name", "ilike", search]
    );
  }

  const [rows, total] = await Promise.all([
    call<any[]>("crm.lead", "search_read", [domain], {
      fields: READ_FIELDS,
      limit,
      offset,
      order,
    }),
    call<number>("crm.lead", "search_count", [domain]),
  ]);
  return { list: rows.map(odooToEspoLead), total };
}

export async function getLead(id: string | number): Promise<LeadRow | null> {
  const rows = await call<any[]>("crm.lead", "read", [[Number(id)]], { fields: READ_FIELDS });
  return rows && rows[0] ? odooToEspoLead(rows[0]) : null;
}

export async function createLead(vals: Partial<LeadRow>): Promise<{ id: string }> {
  const odooVals = espoToOdooVals(vals);
  if (!odooVals.name) odooVals.name = odooVals.contact_name || "Untitled lead";
  if (!odooVals.type) odooVals.type = "lead";
  const id = await call<number>("crm.lead", "create", [odooVals]);
  return { id: String(id) };
}

export async function updateLead(id: string | number, vals: Partial<LeadRow>): Promise<{ id: string }> {
  await call("crm.lead", "write", [[Number(id)], espoToOdooVals(vals)]);
  return { id: String(id) };
}

export async function deleteLead(id: string | number): Promise<void> {
  await call("crm.lead", "unlink", [[Number(id)]]);
}
