import { webLightTheme, webDarkTheme } from '@fluentui/react-components';

/**
 * App-wide compact override of the Microsoft (Fluent v9) theme.
 *
 * Shifts the body typography ramp down one notch so default Fluent
 * components (which target Base300 = 14 px) render at Base200 = 12 px,
 * matching iDempiere-style density. Headings cascade down accordingly:
 * Base400 → Base300, Base500 → Base400, Base600 → Base500.
 *
 * The bottom of the ramp (Base100 = 10 px, Base200 = 12 px) is kept as-is
 * so components that already opt into `size="small"` don't shrink further
 * and become unreadable.
 *
 * Microsoft's source theme objects in node_modules are NOT modified — this
 * is a derived object that we hand to FluentProvider.
 */

function shrinkBody(base) {
  return {
    ...base,
    // Flatten the darker bottom-border accent Fluent puts on Input / Dropdown /
    // Combobox / Textarea. Default behaviour underlines those controls with
    // colorNeutralStrokeAccessible (visibly darker than the other three sides),
    // which reads as a stray black margin in our dense iDempiere-style forms.
    // Aligning it to colorNeutralStroke1 gives every side the same hairline.
    colorNeutralStrokeAccessible:       base.colorNeutralStroke1,
    colorNeutralStrokeAccessibleHover:  base.colorNeutralStroke1Hover,
    colorNeutralStrokeAccessiblePressed: base.colorNeutralStroke1Pressed,
    // Body / default
    fontSizeBase300:   base.fontSizeBase200,   // 14 → 12
    lineHeightBase300: base.lineHeightBase200,
    // Subtitles / inputs that want a bit more
    fontSizeBase400:   base.fontSizeBase300,   // 16 → 14
    lineHeightBase400: base.lineHeightBase300,
    // Section headings
    fontSizeBase500:   base.fontSizeBase400,   // 20 → 16
    lineHeightBase500: base.lineHeightBase400,
    // Page titles
    fontSizeBase600:   base.fontSizeBase500,   // 24 → 20
    lineHeightBase600: base.lineHeightBase500,
    // Hero / display sizes shift one step down too so they stay proportional.
    fontSizeHero700:   base.fontSizeHero600,
    lineHeightHero700: base.lineHeightHero600,
    fontSizeHero800:   base.fontSizeHero700,
    lineHeightHero800: base.lineHeightHero700,
    fontSizeHero900:   base.fontSizeHero800,
    lineHeightHero900: base.lineHeightHero800,
    fontSizeHero1000:  base.fontSizeHero900,
    lineHeightHero1000: base.lineHeightHero900,
  };
}

export const compactLightTheme = shrinkBody(webLightTheme);
export const compactDarkTheme  = shrinkBody(webDarkTheme);

/**
 * Sidebar accent palette — the pastel set the app has shipped with since the
 * earliest Sidebar revision (commit 929d5aa). Defined here so a future
 * palette swap touches one file and recolours every accented icon.
 *
 * Fluent's built-in palette tokens don't have these exact pastel shades, so
 * we keep them as named module exports rather than fake theme tokens.
 */
export const SIDEBAR_ICON_COLORS = {
  blue:  '#a4c2dc',
  amber: '#f5b945',
  green: '#94bc66',
  pink:  '#d4a5c9',
};

/**
 * Sidebar item text color — sits a notch darker than Fluent's
 * colorNeutralForeground1 (#242424) so the rail's medium-weight labels read
 * with the contrast of a heavier weight without actually being bold.
 * Defined here so a theme swap can re-tone it in one place.
 */
export const SIDEBAR_TEXT_COLOR = '#111111';
