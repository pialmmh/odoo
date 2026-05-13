/**
 * LeadConvertDialog — converts a lead into Account / Contact / Opportunity.
 *
 * Mirrors orchestrix-v2's pages/crm/ConvertDialog.jsx (the older Espo-backed
 * one — the odoo-clone never built it). Three collapsible sections, each
 * toggleable; on submit the convertLead() service runs the create + write-back
 * sequence against Odoo.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Button, EModalWidth, ModalCore } from "@plane/ui";
// services
import {
  ACCOUNT_TYPES,
  convertLead,
  OPPORTUNITY_STAGES,
  type ConvertSelection,
} from "@/services/crm/leads-convert";
import { LEAD_SOURCES, type LeadRow } from "@/services/crm/leads";

type Props = {
  isOpen: boolean;
  lead: LeadRow | null;
  onClose: () => void;
  onConverted?: () => void;
};

const inputClass =
  "block w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-2.5 py-1.5 text-13 text-primary placeholder-tertiary focus:outline-none";
const labelClass = "block text-12 font-medium text-secondary mb-1";

type AccountForm = {
  name: string;
  type: string;
  emailAddress: string;
  phoneNumber: string;
  industry: string;
  website: string;
  street: string;
  city: string;
};
type ContactForm = {
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  title: string;
};
type OpportunityForm = {
  name: string;
  stage: string;
  amount: string;
  closeDate: string;
  leadSource: string;
  description: string;
};

const defaultCloseDate = () => {
  const d = new Date(Date.now() + 14 * 86400000);
  return d.toISOString().slice(0, 10);
};

function defaultsFromLead(lead: LeadRow | null): {
  acc: AccountForm;
  con: ContactForm;
  opp: OpportunityForm;
} {
  const fullName =
    lead?.name ||
    `${lead?.firstName || ""} ${lead?.lastName || ""}`.trim() ||
    lead?.contactName ||
    "";
  const oppName =
    lead?.accountName && fullName
      ? `${lead.accountName} — ${fullName}`
      : fullName || lead?.accountName || "";

  return {
    acc: {
      name: lead?.accountName || "",
      type: "",
      emailAddress: lead?.emailAddress || "",
      phoneNumber: lead?.phoneNumber || "",
      industry: lead?.industry || "",
      website: lead?.website || "",
      street: lead?.addressStreet || "",
      city: lead?.addressCity || "",
    },
    con: {
      firstName: lead?.firstName || "",
      lastName: lead?.lastName || "",
      emailAddress: lead?.emailAddress || "",
      phoneNumber: lead?.phoneNumber || "",
      title: lead?.title || "",
    },
    opp: {
      name: oppName,
      stage: "Prospecting",
      amount: lead?.opportunityAmount != null ? String(lead.opportunityAmount) : "0",
      closeDate: lead?.closeDate || defaultCloseDate(),
      leadSource: lead?.source || "",
      description: lead?.description || "",
    },
  };
}

export function LeadConvertDialog({ isOpen, lead, onClose, onConverted }: Props) {
  const [enabled, setEnabled] = useState({ Account: true, Contact: true, Opportunity: true });
  const [acc, setAcc] = useState<AccountForm>(defaultsFromLead(null).acc);
  const [con, setCon] = useState<ContactForm>(defaultsFromLead(null).con);
  const [opp, setOpp] = useState<OpportunityForm>(defaultsFromLead(null).opp);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const d = defaultsFromLead(lead);
    setAcc(d.acc);
    setCon(d.con);
    setOpp(d.opp);
    setEnabled({ Account: true, Contact: true, Opportunity: true });
    setErr(null);
  }, [isOpen, lead]);

  const validate = (): string | null => {
    if (!enabled.Account && !enabled.Contact && !enabled.Opportunity)
      return "Select at least one record type to create";
    const missing: string[] = [];
    if (enabled.Account && !acc.name.trim()) missing.push("Account: Name");
    if (enabled.Contact && !con.lastName.trim()) missing.push("Contact: Last Name");
    if (enabled.Opportunity) {
      if (!opp.name.trim()) missing.push("Opportunity: Name");
      if (opp.amount === "" || opp.amount == null) missing.push("Opportunity: Amount");
      if (!opp.closeDate) missing.push("Opportunity: Close Date");
    }
    return missing.length ? `Required: ${missing.join(", ")}` : null;
  };

  const handleConvert = async () => {
    if (!lead) return;
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const selection: ConvertSelection = {};
      if (enabled.Account)
        selection.account = {
          name: acc.name,
          type: acc.type || undefined,
          emailAddress: acc.emailAddress,
          phoneNumber: acc.phoneNumber,
          industry: acc.industry,
          website: acc.website,
          street: acc.street,
          city: acc.city,
        };
      if (enabled.Contact)
        selection.contact = {
          firstName: con.firstName,
          lastName: con.lastName,
          emailAddress: con.emailAddress,
          phoneNumber: con.phoneNumber,
          title: con.title,
        };
      if (enabled.Opportunity)
        selection.opportunity = {
          name: opp.name,
          stage: opp.stage,
          amount: opp.amount,
          closeDate: opp.closeDate,
          leadSource: opp.leadSource,
          description: opp.description,
        };
      await convertLead(lead.id, selection);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Converted",
        message: "Lead converted successfully.",
      });
      onConverted?.();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Convert failed";
      setErr(msg);
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.XXXXL}>
      <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
        <h2 className="text-16 font-semibold text-primary">
          Convert Lead{lead?.name ? ` — ${lead.name}` : ""}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-tertiary hover:bg-surface-2 hover:text-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
        {err && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-13 text-red-600">
            {err}
          </div>
        )}

        {/* Account section */}
        <Section
          title="Account"
          checked={enabled.Account}
          onToggle={(v) => setEnabled((s) => ({ ...s, Account: v }))}
        >
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-8">
              <label className={labelClass}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={acc.name}
                onChange={(e) => setAcc({ ...acc, name: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className={labelClass}>Type</label>
              <select
                className={inputClass}
                value={acc.type}
                onChange={(e) => setAcc({ ...acc, type: e.target.value })}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t || "none"} value={t}>
                    {t || "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={acc.emailAddress}
                onChange={(e) => setAcc({ ...acc, emailAddress: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>Phone</label>
              <input
                className={inputClass}
                value={acc.phoneNumber}
                onChange={(e) => setAcc({ ...acc, phoneNumber: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>Industry</label>
              <input
                className={inputClass}
                value={acc.industry}
                onChange={(e) => setAcc({ ...acc, industry: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>Website</label>
              <input
                className={inputClass}
                value={acc.website}
                onChange={(e) => setAcc({ ...acc, website: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-8">
              <label className={labelClass}>Street</label>
              <input
                className={inputClass}
                value={acc.street}
                onChange={(e) => setAcc({ ...acc, street: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className={labelClass}>City</label>
              <input
                className={inputClass}
                value={acc.city}
                onChange={(e) => setAcc({ ...acc, city: e.target.value })}
              />
            </div>
          </div>
        </Section>

        {/* Contact section */}
        <Section
          title="Contact"
          checked={enabled.Contact}
          onToggle={(v) => setEnabled((s) => ({ ...s, Contact: v }))}
        >
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>First Name</label>
              <input
                className={inputClass}
                value={con.firstName}
                onChange={(e) => setCon({ ...con, firstName: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={con.lastName}
                onChange={(e) => setCon({ ...con, lastName: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={con.emailAddress}
                onChange={(e) => setCon({ ...con, emailAddress: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>Phone</label>
              <input
                className={inputClass}
                value={con.phoneNumber}
                onChange={(e) => setCon({ ...con, phoneNumber: e.target.value })}
              />
            </div>
            <div className="col-span-12">
              <label className={labelClass}>Title (Job role)</label>
              <input
                className={inputClass}
                value={con.title}
                onChange={(e) => setCon({ ...con, title: e.target.value })}
              />
            </div>
          </div>
        </Section>

        {/* Opportunity section */}
        <Section
          title="Opportunity"
          checked={enabled.Opportunity}
          onToggle={(v) => setEnabled((s) => ({ ...s, Opportunity: v }))}
        >
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <label className={labelClass}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={opp.name}
                onChange={(e) => setOpp({ ...opp, name: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className={labelClass}>Stage</label>
              <select
                className={inputClass}
                value={opp.stage}
                onChange={(e) => setOpp({ ...opp, stage: e.target.value })}
              >
                {OPPORTUNITY_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className={labelClass}>
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={opp.amount}
                onChange={(e) => setOpp({ ...opp, amount: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className={labelClass}>
                Close Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={inputClass}
                value={opp.closeDate}
                onChange={(e) => setOpp({ ...opp, closeDate: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>Lead Source</label>
              <select
                className={inputClass}
                value={opp.leadSource}
                onChange={(e) => setOpp({ ...opp, leadSource: e.target.value })}
              >
                <option value="">—</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12">
              <label className={labelClass}>Description</label>
              <textarea
                rows={4}
                className={`${inputClass} resize-y`}
                value={opp.description}
                onChange={(e) => setOpp({ ...opp, description: e.target.value })}
              />
            </div>
          </div>
        </Section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-subtle px-6 py-4">
        <Button variant="neutral-primary" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleConvert} disabled={saving}>
          {saving ? "Converting…" : "Convert"}
        </Button>
      </div>
    </ModalCore>
  );
}

type SectionProps = {
  title: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
};
function Section({ title, checked, onToggle, children }: SectionProps) {
  return (
    <div className="rounded-md border border-subtle bg-surface-1">
      <div className="flex items-center gap-2 border-b border-subtle px-4 py-3">
        <input
          id={`section-${title}`}
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-4 rounded border-subtle-1"
        />
        <label htmlFor={`section-${title}`} className="text-13 font-semibold text-primary">
          {title}
        </label>
      </div>
      {checked && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}
