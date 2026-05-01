"""Apply post-create settings to a freshly initialised tenant DB via XML-RPC.

Reads:
  DB_NAME       — Odoo database name (required)
  DISPLAY_NAME  — applied as res.company name + label on admin user
  ADMIN_EMAIL   — applied to admin (user id 2) login + email
  ODOO_URL      — defaults to http://127.0.0.1:7169
  ODOO_USER     — defaults to admin
  ODOO_PASSWORD — defaults to admin

Idempotent: writes only if values differ.
"""
from __future__ import annotations

import os
import sys
import xmlrpc.client


def main() -> int:
    db = os.environ.get("DB_NAME")
    if not db:
        print("DB_NAME not set", file=sys.stderr)
        return 2
    display = os.environ.get("DISPLAY_NAME") or ""
    email   = os.environ.get("ADMIN_EMAIL")  or ""
    url     = os.environ.get("ODOO_URL", "http://127.0.0.1:7169")
    user    = os.environ.get("ODOO_USER", "admin")
    pw      = os.environ.get("ODOO_PASSWORD", "admin")

    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
    uid = common.authenticate(db, user, pw, {})
    if not uid:
        print(f"Authentication failed for db={db}", file=sys.stderr)
        return 3
    obj = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")

    def call(model, method, *args, **kw):
        return obj.execute_kw(db, uid, pw, model, method, list(args), kw)

    if display:
        # Update the default company's name. Only one company at create time.
        company_ids = call("res.company", "search", [], limit=1, order="id")
        if company_ids:
            cur = call("res.company", "read", company_ids, fields=["name"])
            if cur and cur[0].get("name") != display:
                call("res.company", "write", company_ids, {"name": display})
                print(f"  company name → {display}")

    if email:
        # Admin user is conventionally id=2 in a fresh DB.
        # Leave `login` as 'admin' so the gateway service account keeps
        # authenticating uniformly across tenant DBs; only update email.
        cur = call("res.users", "read", [2], fields=["email"])
        if cur and cur[0].get("email") != email:
            call("res.users", "write", [2], {"email": email})
            print(f"  admin email → {email}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
