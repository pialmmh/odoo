# Odoo → iDempiere Clone — Discovery Protocol

**Companion to** `ai-docs/erp-react-clone-design.md`. Read that first for
the *what* and the *why*. This file is the *how*: a strict protocol the
helper agent follows so its output is reproducible, machine-readable, and
sufficient for a different agent to start coding without re-running
discovery.

---

## 1. The two-agent split

| Role          | Who                                 | Job                                                                    |
|---------------|-------------------------------------|------------------------------------------------------------------------|
| **Main agent**    | Claude in conversation with the user | Receive the user's clone request; launch the helper; review its output; write the actual code. |
| **Helper agent**  | Subagent launched via `Agent(subagent_type=general-purpose)` | Crawl Odoo, map to source, map to iDempiere, write the discovery database to disk, return a short summary. **Does not write app code.** |

The helper has its own context. Anything it learns and *doesn't* write to
disk is lost when it returns. Therefore: the helper writes everything to
the database. The main agent then reads from disk.

---

## 2. Inputs (what the user gives the main agent)

A clone request must contain at least:

1. **A live Odoo URL** — e.g. `http://localhost:7169/web#action=480&model=stock.picking.type&view_type=kanban&menu_id=311`
2. **A scope statement** — one of:
   - "clone this single page"
   - "clone this menu and all its children"
   - "clone these specific menu items: [list]"
   - "clone the whole `<module>` module"
3. **A short slug** the main agent picks (e.g. `inventory-operations`) —
   used as the directory name under `data/clone-discovery/`.

If anything is missing, the main agent asks before launching the helper.

---

## 3. The discovery database — file layout

One directory per clone request, under the orchestrix-erp worktree:

```
data/clone-discovery/<slug>/
├── 00-scope.md                user's request, decisions, version-of-Odoo
├── discovery/
│   ├── menus.json             menu subtree in scope
│   ├── actions.json           act_window records referenced
│   ├── models.json            ir.model.fields per res_model
│   ├── views.json             resolved arch per (model, view_type) — XML preserved
│   ├── views.parsed.json      arch parsed to JSON AST (fast-xml-parser style)
│   ├── tokens.json            computed design tokens (font, color, spacing)
│   ├── version.json           server_version_info from /web/webclient/version_info
│   └── screenshots/           one PNG per (view_type, representative_model) + chrome
├── mapping/
│   ├── odoo-source.md         per-model: Python class location, key methods, inheritance, gotchas
│   └── idempiere.md           per-model: iDempiere counterpart, field renames, gaps, write path (PO/GridTab/processIt)
└── summary.md                 helper agent's handoff to the main agent — read this first
```

**Why JSON for some, Markdown for others:** JSON for things a script
might consume (arch, fields, tokens). Markdown for narrative findings
that benefit from prose (mapping decisions, gaps, gotchas).

**File numbering** is for reading order, not for execution order.
`00-scope.md` is the index card; `summary.md` is the handoff.

---

## 4. Helper agent — exact prompt template

The main agent invokes the helper with a self-contained prompt. The
helper does **not** see the user's conversation. Therefore:

- Embed scope + URL + slug verbatim.
- Give the helper the protocol path (this file) and the design doc path.
- State the *one* deliverable (the database directory) and the brief
  summary form expected back.

Template:

```
You are the discovery helper for a clone-Odoo-into-our-ERP-app effort.

INPUT
- Odoo URL: <URL from user>
- Scope: <scope statement from user>
- Slug: <slug picked by main agent>

YOUR DELIVERABLE
A populated discovery database at:
  /home/mustafa/telcobright-projects/orchestrix-erp/data/clone-discovery/<slug>/
following the file layout in:
  /home/mustafa/telcobright-projects/orchestrix-erp/ai-docs/clone-discovery-protocol.md
(read §3 for paths, §5 for steps, §6 for content rules).

CONTEXT YOU NEED BEFORE STARTING
1. /home/mustafa/telcobright-projects/orchestrix-erp/ai-docs/erp-react-clone-design.md
   — the architectural target. Read §3 (target package layout) and §4
   (cloning workflow phases) so your mapping notes target the right
   shape.
2. /tmp/shared-instruction/erp-react-clone-bootstrap.md
   — operational rules. §4 hard rules apply to your output, especially:
   no vendor names in any text that could end up in the UI; no SQL
   strategies — write paths must use PO/GridTab/processIt + Doc.postImmediate.

TOOLS YOU SHOULD USE
- Playwright MCP (mcp__playwright__*) — login once, persist storage
  state, capture only the screenshots listed in protocol §5.4.
- jcodemunch MCP (mcp__jcodemunch-ai-vm__*) — search_symbols / 
  get_context_bundle / get_file_content against `odoo-src` and
  `idempiere-src`. Do NOT fall back to grep for these indexed repos.
- curl/bash — for Odoo JSON-RPC. Auth at /web/session/authenticate
  with db=odoo_billing user=admin password=admin.

YOU DO NOT
- Write any application code in api/, ui/, or erp-api/.
- Edit anything outside data/clone-discovery/<slug>/.
- Push to git. Do not commit. Leave staging clean.
- Loop screenshots per action — only the small set in protocol §5.4.

RETURN BRIEF
When done, return only:
  - The database path
  - 5-line summary of what you found (count of menus, actions, models,
    views; any models referenced but missing from ir.model)
  - Top 3 mapping risks for the main agent to consider
Do not paste file contents back. The main agent will read from disk.
```

The main agent passes this template with placeholders filled. Helper
runs to completion. Main agent then reads
`data/clone-discovery/<slug>/summary.md` first, then any other file
relevant to the coding task.

---

## 5. Helper agent — what it actually does, in order

### 5.1 Bootstrap

- `mkdir -p data/clone-discovery/<slug>/{discovery/screenshots,mapping}`
- Write `00-scope.md` with: the URL, the scope statement as given, the
  slug, today's date, and Odoo `server_version` (read from
  `/web/webclient/version_info` and saved to `discovery/version.json`).

### 5.2 Authenticate to Odoo

- POST to `/web/session/authenticate` with
  `{db: "odoo_billing", login: "admin", password: "admin"}`.
- Save the cookie. All subsequent JSON-RPC uses it.

### 5.3 Dump metadata via JSON-RPC

In this order, scoped to the user's chosen subtree:

1. **`menus.json`** — `GET /web/webclient/load_menus`. Walk the tree;
   keep only the chosen subtree. Each leaf has `action: "ir.actions.act_window,<id>"`.
2. **`actions.json`** — for each action ID found above, `read` on
   `ir.actions.act_window` with fields:
   `id, name, res_model, view_mode, view_ids, domain, context,
   search_view_id, target, limit, help`.
3. **`models.json`** — collect unique `res_model` values from
   `actions.json`. For each, `search_read` on `ir.model.fields` filtered
   by that model with fields:
   `name, field_description, ttype, relation, required, readonly,
   selection, help, store, related, depends, translate, copy`.
4. **`views.json`** — for each `(model, view_type)` pair, call
   `model.get_view({view_id, view_type})`. The response includes the
   resolved XML arch (already merged with inheritance). Save it raw.
5. **`views.parsed.json`** — parse each view's arch using
   `fast-xml-parser` with attribute preservation. Preserve verbatim:
   `string, name, widget, invisible, readonly, required, domain,
   context, options, class, groups, attrs, column_invisible,
   decoration-*, optional`. Form-specific: `<header>, <sheet>, <group>,
   <notebook>, <page>, <chatter>`. List-specific: `editable, multi_edit,
   default_order, decoration-success/danger`. Kanban: keep entire
   `<templates>` block as a raw string. Search: `<filter>, <separator>,
   <searchpanel>`.

If any model referenced by an action is missing from `ir.model`, log
it in `summary.md` under "models flagged" — do not silently drop.

### 5.3.1 Recursive arch walk (added 2026-04-29)

The flat `(model, view_type)` enumeration from §5.3 misses everything
the user can navigate *to* from a page — smart buttons, statusbar
buttons, embedded list views inside form `<field>` widgets,
context-jumping actions. Without this step the helper produces a
surface that looks complete on paper but feels half-clone in the
browser.

Walk every captured arch (kanban, list, form, search) and **enqueue
new discovery targets** until a depth limit or visited set saturates:

1. **Initialise** `visited = set(initial (model, view_type) pairs)`,
   `queue = those pairs`, `depth = {pair: 0}`. Default `MAX_DEPTH = 3`.
2. **Per pair, scan the arch's JSON AST for**:
   - `<field name="X">` whose `ttype` is `many2one` / `one2many` /
     `many2many` (look up in `models.json`). The relation's
     `(target_model, "form")` and `(target_model, "list")` are added.
     Embedded inline `<field mode="...">` views with explicit `view_id`
     attributes follow that exact view; otherwise resolve the model's
     default views.
   - `<button name="ACTION_OR_METHOD" type="object" />` —
     `name` is a Python method on the model. Skip; semantics are
     server-side. Note in `mapping/odoo-source.md` that the button
     exists.
   - `<button name="N" type="action" />` — `N` is an `ir.actions.*` id.
     Read it; if `ir.actions.act_window`, add `(res_model, view_mode[0])`
     to the queue. Other action types (`ir.actions.client`,
     `ir.actions.report`) are noted in `mapping/odoo-source.md` but not
     followed.
   - `<header>` smart-button references — same as buttons above; many
     are `type="action"` opening "Bills of Materials", "Replenish",
     stock movements, etc.
   - `<groupby>` / `<searchpanel>` / `<filter>` `domain` strings —
     do NOT follow; static filter expressions, not navigation.
3. **Skip rules**:
   - Pair already in `visited`.
   - `depth[parent] + 1 > MAX_DEPTH`.
   - Target model is in a deny-list of pure infrastructure entities
     (`ir.*`, `mail.*` except `mail.activity` heads, `bus.*`, `base.*`,
     `web.*`). Note them in `summary.md` under "skipped models" so the
     user sees what was elided.
4. **For every newly enqueued pair**: re-run the §5.3 step 4–5 sequence
   to dump its `view.get_view`, parse the arch, append to
   `views.json` / `views.parsed.json`. Do **not** re-fetch
   `models.json` for already-introspected models; do fetch for newly
   discovered ones.
5. **Record the graph** in `discovery/navigation-graph.json`:
   `{from: [model, view_type], via: "field|button|action|smart_button",
   ref: "field-name-or-action-id", to: [model, view_type],
   depth: N}`. The main agent uses this to decide which links are
   worth surfacing in the React clone (e.g. a "Replenish" button on
   the product form needs an `/erp-v2/replenish` flow if we want
   parity).

For the `product` slug specifically, expect this walk to enqueue at
least: `uom.uom`, `product.category`, `product.attribute`,
`product.attribute.value`, `product.template.attribute.line`,
`product.supplierinfo`, `account.tax`, `account.account` — most of
which the original 1-hop dump already covered, plus the attribute
chain that the previous run did not reach because attribute lines are
behind a One2many embed.

### 5.4 Visual reference (Playwright)

Use Playwright MCP. Log in once, persist storage state. Capture **only
this small set**, not one per action:

- One screenshot per `view_type` × representative model. Pick the model
  with the most fields per view_type.
  - `kanban__<model>.png`
  - `list__<model>.png`
  - `form__<model>.png` (must include notebook + chatter if present)
  - `search__<model>.png` — for reference only; we use our own design
- App chrome: sidebar (open + closed), breadcrumb, user menu, global
  search.
- `tokens.json` — `getComputedStyle` on `body` and `.o_main_navbar`:
  font-family, font scale (12/13/14/16/20/24), Odoo accent color
  (often `#714B67`), spacing scale, border-radius, shadow.

That is the entire screenshot set. Do not loop actions.

### 5.5 Map to Odoo Python source (`mapping/odoo-source.md`)

For each model in `models.json`:

- `mcp__jcodemunch-ai-vm__search_symbols` against `odoo-src` for the
  class (e.g. `class StockPickingType`).
- `get_context_bundle` to pull the class source + imports.
- Capture in markdown:
  - File path + class name in odoo-src.
  - `_inherit` chain.
  - Key computed fields and their compute methods (just names + 1-line
    summary; not full source).
  - Notable button handlers / action methods (names + arity).
  - Anything Pythonic that affects UX (e.g. `state` field with
    statusbar, domain on a Many2one, `tracking=True` for chatter).
- One model per H2 section. Keep each section short — the goal is to
  inform the iDempiere mapping, not to reproduce Odoo source.

### 5.6 Map to iDempiere (`mapping/idempiere.md`)

For each Odoo model, identify the iDempiere counterpart and write:

- Odoo model → iDempiere class (e.g. `stock.picking.type` → `MDocType`
  filtered by `DocBaseType IN (MMI, MMM, MMR, MMS)`).
- Field rename map (camelCase domain → iDempiere column). This is the
  raw material for `IdempiereDtoMapper` later.
- Write path for each user-facing action:
  - PO/GridTab to use, `processIt(...)` doc action, posting via
    `Doc.postImmediate(MAcctSchema[], adTableId, recordId, force=true,
    null)`. **Never SQL.**
- Gaps — things Odoo does that iDempiere doesn't, or does very
  differently. Be specific (don't say "different costing"; say
  "Odoo uses anglo-saxon perpetual; iDempiere uses adempiere
  costing — `M_CostElement`, `M_CostDetail`").

Use jcodemunch against `idempiere-src` to find the right model class
before writing this section. Don't guess.

### 5.7 Write `summary.md` last

This is the file the main agent reads first. Keep it short:

```markdown
# Discovery Summary — <slug>

**Date:** YYYY-MM-DD
**Odoo:** server_version=<x>
**Scope:** <one line>

## Counts
- menus: N
- actions: N
- models: N
- views: N (kanban=A, list=B, form=C, search=D, …)

## Models in scope
| Odoo model | iDempiere counterpart | Risk |
|------------|------------------------|------|
| product.template | M_Product | low — direct mapping |
| stock.picking.type | M_DocType filtered | medium — semantic split |
| … | … | … |

## Models flagged
(referenced by actions but missing from ir.model — usually ACL or
optional module)

## Top 3 risks for the main agent
1. …
2. …
3. …

## Where to start coding
- Smallest viable slice: <model>
- Recommended order: <model A>, <model B>, …
```

---

## 6. Content rules (apply to every file in the database)

1. **No vendor names in text that could surface in the UI.** Mapping
   markdown can use vendor terms (`stock.picking.type`, `M_DocType`)
   because these files are internal references.
2. **No SQL.** If a write path needs SQL to make sense, the mapping is
   wrong; re-investigate.
3. **No editing files outside `data/clone-discovery/<slug>/`** during
   discovery.
4. **Preserve raw shapes** in JSON dumps. Do not "improve" Odoo's
   field naming on the way in — translate at use time, not at dump
   time.
5. **Idempotent.** Re-running the helper for the same slug must
   overwrite, not append. Any file that should be deleted (because
   scope shrunk) gets deleted. The directory is the truth.

---

## 7. Main agent — how to use the database

After the helper returns:

1. Read `data/clone-discovery/<slug>/summary.md` first. Decide if
   discovery looks adequate. If not, send the helper back with a
   targeted ask (don't re-run the whole protocol).
2. Read `mapping/idempiere.md` to plan DTOs and adapter methods.
3. Read `discovery/views.parsed.json` for the JSX shape (what
   notebook tabs, what fields per page, what statusbar values).
4. Open the relevant `screenshots/*.png` for visual reference.
5. **Then** start coding under `/erp-v2` and
   `com.telcobright.api.erpv2.*` per the design doc §3 and §4.5.

The discovery database is design input. Don't paraphrase it into
component comments. The mapping notes go away when the screen is
written; the database stays for the next agent.

---

## 8. When to skip the helper

The two-agent flow is appropriate for cloning *new surface area*.
Skip it when:

- The user is fixing a bug in already-cloned code.
- The user is renaming or styling existing screens.
- The change doesn't need new arch / new mapping. (Just code it.)

Use it when:

- Adding a new menu item, a new model, or a new view_type that hasn't
  been mapped.
- The user describes the work in Odoo terms ("clone the picking
  workflow", "clone the products menu").

---

## 9. Storage: committed or gitignored?

**Committed** — the database is design input. Committing it makes
discovery reproducible across sessions, agents, and machines. Re-runs
of the helper produce a diff the user can review. Treat
`data/clone-discovery/` like `ai-docs/` — durable design artifacts.

Exception: `screenshots/` may grow large. If a screenshot directory
exceeds ~10 MB, commit only the kanban/list/form representatives and
add the rest to `.gitignore` for that slug. Note this in `00-scope.md`.

---

## 10. Future helper: a slash command

Optional once the protocol stabilizes — a project-level command at
`orchestrix-erp/.claude/commands/clone-odoo.md` could wrap the helper
launch into a single user invocation:

```
/clone-odoo <url> "<scope>" <slug>
```

Not built yet. Build it when (a) we have run the helper twice with this
protocol unchanged, and (b) the prompt template in §4 has stabilized.

---

*End of protocol. Update freely; the helper agent reads the latest
version each run, so changes apply on the next clone request.*
