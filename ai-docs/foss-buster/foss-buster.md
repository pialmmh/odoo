# foss-buster — repeatable factory for cloning a FOSS app from source + tutorial

> A methodology-only skill. Target-agnostic. To run it against a real codebase
> you also need a target-pack (e.g. `odoo/foss-buster-odoo.md`) that pins paths,
> versions, MCP endpoints, and target-specific authority rules.
>
> One target-pack per FOSS source: `odoo`, `wordpress`, `espocrm`, etc.
> The base skill defines *what* and *how*; the target-pack supplies *where*.

---

## What this skill does

For a slug (one screen / module / form) of the target FOSS app, joins three
sources — **video tutorial**, **target source code**, **destination DB code** —
into a single auditable spec from which the React UI and BFF can be coded
deterministically. Outputs a multi-sheet workbook plus JSONL siblings that
human and machine can both read.

**Repeatable factory, not one-shot.** Each phase has a hard exit gate. If a
gate fails after the iteration cap, stop and surface to the user.

---

## How a target-pack extends this skill

A target-pack is a sibling markdown file at:

```
ai-docs/foss-buster/<target>/foss-buster-<target>.md
```

It MUST start with:

```markdown
# foss-buster-<target> — extends [`../foss-buster.md`](../foss-buster.md)
```

and supply the **target binding table** (mandatory), the **target authority
addendum** (optional), and the **target cross-cutting mapping** (optional).
See `odoo/foss-buster-odoo.md` for the canonical example.

When the user invokes the skill, both files are read; conflicts resolve in
favour of the target-pack.

---

## Generic authority order (when sources disagree)

Target-packs SHOULD inherit this and MAY tighten it.

1. **Source code** of the target FOSS app — what actually runs.
2. **Running instance** of the target — what the *configured* runtime does.
3. **Wiki + JSON** extracted from the tutorial.
4. **Screenshots** from the tutorial.
5. **Demo data in screenshots** — illustrative only; never persisted as fixtures.

When 1 and 3 conflict, log the conflict to the workbook's `Conflict-Log` sheet.
Trust code; update wiki.

---

## Phases and gates

Each phase has a single explicit exit gate. Default iteration cap = 3.

### Phase 0 — pin & frame
- Write `<slug>/sources.lock` with every SHA / version / URL the target-pack
  declares as a pinned input.
- Decide slug scope (single tab vs full window).
- **Gate:** lockfile exists and SHAs validated.

### Phase 1 — stories table
- Read every wiki page + every screenshot for the slug.
- Emit one row per visible UI element into the `Stories` sheet.
- **Gate:** every screenshot has ≥1 story; every visible field/button has a
  row; every row has a `confidence` value.

### Phase 2 — prototype UI
- Build the screen with mock data only — no API, no validation.
- Run Playwright snapshot diff against each `frame_*.jpg` for the slug.
- **Gate:** tab names 100 % match, section headings 100 % match,
  field-label overlap ≥ 90 %, control-type per field matches.

### Phase 3 — interaction discovery (double-pass via target source MCP)
For each interactive UI element from Phase 1:

1. **"What runs"** — `search_text` → `get_call_hierarchy` → `get_symbol_source`
   on the target source. Outputs go to `Interactions.handler_method`.
2. **"What changes"** — `search_columns` + `find_references` to surface every
   table/column the method writes. Outputs go to `Interactions.tables_written`.

Capture two interaction families the video can't show:
- **Onchange / compute graph** — fields whose value changes when other fields
  change, without an explicit user click.
- **Record rules / RBAC predicates** — visibility/editability filters.

**Gate:** every Phase-1 row that's interactive has a non-empty `Interactions`
row keyed to it.

### Phase 4 — reconcile (build the conflict log)
- For every place wiki says X and code says Y, write a `Conflict-Log` row with
  `wiki_says`, `code_says`, `resolution`, `resolved_by`.
- Resolutions become test fixtures in Phase 7.
- **Gate:** zero unresolved conflicts; every "resolved" row has a regression
  test queued.

### Phase 5 — destination mapping
For each target table/field touched in Phase 3, classify against the
**destination DB** (defined by the target-pack):

- `equivalent` — direct mapping exists.
- `partial` — overlaps but missing fields/methods.
- `none` — implement-or-defer.

Write the proposed BFF endpoint per interaction into `BFF-Plan`. Prefer the
destination's idiomatic write path (e.g. its ORM/grid layer) over direct JDBC.

**Gate:** every `Interactions` row has a `DB-Mapping` row + a `BFF-Plan` row,
or an explicit `WONTFIX` flag.

### Phase 6 — code in lock-step
- Frontend and backend never drift by more than one story.
- Generate Playwright test stubs from `Stories.acceptance_criteria` at codegen
  time, not at test time. The story is the test.
- **Gate:** every closed story has a passing test.

### Phase 7 — replay
- Playwright run: visual diff against screenshots + behavioural assertions
  from acceptance criteria.
- Replay the conflict log as regression — no resolved row may silently revert.
- **Gate:** all visual diffs within tolerance, all behavioural tests green.

---

## File layout per slug

```
ai-docs/foss-buster/<target>/<slug>/
  sources.lock                    Phase 0
  workbook.xlsx                   audit-friendly view of every sheet
  stories.jsonl                   Phase 1 (machine source of truth)
  interactions.jsonl              Phase 3
  conflict-log.jsonl              Phase 4
  db-mapping.jsonl                Phase 5
  bff-plan.md                     Phase 5 (human review)
  playwright/                     Phase 7 tests
```

The `.xlsx` is the human-review surface; the `.jsonl` files are the machine
source of truth. They MUST round-trip — re-running the workbook export from
JSONL must not change any row.

---

## Information schema (sheet glossary)

| Sheet | Phase | Captures |
|---|---|---|
| README | – | this skill's contract + sheet glossary |
| Sources | P0 | lockfile contents (SHAs / versions / URLs) |
| Phases | all | gate definitions, exit criteria, current status |
| Stories | P1 | one row per visible UI element |
| Interactions | P3 | UI element → handler method → tables touched |
| DB-Mapping | P5 | target table.field ↔ destination table.field |
| Conflict-Log | P4 | wiki↔code disagreements + resolution |
| BFF-Plan | P5 | endpoints to add or reuse |
| Cross-Cutting | overlay | i18n / multi-tenancy / RBAC / workflows / auditing / attachments |
| Glossary | – | term definitions used across columns |

The exact column lists are versioned with the workbook generator. See the
target-pack's `build_workbook.py`.

---

## Cross-cutting overlays

Run after the per-slug factory finishes. Each is a separate sweep, captured in
the `Cross-Cutting` sheet.

- **i18n** — per-field translation; how the destination handles locales.
- **Multi-tenancy** — tenant scoping on every BFF endpoint.
- **RBAC** — predicate translation between target and destination.
- **Workflows** — scheduled actions, automated rules, mail templates.
- **Auditing** — change log / activity stream.
- **Attachments** — file uploads, document store.

Target-packs SHOULD provide a starting mapping table for each.

---

## Invocation

**The base skill is not directly invocable.** It is a library that
target-packs include. To run the factory, invoke the target-pack:

```
/foss-buster-<target> "<prompt>"
```

For example:

```
/foss-buster-odoo "product"
/foss-buster-odoo "do the product general tab through Phase 2"
/foss-buster-odoo "/path/to/video-extractor/odoo/product/"
/foss-buster-odoo "resume product slug, run P3 only"
```

The target-pack is responsible for:

1. Parsing the freeform prompt into a complete instruction (slug, kb_folder,
   phases, resume flag, etc.). Use the **prompt resolution rules** below.
2. Reading this base skill for the methodology.
3. Driving the **run lifecycle** below.

If the prompt is ambiguous or required inputs can't be resolved, the
target-pack stops and asks the user. It never invents inputs.

---

## Prompt resolution rules (target-packs implement these)

Given a freeform prompt string, resolve in this order:

1. **Path that exists** → if the prompt is (or contains) an existing folder
   path, treat it as `kb_folder`. Auto-derive `slug` from its last path
   segment, `target` from the path segment before that. Folder must contain
   `knowledge_graph.json` and `screenshots/`.
2. **Single bareword** → treat as `slug`. The target-pack's binding table
   provides the `kb_folder` template (e.g. `video-extractor/odoo/<slug>/`).
3. **Natural-language phrase** → extract slug + phase scope by simple
   keyword matching: `"P0..P7"`, `"phase 0..7"`, `"resume"`, `"gate"`,
   `"only general tab"`, etc.
4. **Failure** → surface a structured ask: what's missing, what was found.

The resolved instruction is written to `<output_root>/instruction.lock` on
first run so subsequent calls can replay deterministically.

---

## Run lifecycle (what the agent does on each call)

1. **Resolve prompt** to a complete instruction object (per rules above).
2. **Read both skill files** — this base + the target-pack. Apply
   target-pack overrides.
3. **Check `<output_root>/sources.lock`**:
   - missing → first run; bootstrap (write `sources.lock`, write
     `instruction.lock`, run the target-pack's workbook generator to seed
     empty sheets).
   - present → resume mode; load current phase from the `Phases` sheet,
     continue from the first phase whose gate hasn't passed.
4. **For each phase in scope:**
   1. Read inputs the phase needs (wiki, screenshots, source code via MCP).
   2. Execute the phase's deliverables (write `.jsonl`, regenerate
      workbook).
   3. Evaluate the gate. Green → mark in `Phases` sheet, advance.
      Red → check iteration cap.
   4. Iteration cap exceeded → surface to user with a structured report
      (what passed, what failed, what's needed). Do not silently lower the
      gate.
5. **Final report** — print: phases run, phases pending, files written,
   gates green/red, time taken.

---

## Naming policy

`foss-buster` is the chosen name for this methodology. If a downstream tool
flags it as a security term, fall back to "source-faithful clone." The
methodology is the same.
