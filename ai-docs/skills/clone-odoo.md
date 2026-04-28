# clone-odoo — agent playbook

**This file is a playbook, not a `.claude/commands` slash command.** It
lives under `ai-docs/skills/` so it is git-tracked and travels with the
repo. If you want to also expose it as a slash command on a particular
machine, symlink it:

```bash
ln -s ../../ai-docs/skills/clone-odoo.md \
      .claude/commands/clone-odoo.md
```

The user invokes this playbook by asking the agent something like:
*"clone the inventory operations menu — use the clone-odoo playbook"*
or simply *"clone Odoo `<URL>` per ai-docs/skills/clone-odoo.md"*.

---

## What this playbook does

Drives the two-agent clone workflow defined in
`ai-docs/clone-discovery-protocol.md`:

1. Validate the user's input.
2. Verify the local environment (Odoo, VPN, MCP).
3. Launch a **helper agent** (`Agent(subagent_type=general-purpose)`)
   that runs the discovery protocol and writes a database to
   `data/clone-discovery/<slug>/`.
4. Read the helper's database.
5. Plan the smallest viable coding slice and ask the user to confirm
   before writing any app code.

The agent driving this playbook is the **main agent**. It does not
do discovery itself — that is the helper's job.

---

## 1. Inputs

The user request must contain:

- **Odoo URL** — starts with `http://` or `https://`. Typically a deep
  link like `http://localhost:7169/web#action=...&model=...&view_type=...&menu_id=...`
  or just the bare login page `http://localhost:7169/web`.
- **Scope statement** — one of:
  - `"clone this single page"`
  - `"clone this menu and all its children"`
  - `"clone these specific menu items: <list>"`
  - `"clone the whole <module> module"`
- **Slug** *(optional)* — short kebab-case directory name. If missing,
  derive one from the scope (e.g. `"clone the inventory operations
  submenu"` → `inventory-operations`).

**If any required input is missing or ambiguous: ask the user. Do not
guess the URL or invent a scope.**

---

## 2. Verify the environment

Before launching the helper. Stop and report to the user if any check
fails — do not try to fix.

```bash
# Odoo reachable
curl -sS -o /dev/null -w 'odoo: HTTP %{http_code}\n' \
  --max-time 5 http://localhost:7169/web/login

# VPN to indexed-codebase MCP
ping -c1 -W2 10.10.186.1

# Odoo admin auth still works
curl -sS --max-time 5 -X POST http://localhost:7169/web/session/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"db":"odoo_billing","login":"admin","password":"admin"}}' \
  | head -c 200
```

Then confirm via `claude mcp list` that:

- `jcodemunch-ai-vm` is **✓ Connected**
- `playwright` is **✓ Connected**

If anything is red: tell the user precisely what failed and stop. The
helper will not function without these.

---

## 3. Read the protocol

Before launching the helper, refresh your understanding of the source
of truth. Read in full:

```
ai-docs/clone-discovery-protocol.md
```

Anything in this playbook that disagrees with the protocol — **the
protocol wins** and you should update this playbook to match.

Skim, do not rewrite, the design doc:

```
ai-docs/erp-react-clone-design.md
```

You only need §3 (target package layout) and §4 (cloning workflow
phases) to plan the coding step at the end of this playbook.

---

## 4. Launch the helper agent

Use **`Agent(subagent_type=general-purpose)`** so the helper has access
to all tools (Playwright MCP, jcodemunch MCP, bash, write).

Use this prompt verbatim, replacing the three placeholders. **Do not
shorten** — the helper has no other context.

```
You are the discovery helper for a clone-Odoo-into-our-ERP-app effort.

INPUT
- Odoo URL: <FILL: URL from user>
- Scope: <FILL: scope statement from user>
- Slug: <FILL: slug>

YOUR DELIVERABLE
A populated discovery database at:
  /home/mustafa/telcobright-projects/orchestrix-erp/data/clone-discovery/<FILL: slug>/
following the file layout in:
  /home/mustafa/telcobright-projects/orchestrix-erp/ai-docs/clone-discovery-protocol.md
Read that file's §3 (paths), §5 (steps), §6 (content rules) before
starting.

CONTEXT YOU NEED BEFORE STARTING
1. /home/mustafa/telcobright-projects/orchestrix-erp/ai-docs/erp-react-clone-design.md
   — the architectural target. Read §3 (package layout) and §4
   (cloning workflow) so your mapping notes target the right shape.
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
- Edit anything outside data/clone-discovery/<FILL: slug>/.
- Push to git. Do not commit. Leave staging clean.
- Loop screenshots per action — only the small set in protocol §5.4.

RETURN BRIEF
When done, return only:
  - The database path
  - 5-line summary: counts of menus, actions, models, views; any
    models referenced by actions but missing from ir.model
  - Top 3 mapping risks for the main agent to consider
Do not paste file contents back. The main agent will read from disk.
```

Run **foreground** (default — not `run_in_background`). You need the
helper's return value before you can proceed, and discovery should
complete in a single bounded run.

---

## 5. Triage the helper's output

When the helper returns:

1. Read `data/clone-discovery/<slug>/summary.md` first. Verify:
   - Counts are non-zero and match the scope.
   - The "Models flagged" section is empty, or every entry is
     understood (often ACL or optional-module artifacts).
   - The Top 3 risks are concrete (not generic platitudes).
2. If summary is missing or malformed: send the helper back with a
   targeted ask (don't re-run the whole protocol). Use the same slug
   so it overwrites in place.
3. Read `mapping/idempiere.md`. This is what informs DTOs and adapter
   methods.
4. Skim `discovery/views.parsed.json` for the JSX shape: notebook
   tabs, fields per page, statusbar values, kanban grouping.
5. Open `screenshots/` to see what the user will see in Odoo.

---

## 6. Plan the smallest viable coding slice

Pick exactly **one** model from the scope to clone first. Prefer:

- Simple field set, low computed-field count.
- Few related-record dependencies (Many2one fans out fast).
- Already mostly available on iDempiere with a clean field rename.

For the chosen model, draft (in your message to the user, not in code
yet):

- The DTO field set: union of what Odoo's form view shows + what
  iDempiere has, all nullable. Map to design doc §3.4.
- The adapter methods needed (typically `list…`, `get…`, `save…`).
- The new `/api/erp-v2/<resource>/...` controller endpoints.
- The new `ui/src/pages/erp-v2/<resource>...jsx` files.
- A sentence on the tabs/notebook layout you'll mirror from Odoo,
  using Fluent v9 components (per `.claude/skills/fluent-ui-forms`).

---

## 7. Ask before coding

End your turn with a clear question:

> Discovery is in `data/clone-discovery/<slug>/`. I propose starting
> with `<model>` because `<reason>`. The first slice will add
> `<DTO + adapter method + controller + page>`. Ready to start, or
> want to adjust scope?

**Do not start coding** until the user confirms. The user explicitly
wants alignment before the engine cycles begin.

---

## 8. Hard rules to keep in mind throughout

These are repeated from the bootstrap (§4) — they bind the main agent
*and* anything the helper writes:

1. No raw SQL against iDempiere — adapter calls model classes only.
2. No vendor names ("Odoo", "iDempiere", "ErpNext", "Kill Bill",
   "Keycloak", "APISIX") in user-facing UI strings. Code/comments are
   fine.
3. New work goes under `/erp-v2` (UI route) and
   `com.telcobright.api.erpv2.*` (backend package). Do not refactor
   existing `/erp` or `/api/erp/**`.
4. Fluent UI v9 only. Theme tokens. Griffel longhand. 12-col grid with
   span-comment-first JSX.
5. Invoke `.claude/skills/fluent-ui-forms` before writing any
   form/dialog/filter bar.
6. Never commit or push without explicit user OK.

---

## 9. Idempotency / re-runs

If the user wants to refresh discovery for a slug:

- Use the same slug. Helper overwrites the existing directory.
- If scope shrinks, manually delete the now-stale files; protocol §6
  rule 5 requires a clean directory.
- If scope grows, prefer a **new slug** per cohesive submodule rather
  than one giant slug — keeps the database shapes manageable.

---

*End of playbook. The protocol doc is the contract; this file is the
ergonomics around it. Update freely when something is annoying in
practice — but mirror the change in the protocol if it changes the
contract.*
