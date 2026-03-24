# Feature Development Workflow

## Structure

```
features/
├── FEATURE-WORKFLOW.md          ← this file
├── {feature-name}/
│   ├── open/                    ← active todos, specs, notes
│   │   ├── task-name.md
│   │   └── ...
│   └── closed/                  ← completed work (moved from open/)
│       ├── task-name.md
│       └── ...
```

## Rules

1. **Every feature gets a folder** under `features/` with `open/` and `closed/` subfolders.
2. **New work items** go as `.md` files in `open/`. Each file describes: what, why, exists/missing, dependencies, key files.
3. **When a task is done**, move its `.md` from `open/` → `closed/`. Add a completion note at the top (date, summary of what was done).
4. **Keep task list in sync** — the Claude Code task list (#1-#14 etc.) should mirror the feature folder todos. When updating one, update the other.
5. **One feature folder = one concern.** If a feature spans multiple areas, put the todo in the primary feature folder and cross-reference from others.
6. **Feature folders are permanent** — even after all items are closed, keep the folder. The `closed/` folder serves as history.

## Current Feature Folders

| Folder | Description |
|--------|-------------|
| `vat-ait-chalan/` | VAT/AIT accounting entries, NBR chalan dispatch |
| `event-bridge/` | KB webhook → Kafka event bridge |
| `rtc-provisioning/` | Kafka → RTC-Manager PackageAccount creation |
| `overdue-suspension/` | Overdue detection → service suspension automation |
| `purchase-subscription/` | Purchase UI fixes (pause/resume, etc.) |
| `rbac/` | Role-based access control |
| `tenant-config/` | Per-tenant YAML config loader, API endpoint |
| `kb-catalog-tiered/` | Tiered PBX/VBS/CC plans in KB catalog |
| `sslcommerz-payment/` | SSLCommerz → KB payment recording |
| `deployment/` | LXC container deployment scripts |

## Adding a New Feature

```bash
mkdir -p features/{new-feature}/{open,closed}
# Write the todo in features/{new-feature}/open/task-name.md
# Create a matching Claude Code task (TaskCreate)
```

## Completing a Task

```bash
mv features/{feature}/open/task-name.md features/{feature}/closed/
# Add completion note at top of the file
# Update Claude Code task (TaskUpdate status=completed)
```
