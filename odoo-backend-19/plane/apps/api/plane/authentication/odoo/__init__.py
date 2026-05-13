# Odoo-backed authentication.
#
# Plane delegates password verification to Odoo's /web/session/authenticate
# and treats Plane's `User` row as a write-through cache of Odoo's res_users
# (id is Plane-local; email is the join key with Odoo's res_users.login).
# Odoo is the single source of truth for credentials, name, and avatar;
# Plane's row exists only to satisfy FKs and store Plane-local prefs.
