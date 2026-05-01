# foss-buster-openproject — extends [`../foss-buster.md`](../foss-buster.md)

> OpenProject target-pack. Pins inputs and supplies OpenProject-specific
> authority rules plus a UX-modernisation overlay for cloning OpenProject
> screens onto a modern React UI that talks to OpenProject's HAL+JSON
> `/api/v3/` API (directly, or via a thin BFF proxy).
>
> **Read order:** `../foss-buster.md` first (methodology + phases + gates),
> then this file (paths + OpenProject specifics + UX overlay). Conflicts
> resolve in favour of this file.

---

## How this pack differs from the Odoo pack

The Odoo pack treats `target` and `destination` as two different systems
(Odoo source → iDempiere DB) and the heavy lifting is field-shape
translation. **This pack is different**: OpenProject is *both* the source
of UX truth AND the backend. The React clone calls OpenProject's HAL+JSON
API. So:

- `DB-Mapping` becomes `API-Shape-Mapping` — HAL `_links` / `_embedded`
  → flat React-friendly DTO. Same sheet name kept for tool compatibility.
- `BFF-Plan` is mostly thin proxies + DTO reshapers, not net-new endpoints.
- A new overlay sheet `UX-Patterns` and a new gate (Phase 2.5) capture
  the "make the UI modern" requirement: modal-driven edits, search-first
  navigation, contemporary list patterns. The React clone is *functionally
  faithful, visually current* — never a 1:1 pixel copy.

---

## Target binding (mandatory)

| Slot | Value |
|---|---|
| `target` | `openproject` |
| `target.version` | `14.6.3` (jammy package on Ubuntu 24.04) |
| `target.source_path` | `/opt/openproject/` (installed; read-only reference for Ruby/Rails/JS code) |
| `target.runtime_url` | `http://localhost:6543` (Apache reverse-proxy → Puma 127.0.0.1:6000) |
| `target.runtime_db` | PostgreSQL `openproject` on `127.0.0.1:5433` |
| `target.api_root` | `http://localhost:6543/api/v3` (HAL+JSON; basic-auth or API key) |
| `target.admin_login` | `admin` / password set via Rails console (see `<slug>/sources.lock`) |
| `target.api_token_path` | `<slug>/sources.lock` key `openproject.api_token` (do not hard-code in this file) |
| `tutorial.video_path` | `video-extractor/openproject/<slug>/` (capture if missing — see Phase 0 note) |
| `tutorial.wiki_path` | `video-extractor/wiki/openproject-<slug>-*.md` |
| `destination` | `react-modern` (React UI on Vite, talking to OpenProject HAL via thin BFF proxy) |
| `destination.frontend` | `orchestrix-v2/ui/` (Vite, port `5180`) |
| `destination.bff` | `orchestrix-v2/api/` (Spring Boot, port `8180`, gateway via APISIX `:9081`) — **thin proxy only** for this target |
| `destination.write_path` | `POST/PATCH/DELETE` against OpenProject HAL `/api/v3/`. Direct SQL against OpenProject's Postgres is forbidden — `lock_version` lives in the API layer and bypassing it corrupts activity streams. |
| `destination.ui_library` | Hybrid: Fluent UI v9 (sidebar/topbar) + MUI v7 (data tables, dialogs, forms). Match existing `orchestrix-v2/ui` patterns. |

The first call on a slug copies these into `<slug>/sources.lock` and pins
the OpenProject git SHA, the BFF/UI git SHAs, and an admin API token at
lock time.

**Phase 0 note on tutorial inputs:** OpenProject does not require a video
tutorial pre-extract — the running instance plus the HAL API is
self-describing enough that Phase 1 stories can be sourced from
screenshots of the live system if no third-party tutorial is available.
When `tutorial.video_path` is empty, the agent captures screenshots
directly via Playwright against the local instance and writes them to
`<slug>/captured-frames/`. Treat captured frames as authority level 4
(same tier as tutorial screenshots).

---

## Authority addendum (OpenProject-specific)

Inherits the generic order from the base skill. Adds:

- **HAL form payloads beat field tables.** When a story disagrees with the
  static field list, fetch `/api/v3/work_packages/form` (or the equivalent
  `<resource>/form` endpoint) and trust its `_embedded.schema` and
  `_embedded.payload`. Forms reflect the *current user's* permissions and
  the active type/status workflow — they are the only source of truth for
  "what is editable right now".
- **Type-specific forms outrank generic ones.** Each work-package *type*
  (Task, Bug, Milestone, …) can pin different required fields, custom
  fields, and form-configuration blocks. A story for "the work-packages
  form" must reference a type. If the slug doesn't pin one, default to
  the demo project's first type and record the choice in
  `instruction.lock`.
- **Status workflows gate writes.** `availableStatuses` on a work package
  is computed from `Type × Role × CurrentStatus`. Stories about the status
  selector must reference the workflow, not the global status list.
- **`lockVersion` is mandatory on every PATCH.** A PATCH without a current
  `lockVersion` returns 409. The React clone must round-trip lockVersion
  on every form submit; the BFF proxy must propagate the 409 untouched
  rather than retrying or merging.
- **Principals ≠ Users.** Assignees, watchers, and responsibles are
  `principals` (User OR Group OR PlaceholderUser). Stories that say
  "assignee dropdown" must reference principals, not users.
- **Custom fields are `customField{N}`.** They appear in HAL payloads with
  numeric suffixes. A story for a custom-field column must declare the
  field's id and surface it as `customField{N}` in `Interactions`.
- **Embedded vs linked.** A HAL response embeds an entity when
  `?include=` is set or the schema declares it; otherwise only `_links`
  are present. The Stories sheet must record which fields are embedded
  by default for each list/detail context — under-fetching causes
  visible-but-empty UI columns.

---

## UX-modernisation overlay (this pack only)

This is the **net-new** mechanism vs the Odoo pack. The React clone is
functionally faithful to OpenProject (every story from Phase 1 is
reachable) but visually contemporary. Phase 2.5 (Modernisation Pass)
sits between Phase 2 (Prototype UI) and Phase 3 (Interaction Discovery).

### Phase 2.5 — Modernisation Pass

For every Phase-1 story, the prototype must conform to the rules below
or have an explicit `legacy-keep` row in `UX-Patterns` justifying the
deviation. Output: `<slug>/ux-patterns.jsonl` + `UX-Patterns` sheet.

**Catalogue rules** (target-pack stays authoritative; rows are written
into the workbook on each run):

| # | Source pattern | Modern pattern | Rationale |
|---|---|---|---|
| 1 | Edit redirects to `/work_packages/{id}/details` (full-page) | Slide-over panel from the right edge; row-click on list opens it; URL deep-links via query param `?wp={id}` | Linear / Notion convention; avoids context loss on lists |
| 2 | Create button opens `/work_packages/new` full page | Modal dialog (MUI `<Dialog>`) with type pre-selected from current view | Faster create-flow; modal can be dismissed without losing list state |
| 3 | Project switcher = sidebar dropdown | Cmd+K spotlight palette with recent + pinned projects + free-text fuzzy match | Discoverable, keyboard-driven |
| 4 | Filters = horizontal toolbar above list | Chip-style filter pills under the search box; click a chip to edit; "+ Filter" opens picker; saved filters live in a sub-menu | Compact, persistent, scannable |
| 5 | List = paginated table with page numbers | Virtualised list (TanStack Virtual or MUI DataGrid Premium virtualisation) with infinite scroll OR cursor pagination; sticky header; column resize | Handles thousands of work packages without thrashing |
| 6 | Sort = clicking column header opens dropdown menu | Click header to cycle asc/desc/none; modifier-click to multi-sort; sort indicators in header | Direct manipulation |
| 7 | "Save query" workflow uses a modal with name + visibility | Inline rename in the saved-queries menu; visibility toggle next to the name; star to pin | Less ceremony |
| 8 | Status changes via inline single-select | Inline single-select kept, but the available list is rendered as kanban-pill chips coloured per status; `availableStatuses` from the form schema | Visual state at a glance |
| 9 | Comment box at bottom of details page | Sticky comment composer at the bottom of the slide-over with markdown preview tab; @-mention autocomplete via `/api/v3/principals` | Always visible while reading the thread |
| 10 | Activity tab = chronological list | Filter chips at the top of the activity panel: All / Comments / Changes / Mentions; default to Comments | Reduces noise |
| 11 | Attachments = list with download links | Drop-zone over the whole slide-over while dragging; thumbnail grid for images; lightbox on click | Affordance hierarchy |
| 12 | Hierarchy = nested tree with expand/collapse | Same — but expand-state persists per user in localStorage and survives reload; "expand all to depth N" command | Hierarchy stays useful as data grows |

**Gate (Phase 2.5):** Every Phase-1 story has a `UX-Patterns` row whose
`pattern_status` is one of `applied` (modern pattern in the prototype),
`legacy-keep` (deviation with written justification), or `deferred`
(slice-2 work, with target slice noted). Zero rows may be `unset`.

### Search-first navigation

A separate top-level rule: every list view must expose a search input as
the **first** affordance (above filters, above the create button), bound
to the OpenProject query param the source uses (`q=` for work-package
search). Empty search behaves as "show all"; no separate "advanced
search" page.

### Modal-vs-page rule

Every "edit" and "create" affordance must be a modal or a slide-over.
Full-page edit redirects are forbidden in the modern UI even if the
source uses them. Detail views MAY remain full-page when the user
arrives via a deep link, but the *default* navigation from a list is a
slide-over.

---

## Cross-cutting mapping (OpenProject → React-modern)

Use this as the seed for the `Cross-Cutting` sheet. Target-pack stays
authoritative; the workbook is the per-slug audit copy.

| Concern | OpenProject mechanism | React-modern strategy | Strategy |
|---|---|---|---|
| i18n | `Setting.default_language`; per-user `language`; gettext-style `.yml` files | Use OpenProject's `Accept-Language` propagation; React side reads `i18n` keys from `/api/v3/configuration` for static labels and falls back to in-app dictionary for our own affordances (filter chips, command palette) | Slice 1: pass through; slice 2: own dictionary for net-new affordances |
| Multi-tenancy | None at the OpenProject level — single tenant per instance. Project-level isolation only. | The orchestrix-v2 multi-tenant context (`AD_Client`-derived) maps one OpenProject instance per tenant, OR uses path-prefix routing (`/op/{tenant}/`) on the BFF | Slice 1: one instance per tenant; revisit if scale demands |
| RBAC | `Role` × `Project` membership; `permissions` array per role; per-work-package `lockVersion` | The form schema (`/work_packages/form`) is authoritative for "can I edit field X right now". The UI hides any control whose schema entry has `writable=false` | Use form schema as truth; never hand-maintain a parallel permissions list |
| Workflows | Status workflows: `(type, role, from_status) → [allowed_to_status]`. Editable in admin UI. | The status selector in the modal reads `availableStatuses` from the work-package form schema. Never enumerate the full status list. | Trust the schema |
| Auditing | `Journal` rows per work package, exposed at `/work_packages/{id}/activities` | Activity panel in the slide-over reads journal entries; renders changes diff-style with old → new value chips | Read-only display; no journal writes from React |
| Attachments | `/api/v3/work_packages/{id}/attachments` with multipart upload + direct-upload URLs | Drop-zone uploads to OpenProject endpoint directly (bypasses BFF for binary payload); BFF only signs/proxies the URL grant | Avoid double-buffering large files through the BFF |
| Comments | Journals with `comment.raw` markdown | Sticky composer + thread render with markdown; @-mentions resolve via `/api/v3/principals` autocomplete | Direct HAL POST; no BFF translation |
| Notifications | `/api/v3/notifications`; `read=true|false`; reasons (`mentioned`, `assigned`, `watched`, …) | Top-bar bell + slide-over notification centre; mark-read on hover-pause; group by reason; React-Query subscription with 30 s refetch | Slice 2 |
| Saved queries | `/api/v3/queries` keyed by user; project-scoped or global | "Saved views" menu in the list; rename inline; star to pin to sidebar | Slice 1 |

---

## Invocation

```
/foss-buster-openproject "<prompt>"
```

`<prompt>` is freeform. The agent classifies it and resolves to a complete
instruction per the base skill's prompt resolution rules. Examples that
all work without further input:

| Prompt | Resolves to |
|---|---|
| `"work-packages"` | slug=work-packages, kb_folder=`video-extractor/openproject/work-packages/` if it exists, else captured-frames bootstrap; all phases; resume=true |
| `"/home/.../video-extractor/openproject/work-packages/"` | same as above (kb_folder explicit) |
| `"work-packages P0 P1 P2"` | slug=work-packages, scope=[P0,P1,P2] |
| `"do the work-packages list view through Phase 2.5"` | slug=work-packages, scope=[P0..P2.5], NL hint kept in instruction.lock |
| `"resume work-packages, P3 only"` | slug=work-packages, scope=[P3], resume=true |
| `"gate work-packages"` | slug=work-packages, gate-check only (no writes) |
| `"projects-list"` | slug=projects-list; kb_folder must exist or agent stops and asks |

If the prompt can't be classified, the agent stops with a structured ask
listing what it tried and what's missing. It never invents inputs.

The resolved instruction is written to `<output_root>/instruction.lock`
on first run so subsequent calls replay deterministically.

---

## Slug index (per-slug workbooks live alongside this file)

| Slug | Status | Path |
|---|---|---|
| `work-packages` | seeded — Phase 0 stub, awaiting first run | [`work-packages/`](./work-packages/) |

When you add a slug, create `<slug>/` next to this file and run the
workbook generator (`build_workbook.py <slug>`) to seed it.

---

## Notes specific to this destination (modern React)

These are not theoretical — they have already bitten us with the
Odoo→iDempiere clone; left here so the next agent doesn't relearn them.

- **No 1:1 layout.** The Odoo pack required pixel-faithful rebuilds.
  Here, only field/intent overlap is required (≥ 95%); layout MAY
  diverge per the UX overlay. Reviewers checking visual diffs against
  OpenProject screenshots will reject the work — point them at the
  `UX-Patterns` sheet.
- **Don't shadow OpenProject's URL conventions.** Deep links to a work
  package use `?wp={id}` rather than rewriting the URL — the React route
  is the *list* and the slide-over is a UI-state overlay. Bookmarks of
  the form `localhost:6543/work_packages/123` should redirect to
  `/wp?wp=123` so external links still resolve.
- **HAL pagination is offset-based.** Cursor-style infinite scroll on
  top of an offset API requires the React layer to track the running
  offset and tolerate insertions/deletions between pages (refetch on
  invalidate, not "load next"). Don't pretend the API is cursor-native.
- **`lockVersion` is per-resource, not per-tab.** If the user edits the
  same work package from two browser tabs, both must round-trip the
  current lockVersion. The slide-over's React-Query mutation must
  invalidate on success and on 409 — never optimistic-update the cache
  for the form's own fields.
- **Custom fields surface as integers.** A column for "Story Points"
  shows up in HAL as `customField12`. The React side keeps a
  schema-driven column factory rather than hard-coding `customField12`
  by name; the schema is fetched once per `(project, type)` and cached.
