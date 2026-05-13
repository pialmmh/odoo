/**
 * CRM Leads list — Odoo crm.lead via the Spring Boot gateway.
 *
 * Layout mirrors orchestrix-v2/ui/src/pages/crm-odoo/Leads.jsx and the EspoCRM
 * UI it was modelled on: colored status pills, sub-row company name, action
 * column with edit + delete, refresh button, "N leads total" caption. Row click
 * navigates to the detail page.
 */
import { useEffect, useState } from "react";
import { MessageCircle, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
// plane imports
import { Input } from "@plane/propel/input";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Badge, Button } from "@plane/ui";
// chat
import { ensureLeadChannel, openChannel } from "@/components/chat/chat-store";
// services
import { deleteLead, listLeads, LEAD_STATUSES, type LeadRow } from "@/services/crm/leads";
// local
import { LeadDialog } from "./lead-dialog";
import { leadStatusVariant } from "./lead-status";

const PAGE_SIZE = 25;

export const LeadList = function LeadList() {
  const { workspaceSlug } = useParams();
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLeads({ search, statusFilter, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setRows(res.list);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.message || err?.message || "Failed to load leads";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, page, reloadTick]);

  const openNew = () => {
    setEditingLead(null);
    setDialogOpen(true);
  };
  const openEdit = (e: React.MouseEvent, row: LeadRow) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingLead(row);
    setDialogOpen(true);
  };
  const handleOpenChat = (e: React.MouseEvent, row: LeadRow) => {
    e.preventDefault();
    e.stopPropagation();
    const personName =
      row.name || `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.contactName || `lead-${row.id}`;
    const channel = ensureLeadChannel({
      leadId: row.id,
      leadName: personName,
      ownerName: row.assignedUserName,
    });
    openChannel(channel.id);
  };
  const handleDelete = async (e: React.MouseEvent, row: LeadRow) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete lead "${row.name}"? This cannot be undone.`)) return;
    try {
      await deleteLead(row.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Deleted", message: "Lead removed." });
      setReloadTick((t) => t + 1);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Delete failed";
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: msg });
    }
  };
  const handleSaved = () => setReloadTick((t) => t + 1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slug = workspaceSlug?.toString() || "";
  const fromIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
      {/* Toolbar — title row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-20 font-semibold text-primary">Leads</h1>
          <p className="text-12 text-tertiary mt-0.5">
            {total} {total === 1 ? "lead" : "leads"} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="neutral-primary"
            size="sm"
            prependIcon={<RefreshCw className="size-3.5" />}
            onClick={() => setReloadTick((t) => t + 1)}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" prependIcon={<Plus className="size-3.5" />} onClick={openNew}>
            Create Lead
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" />
          <Input
            mode="primary"
            inputSize="sm"
            className="w-full pl-9 pr-3 py-2"
            placeholder="Search leads — name, email, phone, account…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 text-primary focus:outline-none"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-md border border-subtle">
        <table className="w-full text-13">
          <thead className="sticky top-0 z-[1] bg-surface-2 text-12 text-tertiary">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Phone</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 text-left font-medium">Owner</th>
              <th className="px-3 py-2 text-left font-medium">Created</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-tertiary">
                  Loading leads…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-tertiary">
                  No leads found.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((r) => {
                const detailHref = `/${slug}/crm/leads/${r.id}`;
                const variant = leadStatusVariant(r.status);
                const personName =
                  r.name ||
                  `${r.firstName || ""} ${r.lastName || ""}`.trim() ||
                  r.contactName ||
                  "—";
                return (
                  <tr key={r.id} className="border-t border-subtle hover:bg-surface-2/60">
                    <td className="px-3 py-2">
                      <Link href={detailHref} className="block">
                        <div className="font-medium text-accent-primary hover:underline">
                          {personName}
                        </div>
                        {r.accountName && (
                          <div className="text-12 text-tertiary mt-0.5">{r.accountName}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={variant} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-secondary">
                      {r.emailAddress ? (
                        <a
                          href={`mailto:${r.emailAddress}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {r.emailAddress}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-secondary">{r.phoneNumber || "—"}</td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {r.opportunityAmount != null ? r.opportunityAmount.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-secondary">{r.assignedUserName || "—"}</td>
                    <td className="px-3 py-2 text-tertiary">{r.createdAt || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Open lead chat"
                          onClick={(e) => handleOpenChat(e, r)}
                          className="rounded p-1 text-accent-primary hover:bg-accent-primary/10"
                        >
                          <MessageCircle className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Edit lead"
                          onClick={(e) => openEdit(e, r)}
                          className="rounded p-1 text-amber-500 hover:bg-amber-500/10"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete lead"
                          onClick={(e) => handleDelete(e, r)}
                          className="rounded p-1 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <div className="text-12 text-tertiary">
            {fromIdx}–{toIdx} of {total} · Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="neutral-primary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="neutral-primary"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <LeadDialog
        isOpen={dialogOpen}
        lead={editingLead}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
};
