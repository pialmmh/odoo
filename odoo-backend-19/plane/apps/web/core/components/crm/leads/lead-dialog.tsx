/**
 * LeadDialog — Plane @plane/ui translation of orchestrix-v2/ui's LeadDialog.jsx.
 *
 * Layout follows the same 12-column grid as the Fluent original:
 *   Row 1: Salutation(2) + FirstName(5) + LastName(5)
 *   Row 2: JobTitle(6) + Account(6)
 *   Row 3: Email(6) + Phone(6)
 *   Row 4: Status(4) + Source(4) + Industry(4)
 *   Row 5: OpportunityAmount(6) + Website(6)
 *   Row 6: Description(12)
 *   Row 7: DoNotCall toggle(12)
 *
 * Uses Plane's ModalCore + Tailwind primitives (no Fluent UI). Same field set;
 * same backing service; same save semantics (create when no id, update otherwise).
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Button, EModalWidth, ModalCore } from "@plane/ui";
// services
import {
  createLead,
  updateLead,
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_SALUTATIONS,
  type LeadRow,
} from "@/services/crm/leads";

type Props = {
  isOpen: boolean;
  lead?: LeadRow | null;
  onClose: () => void;
  onSaved?: () => void;
};

const EMPTY_FORM = {
  salutationName: "",
  firstName: "",
  lastName: "",
  title: "",
  accountName: "",
  emailAddress: "",
  phoneNumber: "",
  status: "New",
  source: "",
  industry: "",
  opportunityAmount: "" as string | number,
  doNotCall: false,
  website: "",
  description: "",
};

const inputClass =
  "block w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-2.5 py-1.5 text-13 text-primary placeholder-tertiary focus:outline-none";

const labelClass = "block text-12 font-medium text-secondary mb-1";

export function LeadDialog({ isOpen, lead, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!lead?.id;
  const set = <K extends keyof typeof EMPTY_FORM>(k: K) =>
    (v: (typeof EMPTY_FORM)[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isOpen) return;
    if (lead) {
      setForm({
        salutationName: lead.salutationName || "",
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        title: lead.title || "",
        accountName: lead.accountName || "",
        emailAddress: lead.emailAddress || "",
        phoneNumber: lead.phoneNumber || "",
        status: lead.status || "New",
        source: lead.source || "",
        industry: lead.industry || "",
        opportunityAmount: lead.opportunityAmount ?? "",
        doNotCall: !!lead.doNotCall,
        website: lead.website || "",
        description: lead.description || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErr(null);
  }, [isOpen, lead]);

  const handleSave = async () => {
    if (!form.lastName.trim()) {
      setErr("Last name is required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        opportunityAmount:
          form.opportunityAmount === "" || form.opportunityAmount === null
            ? null
            : Number(form.opportunityAmount),
      };
      if (isEdit && lead) await updateLead(lead.id, payload as Partial<LeadRow>);
      else await createLead(payload as Partial<LeadRow>);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Saved",
        message: isEdit ? "Lead updated." : "Lead created.",
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Save failed";
      setErr(msg);
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.XXXXL}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
        <h2 className="text-16 font-semibold text-primary">{isEdit ? "Edit Lead" : "New Lead"}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-tertiary hover:bg-surface-2 hover:text-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
        {err && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-13 text-red-600">
            {err}
          </div>
        )}

        <div className="grid grid-cols-12 gap-x-4 gap-y-4">
          {/* Row 1: Salutation(2) + FirstName(5) + LastName(5) */}
          <div className="col-span-12 sm:col-span-6 md:col-span-2">
            <label className={labelClass}>Title</label>
            <select
              value={form.salutationName}
              onChange={(e) => set("salutationName")(e.target.value)}
              className={inputClass}
            >
              {LEAD_SALUTATIONS.map((s) => (
                <option key={s || "none"} value={s}>
                  {s || "—"}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-5">
            <label className={labelClass}>First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-5">
            <label className={labelClass}>
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              className={`${inputClass} ${err && !form.lastName.trim() ? "border-red-500" : ""}`}
            />
          </div>

          {/* Row 2: JobTitle(6) + Account(6) */}
          <div className="col-span-12 md:col-span-6">
            <label className={labelClass}>Job Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className={labelClass}>Account / Company</label>
            <input
              type="text"
              value={form.accountName}
              onChange={(e) => set("accountName")(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Row 3: Email(6) + Phone(6) */}
          <div className="col-span-12 md:col-span-6">
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={form.emailAddress}
              onChange={(e) => set("emailAddress")(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={form.phoneNumber}
              onChange={(e) => set("phoneNumber")(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Row 4: Status(4) + Source(4) + Industry(4) */}
          <div className="col-span-12 sm:col-span-6 md:col-span-4">
            <label className={labelClass}>Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status")(e.target.value)}
              className={inputClass}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-4">
            <label className={labelClass}>Source</label>
            <select
              value={form.source}
              onChange={(e) => set("source")(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-4">
            <label className={labelClass}>Industry</label>
            <input
              type="text"
              value={form.industry}
              onChange={(e) => set("industry")(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Row 5: OpportunityAmount(6) + Website(6) */}
          <div className="col-span-12 md:col-span-6">
            <label className={labelClass}>Opportunity Amount</label>
            <input
              type="number"
              value={String(form.opportunityAmount ?? "")}
              onChange={(e) => set("opportunityAmount")(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className={labelClass}>Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => set("website")(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Row 6: Description(12) */}
          <div className="col-span-12">
            <label className={labelClass}>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              className={`${inputClass} resize-y`}
            />
          </div>

          {/* Row 7: DoNotCall switch */}
          <div className="col-span-12 flex items-center gap-2">
            <input
              id="lead-do-not-call"
              type="checkbox"
              checked={form.doNotCall}
              onChange={(e) => set("doNotCall")(e.target.checked)}
              className="size-4 rounded border-subtle-1"
            />
            <label htmlFor="lead-do-not-call" className="text-13 text-primary">
              Do Not Call
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-subtle px-6 py-4">
        <Button variant="neutral-primary" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save" : "Create Lead"}
        </Button>
      </div>
    </ModalCore>
  );
}
