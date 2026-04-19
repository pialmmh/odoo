# UI Theming — summary and rules

Single source of truth for colors, typography, spacing, radii and shadows in
the orchestrix-v2 UI. **All visual styling must go through the tokens defined
here.** Hardcoded hex colors, inline `fontSize: 13`, literal `px` spacing etc.
are not acceptable in new code.

## Architecture

```
ui/src/styles/
├── tokens.css              ← base tokens (fonts, spacing, radii, shadows, motion)
├── tokens.js               ← JS mirror of CSS vars (for MUI theme + sx props)
├── theme-light.css         ← light palette (activated by body.theme-light)
├── theme-dark.css          ← dark palette  (activated by body.theme-dark)
├── muiTheme.js             ← builds the MUI theme from tokens
├── themes-tenant/
│   ├── tenant-btcl.css     ← per-tenant primary + sidebar overrides
│   └── tenant-telcobright.css
└── components/
    └── sidebar-section.css ← reusable component classes
```

Two axes compose:

1. **Mode** — `body.theme-light` or `body.theme-dark` sets the full palette.
2. **Tenant** — `body.theme-tenant-<slug>` overrides a small subset (primary
   + sidebar). Semantic tokens (success/warning/danger) stay universal.

Both axes are applied as body classes, so a component never needs to know
which theme or tenant is active — it just consumes the CSS vars.

## Token catalog

### Base (mode-independent) — `tokens.css`

| Category    | Tokens |
|-------------|--------|
| Typography  | `--font-sans`, `--font-size-{xs,sm,base,md,lg,xl}`, `--font-weight-{regular,medium,semibold,bold,extrabold}`, `--line-height-{tight,normal}` |
| Spacing     | `--space-{1,2,3,4,5,6,8}` (4px base) |
| Radii       | `--radius-{sm,md,lg,xl,2xl,full}` |
| Shadows     | `--shadow-{sm,md,dropdown}` |
| Motion      | `--transition-{fast,base}` |

### Palette (per mode) — `theme-light.css` / `theme-dark.css`

| Group        | Tokens |
|--------------|--------|
| Surfaces     | `--color-bg-{app,surface,subtle,muted}` |
| Text         | `--color-text-{primary,secondary,muted,disabled,inverse}` |
| Borders      | `--color-border`, `--color-border-{strong,subtle}` |
| Primary      | `--color-primary`, `--color-primary-{hover,bg,text}` |
| Sidebar      | `--color-sidebar-{bg,text,text-hover,active-bg,active-text}` |
| Semantic     | `--color-{success,warning,danger,info}` plus `-{bg,text,border,surface}` variants |
| Accents      | `--color-accent-{blue,violet,pink,amber,emerald}` |
| Neutral      | `--color-neutral-{bg,text}` |

### Tenant overrides

Each tenant CSS may override only:

- `--color-primary`, `--color-primary-{hover,bg,text}`
- `--color-sidebar-bg`, `--color-sidebar-{active-bg,active-text}`

**Never** override semantic tokens per tenant — success stays green across
all tenants.

## How to consume tokens

### Plain CSS

```css
.my-panel {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}
```

### MUI `sx` / `style` — two valid paths

**Path A (preferred for palette)** — reference the MUI theme:

```jsx
<Box sx={{
  bgcolor: 'background.paper',       // → var(--color-bg-surface)
  color:   'text.primary',           // → var(--color-text-primary)
  borderColor: 'primary.main',       // → var(--color-primary)
}} />
```

**Path B (for base tokens not in MUI palette)** — use the CSS var directly:

```jsx
<Typography sx={{
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-semibold)',
  px: 'var(--space-3)',
}} />
```

Both produce values that respect mode + tenant overrides automatically.

## STRICT RULES — new code and edits

1. **No hardcoded hex colors.** Not in CSS, not in `sx`, not in `style`.
   If the color doesn't exist as a token, add one to `tokens.js` +
   `theme-light.css` + `theme-dark.css` (all three) before using it.

2. **No hardcoded font sizes.** Use `var(--font-size-*)` or MUI
   `variant="body2"` etc. `fontSize: 13` is never correct in new code.

3. **No hardcoded spacing / radius / shadow values.** Use tokens.
   `padding: '16px'` → `padding: 'var(--space-4)'`.
   `borderRadius: 8` → use MUI `shape.borderRadius` or `var(--radius-lg)`.

4. **Primary/brand color is not yours to pick.** It comes from the tenant.
   Consume `primary.main` / `var(--color-primary)`; never `#94bc66`.

5. **Semantic colors are universal.** Use `success` / `warning` / `danger`
   consistently — a "paid" badge uses `--color-success-*`, a "failed" badge
   uses `--color-danger-*`. Don't invent a new green for "ready".

6. **Keep dark mode working.** Every token you add needs a value in
   *both* `theme-light.css` and `theme-dark.css`. If you introduce a new
   color variable, verify the page still reads under `body.theme-dark`.

7. **Tenant overrides are for primary + sidebar only.** Never add
   semantic or accent overrides per tenant.

8. **If you think you need a new token, first check it isn't already
   there under a different name.** The palette is small on purpose — reuse
   before you add.

9. **Never edit `ui/src/theme/theme.js` or `ui/src/theme/themes.js`.**
   Those are legacy. New theming changes go through `styles/tokens*`,
   `theme-light.css`, `theme-dark.css`, `muiTheme.js`, and `themes-tenant/`.

10. **Components must degrade gracefully across tenants.** Before merging,
    switch tenants in the UI and confirm the component still reads — if
    it looked good only on BTCL's green primary, it's not ready.

## Review checklist

When reviewing a PR that touches UI, reject if you see any of:

- [ ] `#[0-9a-f]{3,6}` literals outside of `styles/` or `themes-tenant/`
- [ ] `fontSize: <number>` in JSX
- [ ] Hardcoded `px`/`rem` padding/margin in `sx` that isn't a token multiple
- [ ] A "theme" change that edits `theme/theme.js` or `theme/themes.js`
- [ ] A new color with no matching entry in both light and dark palettes
- [ ] A new semantic color scoped to one tenant

Grep to self-audit before requesting review:

```bash
grep -rnE '#[0-9a-fA-F]{3,6}' ui/src/pages ui/src/components ui/src/layouts
grep -rnE 'fontSize:\s*[0-9]' ui/src/pages ui/src/components ui/src/layouts
```

Both should return zero hits in pages/components/layouts. Hits belong to
`ui/src/styles/` only.

## Where the current palette came from

- **Base**: Tailwind gray scale for text/borders/backgrounds.
- **Success / BTCL primary**: sage `#94bc66` family — desaturated so it
  doesn't overwhelm the UI.
- **Telcobright primary**: material blue `#1565C0`.
- **Danger / Warning / Info**: Tailwind red-600 / amber-600 / blue-600.
- **Accents**: used sparingly for decorative icons (see Sidebar); never for
  semantic meaning.

If you need a new shade, derive it from the existing family (hover =
darker, bg = lighter same-hue) rather than introducing a new hue.
