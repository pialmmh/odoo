{
    'name': 'TB Fluent Theme',
    'version': '17.0.1.0.0',
    'category': 'Hidden/Tools',
    'summary': 'Global Fluent UI v9 skin for the Odoo backend (font + brand colors).',
    'description': '''
Applies our React app's Fluent UI v9 brand ramp and font stack to the Odoo
backend globally. Edit static/src/scss/_config.scss and restart Odoo to change
the brand color, header style, or font family.

Source of truth (matches ui/src/theme/fluentTheme.js + webLightTheme defaults):
  - colorBrandBackground:        #0F6CBD
  - colorBrandBackgroundHover:   #115EA3
  - colorBrandBackgroundPressed: #0C3B5E
  - colorBrandBackgroundSelected:#0F548C
  - Header:  Fluent neutral (white bg, brand on accents only)
  - Font:    'Segoe UI Variable','Segoe UI', system fallbacks
  - Font sizes: untouched (Odoo's own ramp preserved)
''',
    'depends': ['web'],
    'data': [],
    'assets': {
        'web.assets_backend': [
            # _config.scss is @imported by theme.scss — do NOT list it
            # separately, or Sass partial change-detection breaks.
            'tb_fluent_theme/static/src/scss/theme.scss',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
