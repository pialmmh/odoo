/**
 * LeadDetail — full detail page for a single lead.
 *
 * Layout mirrors orchestrix-v2/ui/src/pages/crm-odoo/LeadDetail.jsx:
 *   - Header card (icon + breadcrumb + title + subtitle)
 *   - Action bar (Edit + ⋯ left ; Prev/Next + Follow + Convert right)
 *   - 8/4 grid: main panels (Overview / Details / Stream)
 *                + side panels (Overview/audit / Converted To / Activities / History / Tasks)
 *   - Edit reuses LeadDialog. Convert opens LeadConvertDialog.
 *   - Prev/Next/Follow + Activities/History/Tasks are visual stubs (matches source).
 */
import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  PlusCircle,
  Rss,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Badge, Button } from "@plane/ui";
// services
import {
  deleteLead,
  getLead,
  LEAD_NOT_ACTUAL_STATUSES,
  type LeadRow,
} from "@/services/crm/leads";
// local
import { LeadChatPanel } from "@/components/chat/lead-chat-panel";
import { LeadConvertDialog } from "./lead-convert-dialog";
import { LeadDialog } from "./lead-dialog";
import { leadStatusVariant } from "./lead-status";

function formatAddress(l: LeadRow): string {
  return [l.addressStreet, l.addressCity, l.addressState, l.addressCountry, l.addressPostalCode]
    .filter(Boolean)
    .join(", ");
}

function formatAudit(ts: string, who: string): string {
  if (!ts) return "";
  return who ? `${ts} · ${who}` : ts;
}

type FieldProps = {
  label: string;
  icon?: React.ReactNode;
  value?: React.ReactNode;
  half?: boolean;
};
function Field({ label, icon, value, half = true }: FieldProps) {
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && !value.trim());
  return (
    <div className={half ? "col-span-12 sm:col-span-6" : "col-span-12"}>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1 text-11 font-semibold uppercase tracking-wider text-tertiary">
          {icon}
          <span>{label}</span>
        </div>
        <div
          className={`mt-1 text-13 break-words ${empty ? "italic text-placeholder" : "text-primary"}`}
        >
          {empty ? "None" : value}
        </div>
      </div>
    </div>
  );
}

type PanelProps = {
  title: string;
  headerExtra?: React.ReactNode;
  variant?: "default" | "converted";
  children: React.ReactNode;
};
function Panel({ title, headerExtra, variant = "default", children }: PanelProps) {
  return (
    <div
      className={`rounded-md border border-subtle bg-surface-1 overflow-hidden ${
        variant === "converted" ? "border-t-2 border-t-green-500" : ""
      }`}
    >
      <div className="bg-surface-2 border-b border-subtle px-4 py-3 flex items-center justify-between">
        <span className="text-13 font-semibold text-primary">{title}</span>
        {headerExtra}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

export function LeadDetail() {
  const { workspaceSlug, leadId } = useParams();
  const slug = workspaceSlug?.toString() || "";
  const id = leadId?.toString() || "";
  const listPath = `/${slug}/crm/leads`;

  const [lead, setLead] = useState<LeadRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLead(id)
      .then((res) => {
        if (cancelled) return;
        setLead(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || "Failed to load lead");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadTick]);

  const handleDelete = async () => {
    if (!lead) return;
    if (!confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) return;
    try {
      await deleteLead(lead.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Deleted", message: "Lead removed." });
      window.location.href = listPath;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Delete failed";
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: msg });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-tertiary">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="m-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-13 text-red-600">
        {error || "Lead not found"}
      </div>
    );
  }

  const isConvertable = lead.status && !LEAD_NOT_ACTUAL_STATUSES.includes(lead.status as any);
  const hasConvertedTo = lead.status === "Converted";
  const personName =
    lead.name || `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || lead.contactName || "—";
  const subtitle = lead.title
    ? `${lead.title}${lead.accountName ? ` · ${lead.accountName}` : ""}`
    : lead.accountName || "";
  const variant = leadStatusVariant(lead.status);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header card */}
      <div className="flex items-center gap-4 rounded-md border border-subtle bg-surface-1 px-6 py-4">
        <div className="size-10 rounded-md bg-accent-subtle text-accent-primary flex items-center justify-center flex-shrink-0">
          <UserPlus className="size-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="text-12">
            <Link href={listPath} className="text-accent-primary hover:underline">
              Leads
            </Link>
            <span className="text-tertiary"> ›</span>
          </div>
          <h1 className="text-16 font-semibold text-primary truncate">{personName}</h1>
          {subtitle && <p className="text-12 text-tertiary truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            prependIcon={<Pencil className="size-3.5" />}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete"
            className="rounded-md border border-subtle bg-surface-1 p-1.5 text-tertiary hover:bg-red-500/10 hover:text-red-500"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="More"
            className="rounded-md border border-subtle bg-surface-1 p-1.5 text-tertiary hover:bg-surface-2 hover:text-primary"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous"
            className="rounded-md p-1.5 text-tertiary hover:bg-surface-2 hover:text-primary"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            className="rounded-md p-1.5 text-tertiary hover:bg-surface-2 hover:text-primary"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <Button
            variant={lead.isFollowed ? "primary" : "neutral-primary"}
            size="sm"
            prependIcon={<Rss className="size-3.5" />}
          >
            {lead.isFollowed ? "Followed" : "Follow"}
          </Button>
          {isConvertable && (
            <Button variant="primary" size="sm" onClick={() => setConvertOpen(true)}>
              Convert
            </Button>
          )}
        </div>
      </div>

      {/* 8/4 grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Main column (8) */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Overview */}
          <Panel title="Overview">
            <div className="grid grid-cols-12 gap-x-4 gap-y-4">
              <Field label="Name" icon={<User className="size-3" />} value={personName} />
              <Field
                label="Account Name"
                icon={<Building2 className="size-3" />}
                value={lead.accountName}
              />
              <Field
                label="Email"
                icon={<Mail className="size-3" />}
                value={
                  lead.emailAddress ? (
                    <a className="text-accent-primary hover:underline" href={`mailto:${lead.emailAddress}`}>
                      {lead.emailAddress}
                    </a>
                  ) : null
                }
              />
              <Field
                label="Phone"
                icon={<Phone className="size-3" />}
                value={
                  lead.phoneNumber ? (
                    <a className="text-accent-primary hover:underline" href={`tel:${lead.phoneNumber}`}>
                      {lead.phoneNumber}
                    </a>
                  ) : null
                }
              />
              <Field label="Title" value={lead.title} />
              <Field
                label="Website"
                icon={<Globe className="size-3" />}
                value={
                  lead.website ? (
                    <a
                      className="text-accent-primary hover:underline"
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {lead.website}
                    </a>
                  ) : null
                }
              />
              <Field
                half={false}
                label="Address"
                icon={<MapPin className="size-3" />}
                value={formatAddress(lead)}
              />
            </div>
          </Panel>

          {/* Details */}
          <Panel title="Details">
            <div className="grid grid-cols-12 gap-x-4 gap-y-4">
              <Field
                label="Status"
                value={
                  lead.status ? (
                    <Badge variant={variant} size="sm">
                      {lead.status}
                    </Badge>
                  ) : null
                }
              />
              <Field label="Source" value={lead.source} />
              <Field
                label="Opportunity Amount"
                value={
                  lead.opportunityAmount != null && lead.opportunityAmount !== 0
                    ? `${lead.opportunityAmountCurrency || ""} ${lead.opportunityAmount.toLocaleString()}`.trim()
                    : null
                }
              />
              <Field label="Campaign" value={lead.campaignName} />
              <Field label="Industry" value={lead.industry} />
              {lead.doNotCall && <Field label="Do Not Call" value="Yes" />}
              <Field half={false} label="Description" value={lead.description} />
            </div>
          </Panel>

          {/* Chat — Rocket.Chat-style channel pinned to this lead. Replaces
              the placeholder Stream panel from the orchestrix-v2 source. */}
          <LeadChatPanel
            leadId={lead.id}
            leadName={personName}
            ownerName={lead.assignedUserName}
          />
        </div>

        {/* Side column (4) */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Panel title="Overview">
            <div className="grid grid-cols-12 gap-x-4 gap-y-4">
              <Field half={false} label="Assigned User" value={lead.assignedUserName} />
              <Field
                half={false}
                label="Teams"
                value={lead.teamsNames ? Object.values(lead.teamsNames).join(", ") : null}
              />
              {lead.convertedAt && (
                <Field half={false} label="Converted At" value={lead.convertedAt} />
              )}
              <Field
                half={false}
                label="Created"
                value={formatAudit(lead.createdAt, lead.createdByName)}
              />
              <Field
                half={false}
                label="Modified"
                value={formatAudit(lead.modifiedAt, lead.modifiedByName)}
              />
            </div>
          </Panel>

          {hasConvertedTo && (
            <Panel title="Converted To" variant="converted">
              <div className="grid grid-cols-12 gap-x-4 gap-y-4">
                <Field half={false} label="Account" value={lead.accountName} />
                <Field
                  half={false}
                  label="Contact"
                  value={`${lead.firstName || ""} ${lead.lastName || ""}`.trim()}
                />
                <Field half={false} label="Opportunity" value={null} />
              </div>
            </Panel>
          )}

          <Panel
            title="Activities"
            headerExtra={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="New email"
                  className="rounded p-1 text-tertiary hover:bg-surface-1 hover:text-primary"
                >
                  <Mail className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="New meeting"
                  className="rounded p-1 text-tertiary hover:bg-surface-1 hover:text-primary"
                >
                  <Calendar className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="New call"
                  className="rounded p-1 text-tertiary hover:bg-surface-1 hover:text-primary"
                >
                  <PlusCircle className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="More"
                  className="rounded p-1 text-tertiary hover:bg-surface-1 hover:text-primary"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </div>
            }
          >
            <div className="text-13 italic text-placeholder py-2">No Data</div>
          </Panel>

          <Panel title="History">
            <div className="text-13 italic text-placeholder py-2">No Data</div>
          </Panel>

          <Panel
            title="Tasks"
            headerExtra={
              <button
                type="button"
                aria-label="Add task"
                className="rounded p-1 text-tertiary hover:bg-surface-1 hover:text-primary"
              >
                <Plus className="size-3.5" />
              </button>
            }
          >
            <div className="text-13 italic text-placeholder py-2">No Data</div>
          </Panel>
        </div>
      </div>

      <LeadDialog
        isOpen={editOpen}
        lead={lead}
        onClose={() => setEditOpen(false)}
        onSaved={() => setReloadTick((t) => t + 1)}
      />

      <LeadConvertDialog
        isOpen={convertOpen}
        lead={lead}
        onClose={() => setConvertOpen(false)}
        onConverted={() => setReloadTick((t) => t + 1)}
      />
    </div>
  );
}
