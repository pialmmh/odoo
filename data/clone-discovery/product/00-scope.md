# Scope — Product clone discovery

**Slug:** `product`
**Date:** 2026-04-29
**Odoo URL (input):** `http://localhost:7169/web#action=278&model=product.template&view_type=list&cids=1&menu_id=138`
**Odoo server_version:** `17.0` (server_version_info `[17,0,0,"final",0,""]`)
**DB:** `odoo_billing`

## Scope statement (verbatim from the user)

> Clone the Products menu (action 278, model product.template, menu_id 138) — list view + form view + search facets.

## Style / parity policy (from the user)

The React clone uses our modern admin app style (Fluent UI v9, our theme tokens),
**NOT a pixel clone** of Odoo's look. Discovery captures STRUCTURAL parity only:

- Which fields appear on the form, in what notebook tabs, with what groupings.
- Which statusbar values and which transitions.
- Which Many2one targets and which selection enums.
- Which list columns are default-visible, which are optional.
- Which search facets / filters / group-by options are exposed.
- Which kanban groupings + kanban template fields are used.

`discovery/tokens.json` captures Odoo's computed design tokens for reference
only — visual styling on our side is independent.

## Output contract

Files written under `data/clone-discovery/product/`. No code in `api/`, `ui/`, `erp-api/`. Idempotent — re-run overwrites.
