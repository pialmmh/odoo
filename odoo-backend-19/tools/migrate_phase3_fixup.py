"""
Phase 3 fix-up: insert what failed in the first run.

  - INV/2026/00002 (KB-tagged, posted) — name conflicts with v19 demo invoice
    in journal_id=1. Insert with name suffix to dodge the unique index.
  - account_payment[1] — failed on NULL journal_id. Derive from move.
  - sale_order_line[1] — v17 column `product_uom` renamed to `product_uom_id`
    in v19. Pick out the right column.
"""
import logging
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format='%(levelname)-7s %(message)s')
log = logging.getLogger('phase3-fix')
DSN_KW = dict(host='/var/run/postgresql', port=5433, user='mustafa')


def jsonify(v):
    if isinstance(v, dict): return psycopg2.extras.Json(v)
    return v


def cols_intersect(s, d, table):
    s.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position", (table,))
    a = [r['column_name'] for r in s.fetchall()]
    d.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s", (table,))
    b = {r['column_name'] for r in d.fetchall()}
    return [c for c in a if c in b]


def main():
    sc = psycopg2.connect(dbname='odoo_billing', **DSN_KW)
    dc = psycopg2.connect(dbname='odoo_billing_19', **DSN_KW)
    dc.autocommit = False
    s = sc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    d = dc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # --------------------------------------------------------------
        # 1) INV/2026/00002 — append KB UUID suffix
        # --------------------------------------------------------------
        log.info('--- INV/2026/00002 (with KB suffix) ---')
        d.execute("SELECT id FROM account_move WHERE x_kb_invoice_id='7e02a8fd-4299-44bc-a7de-7dbee92fe6c5'")
        if d.fetchone():
            log.info('  already migrated, skip')
        else:
            s.execute("SELECT * FROM account_move WHERE id=2")
            m = s.fetchone()
            cols = cols_intersect(s, d, 'account_move')
            cols.remove('id')
            row = dict(m)
            # Mapped FKs
            row['partner_id'] = 44   # ABC ISP
            row['journal_id'] = 1    # Customer Invoices on v19 (same code 'INV')
            row['company_id'] = 1
            # Suffix to avoid unique-index collision while keeping KB UUID intact
            row['name'] = f'{m["name"]}-{m["x_kb_invoice_id"][:8]}'  # e.g. INV/2026/00002-7e02a8fd
            vals = [jsonify(row.get(c)) for c in cols]
            d.execute(f'INSERT INTO account_move ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
            log.info(f'  + account_move[{m["id"]}] "{row["name"]}" → v19 id={d.fetchone()["id"]}')

        # --------------------------------------------------------------
        # 2) account_payment — derive journal_id from move
        # --------------------------------------------------------------
        log.info('--- account_payment[1] ---')
        d.execute("SELECT id, journal_id FROM account_move WHERE name='PBNK1/2026/00001' ORDER BY id DESC LIMIT 1")
        pbnk = d.fetchone()
        if not pbnk:
            log.warning('  no PBNK1 move on v19 — abort payment insert')
        else:
            s.execute("SELECT * FROM account_payment WHERE id=1")
            p = s.fetchone()
            d.execute("SELECT id FROM account_payment WHERE move_id=%s", (pbnk['id'],))
            if d.fetchone():
                log.info('  already exists, skip')
            else:
                ap_cols = cols_intersect(s, d, 'account_payment')
                ap_cols.remove('id')
                row = dict(p)
                row['move_id'] = pbnk['id']
                row['date'] = p['create_date'].date()
                row['state'] = 'paid'
                row['partner_id'] = 44
                row['outstanding_account_id'] = None  # let v19 default fill
                row['destination_account_id'] = None
                row['payment_method_id'] = 1   # Manual Payment, inbound
                d.execute("""SELECT id FROM account_payment_method_line
                             WHERE journal_id=%s AND payment_method_id=1 LIMIT 1""", (pbnk['journal_id'],))
                pml = d.fetchone()
                row['payment_method_line_id'] = pml['id'] if pml else None
                row['company_id'] = 1
                # journal_id, date, company_id, state are v19-only NOT NULL; add explicitly
                extra_cols = ['journal_id', 'date', 'company_id', 'state']
                extra_vals = [pbnk['journal_id'], p['create_date'].date(), 1, 'paid']
                final_cols = ap_cols + extra_cols
                vals = [jsonify(row.get(c)) for c in ap_cols] + extra_vals
                try:
                    d.execute(f'INSERT INTO account_payment ({",".join(final_cols)}) VALUES ({",".join(["%s"]*len(final_cols))}) RETURNING id', vals)
                    new_id = d.fetchone()['id']
                    log.info(f'  + account_payment[{p["id"]}] → v19 id={new_id}')
                except Exception as e:
                    log.warning(f'  failed: {str(e)[:200]}')
                    raise

        # --------------------------------------------------------------
        # 3) sale_order_line — v17 product_uom → v19 product_uom_id
        # --------------------------------------------------------------
        log.info('--- sale_order_line[1] ---')
        d.execute("SELECT id FROM sale_order_line WHERE name LIKE 'Bulk SMS (10K SMS)%' LIMIT 1")
        if d.fetchone():
            log.info('  already migrated, skip')
        else:
            s.execute("SELECT * FROM sale_order_line WHERE id=1")
            ln = s.fetchone()
            # find v19 sale_order S00001 (matched by name in Phase 3)
            d.execute("SELECT id FROM sale_order WHERE name='S00001' ORDER BY id LIMIT 1")
            so = d.fetchone()
            # find v19 product_product for Bulk SMS first variant
            d.execute("""SELECT pp.id FROM product_product pp JOIN product_template pt ON pt.id=pp.product_tmpl_id
                         WHERE pt.name->>'en_US'='Bulk SMS' ORDER BY pp.id LIMIT 1""")
            prod = d.fetchone()
            d.execute("""SELECT pt.uom_id FROM product_template pt
                         JOIN product_product pp ON pp.product_tmpl_id=pt.id WHERE pp.id=%s""", (prod['id'],))
            uom = d.fetchone()
            sol_cols = cols_intersect(s, d, 'sale_order_line')
            if 'id' in sol_cols: sol_cols.remove('id')
            # Map v17 product_uom → v19 product_uom_id manually
            row = dict(ln)
            row['order_id']         = so['id']
            row['order_partner_id'] = 48 if ln['order_partner_id']==8 else 46
            row['product_id']       = prod['id']
            row['salesman_id']      = 2
            row['company_id']       = 1
            sol_cols_extra = sol_cols + ['product_uom_id']
            vals = [jsonify(row.get(c)) for c in sol_cols] + [uom['uom_id']]
            d.execute(f'INSERT INTO sale_order_line ({",".join(sol_cols_extra)}) VALUES ({",".join(["%s"]*len(sol_cols_extra))}) RETURNING id', vals)
            log.info(f'  + sale_order_line[{ln["id"]}] → v19 id={d.fetchone()["id"]}')

        log.info('--- COMMIT ---')
        dc.commit()
    except Exception as e:
        log.exception(f'fix-up failed: {e!r}')
        dc.rollback()
        raise
    finally:
        s.close(); d.close(); sc.close(); dc.close()


if __name__ == '__main__':
    main()
