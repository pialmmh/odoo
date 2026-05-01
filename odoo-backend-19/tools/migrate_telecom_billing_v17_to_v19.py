"""
One-shot migration: telecom-billing data from v17 (odoo_billing) → v19 (odoo_billing_19).

Scope (load-bearing data only — chart-of-accounts-dependent rows skipped):
  - product_category (v17 cats used by the 9 telecom products + ancestors)
  - account_tax       (the 6 custom v17 taxes used by tax_rate)
  - product_template  (the 9 telecom services)
  - product_product   (53 variants)
  - product_taxes_rel (18 m2m rows)
  - product_tax_rate  (14 BD VAT/AIT history rows)
  - product_rate_history (212 price-history rows)
  - res_partner       (1 KB-linked customer: ABC ISP Limited)
  - kb_sync_log       (6 sync queue history rows, with odoo_object remapped)

Skipped (re-syncable from Kill Bill via the kb_sync mechanism):
  - account_move      (2 invoices — depends on chart-of-accounts/journals)
  - account_payment   (1 row    — depends on payment_method/journal/account)

All work runs in a single v19 transaction; rollback on any error.
"""
import logging
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format='%(levelname)-7s %(message)s')
log = logging.getLogger('migrate')

V17_DB = 'odoo_billing'
V19_DB = 'odoo_billing_19'
DSN_KW = dict(host='/var/run/postgresql', port=5433, user='mustafa')

# v17 → v19 user id (admin → admin); v17 changed_by=2 = admin
USER_MAP = {2: 2}

# v17 → v19 company id (we have one company on each side)
COMPANY_MAP = {1: 1}


def cols_intersect(v17, v19, table):
    """Return list of columns that exist in both tables, ordered by v17 ordinal."""
    v17.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position", (table,))
    a = [r['column_name'] for r in v17.fetchall()]
    v19.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s", (table,))
    b = {r['column_name'] for r in v19.fetchall()}
    return [c for c in a if c in b]


def select_row(cur, table, pk):
    cur.execute(f'SELECT * FROM {table} WHERE id=%s', (pk,))
    return dict(zip([d.name for d in cur.description], cur.fetchone()))


def insert_returning_id(cur, table, row, exclude=('id',)):
    """INSERT a dict, return new id. Excludes 'id' so the v19 sequence assigns fresh ids."""
    cols = [k for k in row.keys() if k not in exclude]
    vals = [row[k] for k in cols]
    placeholders = ', '.join(['%s'] * len(cols))
    sql = f'INSERT INTO {table} ({", ".join(cols)}) VALUES ({placeholders}) RETURNING id'
    cur.execute(sql, vals)
    return cur.fetchone()[0]


def main():
    src_conn = psycopg2.connect(dbname=V17_DB, **DSN_KW)
    dst_conn = psycopg2.connect(dbname=V19_DB, **DSN_KW)
    src = src_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    dst = dst_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Always run as a single v19 transaction
        dst_conn.autocommit = False

        # ------------------------------------------------------------------
        # 1) product_category — bring in everything v17 has that v19 doesn't
        # ------------------------------------------------------------------
        log.info('--- product_category ---')
        src.execute("SELECT id, name, parent_id, complete_name, parent_path FROM product_category ORDER BY id")
        v17cats = src.fetchall()

        dst.execute("SELECT id, name FROM product_category")
        v19cats_by_name = {r['name']: r['id'] for r in dst.fetchall()}

        cat_map = {}  # v17_id -> v19_id
        # Multi-pass to satisfy parent_id ordering
        unresolved = list(v17cats)
        passes = 0
        while unresolved and passes < 8:
            still = []
            for c in unresolved:
                if c['name'] in v19cats_by_name:
                    cat_map[c['id']] = v19cats_by_name[c['name']]
                    continue
                # need parent on v19
                if c['parent_id'] and c['parent_id'] not in cat_map:
                    still.append(c)
                    continue
                new_parent = cat_map.get(c['parent_id']) if c['parent_id'] else None
                dst.execute(
                    "INSERT INTO product_category (name, parent_id, complete_name, create_uid, write_uid, create_date, write_date) "
                    "VALUES (%s, %s, %s, 1, 1, NOW(), NOW()) RETURNING id",
                    (c['name'], new_parent, c.get('complete_name'))
                )
                new_id = dst.fetchone()['id']
                cat_map[c['id']] = new_id
                v19cats_by_name[c['name']] = new_id
                log.info(f'  + product_category[{c["id"]}] "{c["name"]}" → v19 id={new_id}')
            unresolved = still
            passes += 1
        if unresolved:
            raise RuntimeError(f'Could not resolve parent for: {[c["name"] for c in unresolved]}')

        # parent_path needs recomputing — Odoo uses an orm-managed column.
        # We do a SQL update mimicking the structure: '/'.join(ancestor ids) + '/'
        dst.execute("""
            WITH RECURSIVE p AS (
                SELECT id, parent_id, id::text || '/' AS path FROM product_category WHERE parent_id IS NULL
                UNION ALL
                SELECT c.id, c.parent_id, p.path || c.id::text || '/' FROM product_category c JOIN p ON c.parent_id = p.id
            )
            UPDATE product_category pc SET parent_path = p.path FROM p WHERE pc.id = p.id
        """)
        log.info(f'  cat_map: {len(cat_map)} entries')

        # ------------------------------------------------------------------
        # 2) account_tax — the 6 custom v17 sale taxes (ids 17-22)
        # ------------------------------------------------------------------
        log.info('--- account_tax ---')
        # Map by exact (name->>'en_US', amount, type_tax_use) on v19
        src.execute("""SELECT id, name, amount, type_tax_use, amount_type, price_include, include_base_amount, description, active
                       FROM account_tax WHERE id IN (17,18,19,20,21,22) ORDER BY id""")
        v17taxes = src.fetchall()

        # First v19 tax_group_id (any will do — Odoo recomputes grouping at runtime)
        dst.execute("SELECT id FROM account_tax_group ORDER BY id LIMIT 1")
        default_tax_group = dst.fetchone()['id']
        dst.execute("SELECT id FROM res_country WHERE code='BD' LIMIT 1")
        bd_country = dst.fetchone()['id']

        tax_map = {}
        for t in v17taxes:
            nm_en = t['name'].get('en_US') if isinstance(t['name'], dict) else t['name']
            descr = t['description']
            descr_en = descr.get('en_US') if isinstance(descr, dict) else descr
            dst.execute("""SELECT id FROM account_tax
                           WHERE name->>'en_US'=%s AND amount=%s AND type_tax_use=%s""",
                        (nm_en, t['amount'], t['type_tax_use']))
            r = dst.fetchone()
            if r:
                tax_map[t['id']] = r['id']
                log.info(f'  account_tax[{t["id"]}] "{nm_en}" → v19 id={r["id"]} (matched)')
                continue
            # v17 price_include is boolean; v19 price_include_override is selection ('on'/'off'/None)
            pio = 'on' if t['price_include'] else 'off'
            dst.execute("""INSERT INTO account_tax
                (name, amount, type_tax_use, amount_type, price_include_override, include_base_amount,
                 description, active, company_id, sequence, create_uid, write_uid, create_date, write_date,
                 country_id, tax_group_id)
              VALUES (%s, %s, %s, COALESCE(%s,'percent'), %s, COALESCE(%s, FALSE),
                      %s, COALESCE(%s, TRUE), 1, 1, 1, 1, NOW(), NOW(),
                      %s, %s)
              RETURNING id""",
              (psycopg2.extras.Json({'en_US': nm_en}), t['amount'], t['type_tax_use'], t['amount_type'],
               pio, t.get('include_base_amount'),
               psycopg2.extras.Json({'en_US': descr_en}) if descr_en else None,
               t.get('active'),
               bd_country, default_tax_group))
            new_id = dst.fetchone()['id']
            tax_map[t['id']] = new_id
            log.info(f'  + account_tax[{t["id"]}] "{nm_en}" → v19 id={new_id}')

        # ------------------------------------------------------------------
        # 3) product_template — the 9 telecom services
        # ------------------------------------------------------------------
        log.info('--- product_template ---')
        # Required v19 NOT NULL: uom_id, type, service_tracking, name
        src.execute("""SELECT id, name, list_price, type, categ_id, uom_id, sale_ok, purchase_ok, active,
                              description, description_sale, default_code,
                              x_kb_product_name, x_kb_category
                       FROM product_template ORDER BY id""")
        v17tmpls = src.fetchall()
        tmpl_map = {}
        for t in v17tmpls:
            nm_en = t['name'].get('en_US') if isinstance(t['name'], dict) else t['name']
            new_categ = cat_map.get(t['categ_id']) or 1
            new_uom = t['uom_id'] or 1   # 'Units' (id=1) by default
            dst.execute("""INSERT INTO product_template
                (name, list_price, type, service_tracking, tracking, categ_id, uom_id,
                 sale_ok, purchase_ok, active, description, description_sale, default_code,
                 x_kb_product_name, x_kb_category,
                 create_uid, write_uid, create_date, write_date)
              VALUES (%s, %s, COALESCE(%s,'service'), 'no', 'none', %s, %s,
                      %s, %s, %s, %s, %s, %s,
                      %s, %s,
                      1, 1, NOW(), NOW())
              RETURNING id""",
              (psycopg2.extras.Json({'en_US': nm_en}), t['list_price'], t['type'], new_categ, new_uom,
               t['sale_ok'], t['purchase_ok'], t['active'],
               psycopg2.extras.Json(t['description']) if isinstance(t['description'], dict) else t['description'],
               psycopg2.extras.Json(t['description_sale']) if isinstance(t['description_sale'], dict) else t['description_sale'],
               t['default_code'],
               t['x_kb_product_name'], t['x_kb_category']))
            new_id = dst.fetchone()['id']
            tmpl_map[t['id']] = new_id
            log.info(f'  + product_template[{t["id"]}] "{nm_en}" → v19 id={new_id}')

        # ------------------------------------------------------------------
        # 4) product_product — 53 variants
        # ------------------------------------------------------------------
        log.info('--- product_product ---')
        src.execute("""SELECT id, product_tmpl_id, default_code, barcode, combination_indices,
                              volume, weight, active,
                              x_kb_trial_days, x_kb_plan_name, x_kb_billing_period, x_kb_has_trial,
                              x_package_items
                       FROM product_product WHERE product_tmpl_id IN %s ORDER BY id""",
                    (tuple(tmpl_map.keys()),))
        prod_map = {}
        for p in src.fetchall():
            new_tmpl = tmpl_map[p['product_tmpl_id']]
            dst.execute("""INSERT INTO product_product
                (product_tmpl_id, default_code, barcode, combination_indices, volume, weight, active,
                 x_kb_trial_days, x_kb_plan_name, x_kb_billing_period, x_kb_has_trial,
                 x_package_items,
                 create_uid, write_uid, create_date, write_date)
              VALUES (%s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s,
                      %s,
                      1, 1, NOW(), NOW())
              RETURNING id""",
              (new_tmpl, p['default_code'], p['barcode'], p['combination_indices'],
               p['volume'], p['weight'], p['active'],
               p['x_kb_trial_days'], p['x_kb_plan_name'], p['x_kb_billing_period'], p['x_kb_has_trial'],
               p['x_package_items']))
            prod_map[p['id']] = dst.fetchone()['id']
        log.info(f'  + product_product: {len(prod_map)} variants migrated')

        # ------------------------------------------------------------------
        # 5) product_taxes_rel
        # ------------------------------------------------------------------
        log.info('--- product_taxes_rel ---')
        src.execute("SELECT prod_id, tax_id FROM product_taxes_rel ORDER BY prod_id, tax_id")
        rel_count = 0
        for r in src.fetchall():
            new_prod = tmpl_map.get(r['prod_id'])
            new_tax = tax_map.get(r['tax_id'])
            if not new_prod or not new_tax:
                log.warning(f'  skip taxes_rel ({r["prod_id"]},{r["tax_id"]}) — missing map')
                continue
            dst.execute("INSERT INTO product_taxes_rel (prod_id, tax_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                        (new_prod, new_tax))
            rel_count += 1
        log.info(f'  + product_taxes_rel: {rel_count} m2m rows')

        # ------------------------------------------------------------------
        # 6) product_tax_rate — 14 rows
        # ------------------------------------------------------------------
        log.info('--- product_tax_rate ---')
        src.execute("""SELECT id, name, rate, tax_type, is_active, is_deduction, gazette_ref, reason, notes,
                              effective_date, end_date, product_tmpl_id, categ_id, odoo_tax_id, changed_by
                       FROM product_tax_rate ORDER BY id""")
        for r in src.fetchall():
            new_categ = cat_map.get(r['categ_id'])
            new_tax = tax_map.get(r['odoo_tax_id'])
            new_tmpl = tmpl_map.get(r['product_tmpl_id']) if r['product_tmpl_id'] else None
            dst.execute("""INSERT INTO product_tax_rate
                (name, rate, tax_type, is_active, is_deduction, gazette_ref, reason, notes,
                 effective_date, end_date, product_tmpl_id, categ_id, odoo_tax_id,
                 changed_by, company_id, create_uid, write_uid, create_date, write_date)
              VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, NOW(), NOW())""",
              (r['name'], r['rate'], r['tax_type'], r['is_active'], r['is_deduction'],
               r['gazette_ref'], r['reason'], r['notes'],
               r['effective_date'], r['end_date'], new_tmpl, new_categ, new_tax,
               USER_MAP.get(r['changed_by']) or 1,
               COMPANY_MAP.get(1) or 1,
               1, 1))
        log.info(f'  + product_tax_rate: 14 rows migrated')

        # ------------------------------------------------------------------
        # 7) product_rate_history — 212 rows
        # ------------------------------------------------------------------
        log.info('--- product_rate_history ---')
        src.execute("""SELECT id, product_tmpl_id, product_id, currency_id, pricelist_id,
                              variant_display, pricelist_tier, reason, effective_date, end_date,
                              notes, price, tax_included, is_active, changed_by, company_id
                       FROM product_rate_history ORDER BY id""")
        rate_count = 0
        for r in src.fetchall():
            new_tmpl = tmpl_map.get(r['product_tmpl_id'])
            new_prod = prod_map.get(r['product_id']) if r['product_id'] else None
            if not new_tmpl:
                log.warning(f'  skip rate_history[{r["id"]}] — no tmpl mapping')
                continue
            dst.execute("""INSERT INTO product_rate_history
                (product_tmpl_id, product_id, currency_id, pricelist_id,
                 variant_display, pricelist_tier, reason, effective_date, end_date,
                 notes, price, tax_included, is_active, changed_by, company_id,
                 create_uid, write_uid, create_date, write_date)
              VALUES (%s, %s, %s, %s,
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s,
                      1, 1, NOW(), NOW())""",
              (new_tmpl, new_prod, r['currency_id'], r['pricelist_id'],
               r['variant_display'], r['pricelist_tier'], r['reason'],
               r['effective_date'], r['end_date'], r['notes'],
               r['price'], r['tax_included'], r['is_active'],
               USER_MAP.get(r['changed_by']) or 1,
               COMPANY_MAP.get(r['company_id']) or 1))
            rate_count += 1
        log.info(f'  + product_rate_history: {rate_count} rows')

        # ------------------------------------------------------------------
        # 8) res_partner — ABC ISP Limited (the one KB-linked partner)
        # ------------------------------------------------------------------
        log.info('--- res_partner (KB-linked) ---')
        src.execute("SELECT * FROM res_partner WHERE x_kb_account_id IS NOT NULL")
        partner_map = {}
        for p in src.fetchall():
            # Skip if same name already on v19
            dst.execute("SELECT id FROM res_partner WHERE name=%s LIMIT 1", (p['name'],))
            existing = dst.fetchone()
            if existing:
                partner_map[p['id']] = existing['id']
                # Update the existing v19 row with the KB account id (so KB sync stays linked)
                dst.execute("UPDATE res_partner SET x_kb_account_id=%s WHERE id=%s",
                            (p['x_kb_account_id'], existing['id']))
                log.info(f'  ~ res_partner[{p["id"]}] "{p["name"]}" — already on v19 (id={existing["id"]}); set x_kb_account_id')
                continue
            # Insert: copy only columns that exist on both sides; force NOT NULL defaults.
            # Defer self-referencing FKs (commercial_partner_id, parent_id) — fix up after.
            shared = cols_intersect(src, dst, 'res_partner')
            shared.remove('id')
            shared = [c for c in shared if c not in
                      ('parent_path', 'commercial_partner_id', 'parent_id')]
            # v19 has NOT NULL `autopost_bills` (no default) — provide it
            extra = {'autopost_bills': 'never'}
            cols = shared + list(extra.keys())
            cols_sql = ', '.join(cols)
            placeholders = ', '.join(['%s'] * len(cols))
            vals = [p.get(c) for c in shared] + list(extra.values())
            # Convert dict → Json
            for i, c in enumerate(cols):
                if isinstance(vals[i], dict):
                    vals[i] = psycopg2.extras.Json(vals[i])
            sql = f'INSERT INTO res_partner ({cols_sql}) VALUES ({placeholders}) RETURNING id'
            dst.execute(sql, vals)
            new_id = dst.fetchone()['id']
            partner_map[p['id']] = new_id
            # commercial partner self-ref now that we have new_id
            dst.execute("UPDATE res_partner SET commercial_partner_id=%s WHERE id=%s",
                        (new_id, new_id))
            log.info(f'  + res_partner[{p["id"]}] "{p["name"]}" → v19 id={new_id}')

        # ------------------------------------------------------------------
        # 9) kb_sync_log — 6 rows; rewrite odoo_object with mapped IDs
        # ------------------------------------------------------------------
        log.info('--- kb_sync_log ---')
        src.execute("""SELECT id, name, operation, direction, status, kb_object_id, odoo_object,
                              catalog_hash, event_id, request_payload, response_payload, error_message,
                              retry_count, company_id, create_date, write_date
                       FROM kb_sync_log ORDER BY id""")
        sync_count = 0
        for r in src.fetchall():
            new_obj = r['odoo_object']
            if new_obj and ',' in new_obj:
                model, oid = new_obj.split(',', 1)
                try:
                    oid_int = int(oid)
                    if model == 'res.partner' and oid_int in partner_map:
                        new_obj = f'res.partner,{partner_map[oid_int]}'
                    elif model == 'product.template' and oid_int in tmpl_map:
                        new_obj = f'product.template,{tmpl_map[oid_int]}'
                    elif model in ('account.move', 'account.payment'):
                        # We didn't migrate these; null out the reference
                        new_obj = None
                except ValueError:
                    pass
            dst.execute("""INSERT INTO kb_sync_log
                (name, operation, direction, status, kb_object_id, odoo_object,
                 catalog_hash, event_id, request_payload, response_payload, error_message,
                 retry_count, company_id, create_uid, write_uid, create_date, write_date)
              VALUES (%s,%s,%s,%s,%s,%s,
                      %s,%s,%s,%s,%s,
                      %s,%s,1,1,%s,%s)""",
              (r['name'], r['operation'], r['direction'], r['status'], r['kb_object_id'], new_obj,
               r['catalog_hash'], r['event_id'], r['request_payload'], r['response_payload'], r['error_message'],
               r['retry_count'], COMPANY_MAP.get(r['company_id']) or 1,
               r['create_date'], r['write_date']))
            sync_count += 1
        log.info(f'  + kb_sync_log: {sync_count} rows')

        # ------------------------------------------------------------------
        # commit
        # ------------------------------------------------------------------
        log.info('--- COMMIT ---')
        dst_conn.commit()
        log.info('Migration complete.')

        # Summary
        log.info('=== ID MAPS ===')
        log.info(f'  product_category: {len(cat_map)} entries')
        log.info(f'  account_tax: {tax_map}')
        log.info(f'  product_template: {tmpl_map}')
        log.info(f'  product_product: {len(prod_map)} entries')
        log.info(f'  res_partner: {partner_map}')

    except Exception as e:
        log.exception(f'Migration failed: {e!r}')
        dst_conn.rollback()
        raise
    finally:
        src.close(); dst.close(); src_conn.close(); dst_conn.close()


if __name__ == '__main__':
    main()
