/**
 * Shared status → Badge variant mapping. Used by both the leads list and the
 * lead detail page so they stay in sync if we ever re-tune the palette.
 */
import type { TBadgeVariant } from "@plane/ui";

export const LEAD_STATUS_VARIANT: Record<string, TBadgeVariant> = {
  New: "accent-primary",
  Assigned: "accent-warning",
  "In Process": "primary",
  Converted: "accent-success",
  Recycled: "accent-neutral",
  Dead: "accent-destructive",
};

export const leadStatusVariant = (status: string | undefined | null): TBadgeVariant =>
  (status && LEAD_STATUS_VARIANT[status]) || "accent-neutral";
